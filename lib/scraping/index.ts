import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarProducto, buscarAlimento, crearAlimentoSiNoExiste } from './normalizador'
import { scrapearMercadona } from './supermercados/mercadona'
import type { ResultadoScraping } from '@/types'
import type { ProductoRaw } from './types'

/**
 * Orquestrador principal de scraping.
 * 1. Scrapea productos del supermercado seleccionado
 * 2. Normaliza nombres y busca coincidencias en la BD
 * 3. Guarda en productos_supermercado + precios_historico
 * 4. Devuelve estadísticas del proceso
 *
 * @param supabase - Cliente Supabase (service_role para API routes, browser para client)
 */
export async function scrapearSupermercado(
    supermercadoId: string,
    supermercadoSlug: string,
    supabase: SupabaseClient
): Promise<ResultadoScraping> {
    const inicio = Date.now()
    const errores: string[] = []
    let productosRaw: ProductoRaw[] = []
    let stats = { nuevos: 0, actualizados: 0, no_encontrados: 0 }

    try {
        // 1. Ejecutar scraper según el supermercado
        switch (supermercadoSlug) {
            case 'mercadona': {
                const result = await scrapearMercadona()
                productosRaw = result.productos
                errores.push(...result.errores)
                break
            }
            default:
                errores.push(`Supermercado "${supermercadoSlug}" no tiene scraper implementado aún`)
                return {
                    supermercado_id: supermercadoId,
                    supermercado_nombre: supermercadoSlug,
                    productos: [],
                    fecha_scraping: new Date().toISOString(),
                    duracion_ms: Date.now() - inicio,
                    errores,
                    total_procesados: 0,
                    nuevos_productos: 0,
                    actualizados: 0,
                    no_encontrados: 0,
                }
        }

        // 2. Procesar cada producto: normalizar + guardar
        const productosFinales: ResultadoScraping['productos'] = []

        for (const raw of productosRaw) {
            const nombreNormalizado = normalizarProducto(raw.nombre)

            // Buscar alimento en BD
            const match = await buscarAlimento(nombreNormalizado, supabase)

            let alimentoId = match.alimento_id

            if (!alimentoId) {
                // No encontrado → intentar crear un nuevo alimento
                alimentoId = await crearAlimentoSiNoExiste(nombreNormalizado, supabase)
                if (alimentoId) {
                    stats.nuevos++
                } else {
                    stats.no_encontrados++
                }
            } else {
                stats.actualizados++
            }

            // Guardar en productos_supermercado (solo si tenemos alimento_id)
            if (alimentoId) {
                const { error: upsertError } = await supabase
                    .from('productos_supermercado')
                    .upsert({
                        supermercado_id: supermercadoId,
                        alimento_id: alimentoId,
                        precio_por_kg: raw.precio_por_kg || raw.precio_actual,
                        precio_unidad: raw.precio_actual !== (raw.precio_por_kg || raw.precio_actual) ? raw.precio_actual : null,
                        unidad: raw.unidad || 'kg',
                        url_producto: raw.url_producto,
                        fecha_precio: new Date().toISOString().split('T')[0],
                    }, {
                        onConflict: 'supermercado_id, alimento_id',
                    })

                if (upsertError) {
                    errores.push(`Error al guardar ${nombreNormalizado}: ${upsertError.message}`)
                }

                // Guardar en histórico siempre
                await supabase
                    .from('precios_historico')
                    .insert({
                        supermercado_id: supermercadoId,
                        alimento_id: alimentoId,
                        nombre_producto: raw.nombre,
                        precio_por_kg: raw.precio_por_kg || raw.precio_actual,
                        precio_unidad: raw.precio_actual !== (raw.precio_por_kg || raw.precio_actual) ? raw.precio_actual : null,
                        url_producto: raw.url_producto,
                        fuente: 'scraping_http',
                        metadatos: {
                            marca: raw.marca,
                            cantidad: raw.cantidad,
                            disponible: raw.disponible,
                            imagen_url: raw.imagen_url,
                        },
                    })
            }

            productosFinales.push({
                nombre: raw.nombre,
                nombre_normalizado: nombreNormalizado,
                precio_actual: raw.precio_actual,
                precio_por_kg: raw.precio_por_kg,
                unidad: raw.unidad,
                url_producto: raw.url_producto,
                imagen_url: raw.imagen_url,
                marca: raw.marca,
                cantidad: raw.cantidad,
                disponible: raw.disponible,
            })
        }

        return {
            supermercado_id: supermercadoId,
            supermercado_nombre: configNombre(supermercadoSlug),
            productos: productosFinales,
            fecha_scraping: new Date().toISOString(),
            duracion_ms: Date.now() - inicio,
            errores,
            total_procesados: productosRaw.length,
            nuevos_productos: stats.nuevos,
            actualizados: stats.actualizados,
            no_encontrados: stats.no_encontrados,
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error inesperado: ${msg}`)

        return {
            supermercado_id: supermercadoId,
            supermercado_nombre: configNombre(supermercadoSlug),
            productos: [],
            fecha_scraping: new Date().toISOString(),
            duracion_ms: Date.now() - inicio,
            errores,
            total_procesados: 0,
            nuevos_productos: 0,
            actualizados: 0,
            no_encontrados: 0,
        }
    }
}

function configNombre(slug: string): string {
    const mapa: Record<string, string> = {
        mercadona: 'Mercadona',
        carrefour: 'Carrefour',
        consum: 'Consum',
        aldi: 'Aldi',
        lidl: 'Lidl',
        alcampo: 'Alcampo',
        dia: 'Día',
        'el-corte-ingles': 'El Corte Inglés',
        hipercor: 'Hipercor',
        bonpreu: 'Bonpreu',
        esclat: 'Esclat',
        eroski: 'Eroski',
    }
    return mapa[slug] || slug
}

/**
 * Scrapea todos los supermercados que tengan scraper implementado.
 * @param supabase - Cliente Supabase (service_role para API routes, browser para client)
 */
export async function scrapearTodosLosSupermercados(
    supabase: SupabaseClient
): Promise<ResultadoScraping[]> {
    const { data: supermercados } = await supabase
        .from('supermercados')
        .select('*')
        .eq('activo', true)

    if (!supermercados) return []

    const resultados: ResultadoScraping[] = []

    for (const sm of supermercados) {
        // Solo ejecutar scraper si tenemos implementación para ese slug
        const scrapersDisponibles = ['mercadona']
        if (!scrapersDisponibles.includes(sm.slug)) continue

        const resultado = await scrapearSupermercado(sm.id, sm.slug, supabase)
        resultados.push(resultado)
    }

    return resultados
}

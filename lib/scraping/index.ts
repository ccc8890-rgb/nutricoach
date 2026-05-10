import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarProducto, buscarAlimento, crearAlimentoSiNoExiste } from './normalizador'
import { scrapearMercadona } from './supermercados/mercadona'
import { scrapearCarrefour } from './supermercados/carrefour'
import { scrapearDia } from './supermercados/dia'
import { scrapearAlcampo } from './supermercados/alcampo'
import { scrapearConsum } from './supermercados/consum'
import { scrapearLidl } from './supermercados/lidl'
import { scrapearEroski } from './supermercados/eroski'
import type { ResultadoScraping } from '@/types'
import type { ProductoRaw } from './types'

// ── Filtro de productos no comestibles ──────────────────────────

const NO_COMESTIBLE_KEYWORDS = [
    // Higiene personal
    'champú', 'champu', 'acondicionador', 'mascarilla capilar', 'sérum capilar',
    'gel de ducha', 'gel ducha', 'desodorante', 'antitranspirante', 'colonia',
    'crema corporal', 'loción corporal', 'sorbete corporal', 'manteca corporal',
    'aceite corporal', 'crema reductora', 'anticelulítico', 'tratamiento reductor',
    'crema facial', 'sérum facial', 'contorno de ojos', 'parches para ojos',
    'gel de afeitar', 'espuma de afeitar', 'aftershave', 'maquinilla',
    'pasta de dientes', 'cepillo de dientes', 'enjuague bucal', 'hilo dental',
    'jabón de manos', 'champú seco',
    'tampón', 'tampones', 'compresas', 'salvaslip', 'copa menstrual',
    'preservativo', 'preservativos', 'lubricante sexual',
    'pañal', 'pañales', 'toallitas bebé', 'biberón', 'chupete', 'tetina',
    'cepillo limpiabiberón',
    'maquillaje', 'colorete', 'corrector maquillaje', 'base de maquillaje',
    'máscara de pestañas', 'delineador de ojos', 'sombra de ojos',
    'laca de uñas', 'tratamiento para uñas', 'rizador de pestañas',
    // Limpieza hogar
    'lejía', 'limpiador', 'desengrasante', 'quitamanchas ropa',
    'detergente ropa', 'suavizante ropa', 'pastillas lavavajillas', 'gel lavavajillas',
    'limpiahogar', 'limpiavidrios', 'limpiagafas', 'lavaparabrisas',
    'bayeta', 'estropajo', 'fregona', 'bolsa basura', 'bolsas basura',
    'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
    'ambientador', 'difusor ambientador', 'insecticida', 'trampa ratas',
    'borrador mágico', 'cera multisuperficies', 'sosa cáustica',
    'alcohol 96', 'agua oxigenada', 'amoniaco',
    // Mascotas
    'comida para gato', 'comida para perro', 'pienso', 'arena para gato',
    'snack para perro', 'snack para gato', 'gatos adulto', 'caninos',
]

/** Devuelve true si el nombre del producto indica que NO es comestible por humanos */
function esNoComestible(nombre: string): boolean {
    const lower = nombre.toLowerCase()
    return NO_COMESTIBLE_KEYWORDS.some(kw => lower.includes(kw))
}

/** Mapa de slug → función scraper */
const SCRAPERS: Record<string, () => Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}>> = {
    mercadona: scrapearMercadona,
    carrefour: scrapearCarrefour,
    dia: scrapearDia,
    alcampo: scrapearAlcampo,
    consum: scrapearConsum,
    lidl: scrapearLidl,
    eroski: scrapearEroski,
}

/** Slugs de supermercados que tienen scraper implementado */
export const SLUGS_SCRAPERS_DISPONIBLES: string[] = Object.keys(SCRAPERS)

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
        const scraperFn = SCRAPERS[supermercadoSlug]

        if (!scraperFn) {
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

        const result = await scraperFn()
        productosRaw = result.productos
        errores.push(...result.errores)

        // 2. Procesar cada producto: normalizar + guardar
        const productosFinales: ResultadoScraping['productos'] = []
        let filtrados = 0

        for (const raw of productosRaw) {
            // Filtrar no-comestibles ANTES de cualquier operación
            if (esNoComestible(raw.nombre)) {
                filtrados++
                continue
            }

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
                const precioKg = raw.precio_por_kg || raw.precio_actual
                const precioUnidad = raw.precio_actual !== precioKg ? raw.precio_actual : null
                const fechaHoy = new Date().toISOString().split('T')[0]

                let upsertError

                // Upsert por (supermercado_id, nombre_original) — sin importar si tiene URL o no
                const { data: existente } = await supabase
                    .from('productos_supermercado')
                    .select('id')
                    .eq('supermercado_id', supermercadoId)
                    .eq('nombre_original', raw.nombre)
                    .maybeSingle()

                if (existente) {
                    const { error } = await supabase
                        .from('productos_supermercado')
                        .update({
                            alimento_id: alimentoId,
                            nombre_original: raw.nombre,
                            marca: raw.marca || null,
                            precio_por_kg: precioKg,
                            precio_unidad: precioUnidad,
                            unidad: raw.unidad || 'kg',
                            url_producto: raw.url_producto || null,
                            url_imagen: raw.imagen_url || null,
                            fecha_precio: fechaHoy,
                        })
                        .eq('id', existente.id)
                    upsertError = error
                } else {
                    const { error } = await supabase
                        .from('productos_supermercado')
                        .insert({
                            supermercado_id: supermercadoId,
                            alimento_id: alimentoId,
                            nombre_original: raw.nombre,
                            marca: raw.marca || null,
                            precio_por_kg: precioKg,
                            precio_unidad: precioUnidad,
                            unidad: raw.unidad || 'kg',
                            url_producto: raw.url_producto || null,
                            url_imagen: raw.imagen_url || null,
                            fecha_precio: fechaHoy,
                        })
                    upsertError = error
                }

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
        const scrapersDisponibles = Object.keys(SCRAPERS)
        if (!scrapersDisponibles.includes(sm.slug)) continue

        const resultado = await scrapearSupermercado(sm.id, sm.slug, supabase)
        resultados.push(resultado)
    }

    return resultados
}

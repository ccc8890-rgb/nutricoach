import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarProducto } from './normalizador'
import { esProductoNoComestible } from './guard-no-comestible'
import { matchAlimentoInMemory, cargarAlimentosMap, AlimentoRecord } from './matcher'
import { categorizarAlimento } from './categorizador'
import { clasificarPendientes, enriquecerAlimentosNuevos } from './post-scraping'
import { scrapearMercadona } from './supermercados/mercadona'
import { scrapearCarrefour } from './supermercados/carrefour'
import { scrapearDia } from './supermercados/dia'
import { scrapearAlcampo } from './supermercados/alcampo'
import { scrapearConsum } from './supermercados/consum'
import { scrapearLidl } from './supermercados/lidl'
import { scrapearEroski } from './supermercados/eroski'
import { scrapearElCorteIngles } from './supermercados/el-corte-ingles'
import { scrapearHipercor } from './supermercados/hipercor'
import { scrapearBonpreu } from './supermercados/bonpreu'
import { scrapearEsclat } from './supermercados/esclat'
import type { ResultadoScraping } from '@/types'
import type { ProductoRaw } from './types'

// ── Filtro de productos no comestibles ──────────────────────────
// 🛡️ DELEGADO a guard-no-comestible.ts (ÚNICO PUNTO DE VERDAD)
// Las listas antiguas (NO_COMESTIBLE_KEYWORDS, ALCOHOL_KEYWORDS,
// BEBIDAS_NO_SALUDABLES_KEYWORDS, etc.) fueron migradas a
// PATRONES_NO_COMESTIBLE en guard-no-comestible.ts.
// NO volver a duplicar listas aquí.
function esNoComestible(nombre: string): boolean {
    return esProductoNoComestible(nombre)
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
    'el-corte-ingles': scrapearElCorteIngles,
    hipercor: scrapearHipercor,
    bonpreu: scrapearBonpreu,
    esclat: scrapearEsclat,
}

/** Slugs de supermercados que tienen scraper implementado */
export const SLUGS_SCRAPERS_DISPONIBLES: string[] = Object.keys(SCRAPERS)


/**
 * Pre-carga los productos_supermercado existentes para un supermercado.
 */
async function cargarProductosExistentes(
    supabase: SupabaseClient,
    supermercadoId: string
): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const PAGE_SIZE = 1000
    let desde = 0
    let hayMas = true

    while (hayMas) {
        const { data, error } = await supabase
            .from('productos_supermercado')
            .select('id, nombre_original')
            .eq('supermercado_id', supermercadoId)
            .range(desde, desde + PAGE_SIZE - 1)
            .order('id')

        if (error || !data || data.length === 0) {
            hayMas = false
            break
        }

        for (const p of data) {
            map.set(p.nombre_original, p.id)
        }

        if (data.length < PAGE_SIZE) hayMas = false
        else desde += PAGE_SIZE
    }

    console.log(`[Batch] Cargados ${map.size} productos existentes para supermercado`)
    return map
}

const MARCAS_CONOCIDAS = [
    'hacendado', 'carrefour', 'milbona', 'bosque verde', 'deliplus',
    'lidl', 'aldi', 'dia', 'alcampo', 'auchan', 'el corte ingles',
    'hipercor', 'bonpreu', 'esclat', 'eroski', 'consum', 'konsum',
]

/**
 * Orquestrador principal de scraping — VERSIÓN BATCH OPTIMIZADA.
 *
 * Antes: ~5-10 queries Supabase por producto → ~23,000-46,000 queries para Mercadona
 * Ahora: 1 query (cargar alimentos) + 1 query (cargar existentes) + N queries batch
 */
export async function scrapearSupermercado(
    supermercadoId: string,
    supermercadoSlug: string,
    supabase: SupabaseClient
): Promise<ResultadoScraping> {
    const inicio = Date.now()
    const errores: string[] = []

    try {
        // 1. Ejecutar scraper
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

        console.log(`[Batch] Scrapeando ${supermercadoSlug}...`)
        const result = await scraperFn()
        const productosRaw = result.productos
        errores.push(...result.errores)
        console.log(`[Batch] ${supermercadoSlug}: ${productosRaw.length} productos scrapeados`)

        // 2. Pre-cargar datos en memoria
        console.log(`[Batch] Cargando datos en memoria...`)
        const [alimentosMap, productosExistentes] = await Promise.all([
            cargarAlimentosMap(supabase),
            cargarProductosExistentes(supabase, supermercadoId),
        ])

        // FASE 4: El scraper NO crea alimentos. Productos sin match
        // se insertan con alimento_id=null y pendiente_clasificacion=true.
        // clasificarPendientes() los procesa post-ejecucion.
        const productosAUpsert: Array<{
            nombre_original: string
            alimento_id: string | null
            marca: string | null
            precio_por_kg: number | null
            precio_unidad: number | null
            unidad: string
            url_producto: string | null
            url_imagen: string | null
            pendiente_clasificacion: boolean
        }> = []
        const historicoAInsertar: Array<{
            supermercado_id: string
            alimento_id: string | null
            nombre_producto: string
            precio_por_kg: number | null
            precio_unidad: number | null
            url_producto: string | null
            fuente: string
            metadatos: Record<string, unknown>
        }> = []

        let filtrados = 0
        let nuevos = 0
        let actualizados = 0
        let noEncontrados = 0

        const fechaHoy = new Date().toISOString().split('T')[0]

        for (const raw of productosRaw) {
            // Filtrar no-comestibles
            if (esNoComestible(raw.nombre)) {
                filtrados++
                continue
            }

            const nombreNormalizado = normalizarProducto(raw.nombre)

            // Buscar alimento en el Map in-memory
            const alimentoId = matchAlimentoInMemory(nombreNormalizado, alimentosMap)

            if (alimentoId) {
                actualizados++
            } else {
                nuevos++
            }

            // FASE 4: El scraper NO crea alimentos. Si no hay match,
            // el producto se inserta con alimento_id=null y
            // pendiente_clasificacion=true. clasificarPendientes()
            // lo procesara post-ejecucion.
            const pendiente = !alimentoId

            productosAUpsert.push({
                nombre_original: raw.nombre,
                alimento_id: alimentoId,
                marca: raw.marca || null,
                precio_unidad: raw.precio_actual > 0 ? raw.precio_actual : null,
                precio_por_kg: (raw.precio_por_kg && raw.precio_por_kg > 0) ? raw.precio_por_kg : null,
                unidad: raw.unidad || 'kg',
                url_producto: raw.url_producto || null,
                url_imagen: raw.imagen_url || null,
                pendiente_clasificacion: pendiente,
            })

            // Guardar historico (solo si hay alimento_id)
            if (alimentoId) {
                historicoAInsertar.push({
                    supermercado_id: supermercadoId,
                    alimento_id: alimentoId,
                    nombre_producto: raw.nombre,
                    precio_unidad: raw.precio_actual > 0 ? raw.precio_actual : null,
                    precio_por_kg: (raw.precio_por_kg && raw.precio_por_kg > 0) ? raw.precio_por_kg : null,
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
        }

        // FASE 4: No se crean alimentos durante el scraping.
        // Los productos sin match se insertan con pendiente_clasificacion=true.
        // clasificarPendientes() los procesara despues.
        const nuevosAlimentosIds: string[] = [] // Se llenara con el resultado de clasificarPendientes()
        const productosInsert: typeof productosAUpsert = []
        const productosUpdate: Array<{ id: string; data: typeof productosAUpsert[0] }> = []

        for (const p of productosAUpsert) {
            if (!p.alimento_id) {
                // Sin match - se inserta como pendiente
                productosInsert.push(p)
                noEncontrados++
                continue
            }

            const existenteId = productosExistentes.get(p.nombre_original)

            if (existenteId) {
                productosUpdate.push({ id: existenteId, data: p })
            } else {
                productosInsert.push(p)
            }
        }

        // 6. Batch UPSERT productos_supermercado
        if (productosUpdate.length > 0) {
            console.log(`[Batch] Actualizando ${productosUpdate.length} productos existentes...`)
            const LOTE = 100
            for (let i = 0; i < productosUpdate.length; i += LOTE) {
                const lote = productosUpdate.slice(i, i + LOTE)
                await Promise.all(lote.map(({ id, data }) =>
                    supabase
                        .from('productos_supermercado')
                        .update({
                            alimento_id: data.alimento_id,
                            nombre_original: data.nombre_original,
                            marca: data.marca,
                            precio_por_kg: data.precio_por_kg,
                            precio_unidad: data.precio_unidad,
                            unidad: data.unidad,
                            url_producto: data.url_producto,
                            fecha_precio: fechaHoy,
                        })
                        .eq('id', id)
                ))
            }
        }

        if (productosInsert.length > 0) {
            // Deduplicar por alimento_id (solo cuando no es null ni pendiente)
            // Productos con alimento_id=null se insertan todos (cada uno es un producto distinto)
            const vistos = new Set<string>()
            const dedupProducts: typeof productosInsert = []
            for (const p of productosInsert) {
                if (!p.alimento_id) {
                    // Sin match: cada producto se inserta individualmente
                    dedupProducts.push(p)
                    continue
                }
                const key = p.alimento_id
                if (!vistos.has(key)) {
                    vistos.add(key)
                    dedupProducts.push(p)
                }
            }
            const dedupCount = productosInsert.length - dedupProducts.length
            if (dedupCount > 0) {
                console.log(`[Batch] Eliminados ${dedupCount} duplicados por alimento_id`)
            }
            console.log(`[Batch] Insertando ${dedupProducts.length} productos nuevos...`)
            const LOTE = 100
            for (let i = 0; i < dedupProducts.length; i += LOTE) {
                const lote = dedupProducts.slice(i, i + LOTE)
                const { error } = await supabase
                    .from('productos_supermercado')
                    .insert(lote.map(p => ({
                        supermercado_id: supermercadoId,
                        alimento_id: p.alimento_id,
                        nombre_original: p.nombre_original,
                        marca: p.marca,
                        precio_por_kg: p.precio_por_kg,
                        precio_unidad: p.precio_unidad,
                        unidad: p.unidad,
                        url_producto: p.url_producto,
                        fecha_precio: fechaHoy,
                        pendiente_clasificacion: p.pendiente_clasificacion,
                    })))
                if (error) {
                    errores.push(`Error batch insert productos: ${error.message}`)
                }
            }
        }

        // 7. Batch INSERT precios_historico
        // Solo se insertan productos con alimento_id (los pendientes se saltan)
        const historicoValidos = historicoAInsertar.filter(h => h.alimento_id != null)

        if (historicoValidos.length > 0) {
            console.log(`[Batch] Insertando ${historicoValidos.length} registros en precios_historico...`)
            const LOTE = 200
            for (let i = 0; i < historicoValidos.length; i += LOTE) {
                const lote = historicoValidos.slice(i, i + LOTE)
                const { error } = await supabase
                    .from('precios_historico')
                    .insert(lote)
                if (error) {
                    errores.push(`Error batch insert histórico: ${error.message}`)
                }
            }
        }

        // 8. Post-procesado FASE 4: clasificar pendientes + enriquecer
        //    a) clasificarPendientes() vincula productos sin match o crea nuevos alimentos
        //    b) enriquecerAlimentosNuevos() rellena macros+micros via DeepSeek
        try {
            const clasifResult = await clasificarPendientes(supabase, supermercadoId)
            if (clasifResult.clasificados > 0 || clasifResult.creados > 0) {
                console.log(`[Batch] Clasificados: ${clasifResult.clasificados} productos, ${clasifResult.creados} alimentos creados`)
            }
            // Enriquecer los alimentos nuevos creados por el clasificador
            const idsParaEnriquecer = clasifResult.nuevosAlimentosIds
            if (idsParaEnriquecer.length > 0) {
                console.log(`[Batch] Post-enriqueciendo ${idsParaEnriquecer.length} alimentos nuevos...`)
                const postResult = await enriquecerAlimentosNuevos(supabase, idsParaEnriquecer)
                if (postResult.errores.length > 0) {
                    console.warn(`[Batch] Post-enriquecimiento: ${postResult.actualizados}/${postResult.procesados} OK, ${postResult.errores.length} errores`)
                    errores.push(...postResult.errores.map(e => `[PostEnriquecimiento] ${e}`))
                } else {
                    console.log(`[Batch] Post-enriquecimiento: ${postResult.actualizados} alimentos enriquecidos`)
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn(`[Batch] Error en post-procesado (no critico): ${msg}`)
            // No propagar el error - el scraping ya fue exitoso
        }

        // 9. Construir respuesta
        const totalProcesados = productosRaw.length
        const duracion = Date.now() - inicio
        console.log(`[Batch] ${supermercadoSlug} completado en ${(duracion / 1000).toFixed(1)}s`)
        console.log(`  Total: ${totalProcesados} | Filtrados: ${filtrados} | Nuevos: ${nuevos} | Actualizados: ${actualizados} | No encontrados: ${noEncontrados}`)

        // Ajustar stats: actualizados cuenta los que tenían match en alimentos (no necesariamente en productos_supermercado)
        const statsActualizados = productosUpdate.length
        const statsNuevos = productosInsert.length

        const productosFinales = productosRaw
            .filter(r => !esNoComestible(r.nombre))
            .map(r => ({
                nombre: r.nombre,
                nombre_normalizado: normalizarProducto(r.nombre),
                precio_actual: r.precio_actual,
                precio_por_kg: r.precio_por_kg,
                unidad: r.unidad,
                url_producto: r.url_producto,
                imagen_url: r.imagen_url,
                marca: r.marca,
                cantidad: r.cantidad,
                disponible: r.disponible,
            }))

        return {
            supermercado_id: supermercadoId,
            supermercado_nombre: configNombre(supermercadoSlug),
            productos: productosFinales,
            fecha_scraping: new Date().toISOString(),
            duracion_ms: duracion,
            errores,
            total_procesados: totalProcesados,
            nuevos_productos: statsNuevos,
            actualizados: statsActualizados,
            no_encontrados: noEncontrados,
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

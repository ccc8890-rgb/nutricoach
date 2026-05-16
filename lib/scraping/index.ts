import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizarProducto } from './normalizador'
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
    'lejía', 'limpiador', 'limpiacristales', 'desengrasante', 'quitamanchas ropa',
    'detergente ropa', 'suavizante ropa', 'pastillas lavavajillas', 'gel lavavajillas',
    'limpiahogar', 'limpiavidrios', 'limpiagafas', 'lavaparabrisas',
    'bayeta', 'estropajo', 'fregona', 'bolsa basura', 'bolsas basura',
    'papel higiénico', 'papel de cocina', 'papel aluminio', 'film transparente',
    'ambientador', 'difusor ambientador', 'insecticida', 'trampa ratas',
    'borrador mágico', 'cera multisuperficies', 'sosa cáustica',
    'alcohol 96', 'agua oxigenada', 'amoniaco',
    'abrillantador', 'quitagrasas', 'desincrustante', 'posavajillas',
    'rasqueta', 'multiusos', 'disuelve manchas', 'limpiajuntas',
    'limpiafondos', 'desatascador', 'desagües',
    'estropajo metálico', 'esponja metálica', 'esponja', 'limpiacoches', 'champú coche',
    'limpiador tapicerías', 'limpia alfombras', 'quitacal', 'antical',
    'limpiametales', 'lavaplatos', 'limpiador horno', 'limpiahornos',
    'limpiador baño', 'limpia baños', 'fregasuelos',
    'escoba', 'escobilla', 'plumero', 'recogedor', 'cubo fregona',
    'friegasuelos', 'limpia suelos', 'limpiador suelos',
    // Menaje / ferretería / papelería NO comestibles
    'cuaderno', 'bolígrafo', 'boligrafo', 'rotulador', 'subrayador',
    'pegamento', 'celo', 'cinta adhesiva', 'tijeras', 'grapadora',
    'pilas', 'bombilla', 'vela', 'mechero', 'cerilla',
    'clip', 'grapas', 'goma de borrar',
    'guantes', 'mascarilla', 'cubrecalzado',
    'candado', 'cerradura', 'bombona', 'butano', 'propano',
    // Mascotas
    'comida para gato', 'comida para perro', 'pienso', 'arena para gato',
    'snack para perro', 'snack para gato', 'gatos adulto', 'caninos',
]

// Bebidas alcohólicas — rechazadas antes de entrar en BD
const ALCOHOL_KEYWORDS = [
    // Cerveza (español + catalán)
    'cerveza', 'cervesa',
    // Vinos
    'vino tinto', 'vino blanco', 'vino rosado', 'vino espumoso', 'vino dulce',
    'vino de jerez', 'vino generoso', 'vino ecologico', 'vino ecológico',
    'vi negre', 'vi blanc', 'vi rosat', 'vi escumós', 'vi dolc', 'vi ranci',
    'caixa vi ',
    // Cava / espumosos
    'cava brut', 'cava semi', 'cava rosado', 'cava rosat', 'cava nature',
    'cava benjamín', 'cava pack',
    // Destilados
    'whisky', 'whiskey', 'bourbon',
    'vodka',
    'ginebra', ' gin ',
    'tequila', 'mezcal',
    'brandy', 'coñac', 'cognac',
    'amaretto', 'absenta', 'absinthe',
    'ron añejo', 'ron blanco', 'ron negro', 'ron dorado', 'ron de caña',
    // Licores
    'licor de café', 'licor de menta', 'licor de hierbas', 'licor de naranja',
    'licor de almendra', 'licor de anís', 'aperitivo licor',
    'anís seco', 'anís dulce', 'anisete',
    // Vinos fortificados / aperitivos
    'vermut', 'vermouth',
    'moscatel',
    'jerez fino', 'jerez oloroso', 'jerez amontillado',
    // Champagne / espumosos
    'champán', 'champagne',
    // Sidra
    'sidra',
    // Combinados / RTD
    'sangría', 'sangria',
    'tinto de verano',
    'bebida preparada de ron', 'bebida preparada de vodka', 'bebida preparada de gin',
]

// Si el nombre contiene estas frases, el producto NO se filtra aunque tenga keyword de alcohol
// (platos cocinados o alimentos que usan alcohol como ingrediente)
const ALCOHOL_FOOD_EXCEPTIONS = [
    'al vino', 'en vino', 'con vino', 'estofado', 'guiso',
    'al licor', 'bombones', 'trufas',
    'al ron', 'flambead',
    'vinagre',
    'vitamina',
    'pasas',
    'uva moscatel', 'uvas moscatel',
]

/** Devuelve true si el nombre del producto indica que NO es comestible por humanos */
function esNoComestible(nombre: string): boolean {
    const lower = nombre.toLowerCase()
    if (NO_COMESTIBLE_KEYWORDS.some(kw => lower.includes(kw))) return true
    const tieneExcepcion = ALCOHOL_FOOD_EXCEPTIONS.some(ex => lower.includes(ex))
    if (!tieneExcepcion && ALCOHOL_KEYWORDS.some(kw => lower.includes(kw))) return true
    return false
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

// ── Helpers de matching in-memory ──────────────────────────────

interface AlimentoRecord {
    id: string
    nombre: string
    nombreLower: string
}

function quitarAcentos(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Busca un alimento en el Map in-memory usando la misma lógica que buscarAlimento()
 * pero sin queries a Supabase.
 */
function matchAlimentoInMemory(
    nombreLimpio: string,
    alimentosMap: Map<string, AlimentoRecord>
): string | null {
    const lower = nombreLimpio.toLowerCase()

    // 1. Coincidencia exacta
    const exacto = alimentosMap.get(lower)
    if (exacto) return exacto.id

    // 2. Coincidencia exacta sin acentos
    const lowerSinAcentos = quitarAcentos(lower)
    for (const a of alimentosMap.values()) {
        if (quitarAcentos(a.nombreLower) === lowerSinAcentos) {
            return a.id
        }
    }

    // 3. Contiene bidireccional
    let mejor: AlimentoRecord | null = null
    for (const a of alimentosMap.values()) {
        const aLower = a.nombreLower
        if (aLower.includes(lower) || lower.includes(aLower)) {
            if (!mejor || a.nombre.length < mejor.nombre.length) {
                mejor = a
            }
        }
    }
    if (mejor) return mejor.id

    // 4. Coincidencia por palabra clave (palabra más larga)
    const palabras = lower.split(/\s+/).filter(p => p.length > 2)
    if (palabras.length > 0) {
        const palabraClave = [...palabras].sort((a, b) => b.length - a.length)[0]
        const candidatos: AlimentoRecord[] = []
        for (const a of alimentosMap.values()) {
            if (a.nombreLower.includes(palabraClave)) {
                candidatos.push(a)
            }
        }
        if (candidatos.length > 0) {
            // Filtrar: el nombre del alimento debe contener AL MENOS 2 palabras del producto buscado
            const conMatch = candidatos.filter(a => {
                const palabrasAlimento = a.nombreLower.split(/\s+/)
                const coincidencias = palabras.filter(p =>
                    palabrasAlimento.some(pa => pa.includes(p) || p.includes(pa))
                )
                return coincidencias.length >= 2 || coincidencias.length === palabras.length
            })
            if (conMatch.length > 0) {
                conMatch.sort((a, b) => a.nombre.length - b.nombre.length)
                return conMatch[0].id
            }
        }
    }

    // 5. Último recurso en memoria: cualquier palabra individual
    for (const palabra of (palabras.length ? palabras : [lower]).sort((a, b) => b.length - a.length)) {
        for (const a of alimentosMap.values()) {
            if (a.nombreLower.includes(palabra)) {
                return a.id
            }
        }
    }

    return null
}

/**
 * Pre-carga todos los alimentos de la BD en un Map para matching rápido en memoria.
 */
async function cargarAlimentosMap(supabase: SupabaseClient): Promise<Map<string, AlimentoRecord>> {
    const map = new Map<string, AlimentoRecord>()
    const pageSize = 5000
    let desde = 0
    let hayMas = true

    while (hayMas) {
        const { data, error } = await supabase
            .from('alimentos')
            .select('id, nombre')
            .range(desde, desde + pageSize - 1)

        if (error || !data || data.length === 0) {
            hayMas = false
            break
        }

        for (const a of data) {
            const record: AlimentoRecord = {
                id: a.id,
                nombre: a.nombre,
                nombreLower: a.nombre.toLowerCase(),
            }
            map.set(record.nombreLower, record)
        }

        if (data.length < pageSize) hayMas = false
        else desde += pageSize
    }

    console.log(`[Batch] Cargados ${map.size} alimentos en memoria`)
    return map
}

/**
 * Pre-carga los productos_supermercado existentes para un supermercado.
 */
async function cargarProductosExistentes(
    supabase: SupabaseClient,
    supermercadoId: string
): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const { data } = await supabase
        .from('productos_supermercado')
        .select('id, nombre_original')
        .eq('supermercado_id', supermercadoId)

    if (data) {
        for (const p of data) {
            map.set(p.nombre_original, p.id)
        }
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

        // 3. Procesar cada producto (TODO en memoria)
        const alimentosACrear: Array<{ nombre: string; nombreLimpio: string }> = []
        const productosAUpsert: Array<{
            nombre_original: string
            alimento_id: string
            marca: string | null
            precio_por_kg: number | null
            precio_unidad: number | null
            unidad: string
            url_producto: string | null
            url_imagen: string | null
        }> = []
        const historicoAInsertar: Array<{
            supermercado_id: string
            alimento_id: string
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
            const nombreLower = nombreNormalizado.toLowerCase()

            // Buscar alimento en el Map in-memory
            let alimentoId = matchAlimentoInMemory(nombreNormalizado, alimentosMap)

            if (!alimentoId) {
                // Marcar para crear (en batch después)
                alimentosACrear.push({ nombre: nombreNormalizado, nombreLimpio: nombreLower })
                nuevos++
            } else {
                actualizados++
            }

            // Guardamos el producto para upsert batch después
            // (alimentoId puede ser null si aún no se ha creado — lo resolveremos en batch)
            productosAUpsert.push({
                nombre_original: raw.nombre,
                alimento_id: alimentoId || '__PENDING__', // placeholder
                marca: raw.marca || null,
                precio_por_kg: raw.precio_por_kg || raw.precio_actual,
                precio_unidad: raw.precio_actual !== (raw.precio_por_kg || raw.precio_actual) ? raw.precio_actual : null,
                unidad: raw.unidad || 'kg',
                url_producto: raw.url_producto || null,
                url_imagen: raw.imagen_url || null,
            })

            // Guardar histórico (con placeholder de alimento_id)
            historicoAInsertar.push({
                supermercado_id: supermercadoId,
                alimento_id: alimentoId || '__PENDING__',
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

        // 4. Crear alimentos nuevos en BATCH
        const alimentosIdMap = new Map<string, string>() // nombreLower → id
        if (alimentosACrear.length > 0) {
            console.log(`[Batch] Creando ${alimentosACrear.length} alimentos nuevos en batch...`)

            // Crear en lotes de 100 para evitar payloads enormes
            const LOTE = 100
            for (let i = 0; i < alimentosACrear.length; i += LOTE) {
                const lote = alimentosACrear.slice(i, i + LOTE)
                const inserts = lote.map(a => {
                    const nombreLower = a.nombreLimpio
                    const tieneMarca = MARCAS_CONOCIDAS.some(m => nombreLower.includes(m))
                    return {
                        nombre: a.nombre,
                        categoria: 'Supermercado',
                        calorias: 0,
                        proteinas: 0,
                        carbohidratos: 0,
                        grasas: 0,
                        es_generico: !tieneMarca,
                    }
                })

                const { data: creados, error } = await supabase
                    .from('alimentos')
                    .insert(inserts)
                    .select('id, nombre')

                if (error) {
                    // Si falla el batch, reintentar uno por uno (por si hay conflictos de unique)
                    console.warn(`[Batch] Error en batch insert (${error.message}), reintentando individual...`)
                    for (const a of lote) {
                        const { data: single } = await supabase
                            .from('alimentos')
                            .insert({
                                nombre: a.nombre,
                                categoria: 'Supermercado',
                                calorias: 0,
                                proteinas: 0,
                                carbohidratos: 0,
                                grasas: 0,
                                es_generico: true,
                            })
                            .select('id, nombre')
                            .maybeSingle()

                        if (single) {
                            alimentosIdMap.set(a.nombreLimpio, single.id)
                            console.log(`[Batch] Alimento creado (individual): "${a.nombre}" (${single.id})`)
                        } else {
                            // Podría ser duplicado, intentar buscar
                            const { data: existente } = await supabase
                                .from('alimentos')
                                .select('id')
                                .ilike('nombre', a.nombre)
                                .maybeSingle()
                            if (existente) {
                                alimentosIdMap.set(a.nombreLimpio, existente.id)
                            } else {
                                console.warn(`[Batch] No se pudo crear alimento: "${a.nombre}"`)
                                noEncontrados++
                            }
                        }
                    }
                } else if (creados) {
                    for (const c of creados) {
                        const key = c.nombre.toLowerCase()
                        alimentosIdMap.set(key, c.id)
                        // Añadir al map global también
                        alimentosMap.set(key, {
                            id: c.id,
                            nombre: c.nombre,
                            nombreLower: key,
                        })
                    }
                }
            }
            console.log(`[Batch] Creados ${alimentosIdMap.size} alimentos nuevos`)
        }

        // 5. Reemplazar placeholders de alimento_id y separar inserts de updates
        const productosInsert: typeof productosAUpsert = []
        const productosUpdate: Array<{ id: string; data: typeof productosAUpsert[0] }> = []

        for (const p of productosAUpsert) {
            let alimentoId: string | null = p.alimento_id
            if (alimentoId === '__PENDING__') {
                // Buscar en los recién creados
                const nombreLower = normalizarProducto(p.nombre_original).toLowerCase()
                alimentoId = alimentosIdMap.get(nombreLower) || matchAlimentoInMemory(normalizarProducto(p.nombre_original), alimentosMap) || null
            }

            if (!alimentoId) {
                noEncontrados++
                continue
            }

            p.alimento_id = alimentoId
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
            // Deduplicar por alimento_id (constraint unique supermercado_id + alimento_id)
            const vistos = new Set<string>()
            const dedupProducts: typeof productosInsert = []
            for (const p of productosInsert) {
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
                    })))
                if (error) {
                    errores.push(`Error batch insert productos: ${error.message}`)
                }
            }
        }

        // 7. Batch INSERT precios_historico
        const historicoValidos = historicoAInsertar.filter(h => {
            if (h.alimento_id === '__PENDING__') {
                const nombreNormalizado = normalizarProducto(h.nombre_producto)
                const nombreLower = nombreNormalizado.toLowerCase()
                const id = alimentosIdMap.get(nombreLower) || matchAlimentoInMemory(nombreNormalizado, alimentosMap)
                if (id) {
                    h.alimento_id = id
                    return true
                }
                return false
            }
            return true
        })

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

        // 8. Construir respuesta
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

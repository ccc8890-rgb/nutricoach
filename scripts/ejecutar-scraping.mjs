#!/usr/bin/env node
/**
 * ejecutar-scraping.mjs
 *
 * Script autónomo para descargar el catálogo completo de Mercadona
 * (~3.200 productos) usando su API REST pública e insertarlos en
 * Supabase con upsert por (supermercado_id, nombre_original).
 *
 * También soporta Carrefour si se pasa --carrefour.
 *
 * USO:
 *   node scripts/ejecutar-scraping.mjs                # Solo Mercadona
 *   node scripts/ejecutar-scraping.mjs --mercadona    # Explícito
 *   node scripts/ejecutar-scraping.mjs --carrefour    # Solo Carrefour
 *   node scripts/ejecutar-scraping.mjs --all          # Todos
 *
 * Requiere: .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Config ────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
})

const RATE_LIMIT_MS = 200
const TIMEOUT_MS = 15000

// ── Mercadona API ─────────────────────────────────────────────

const MERCADONA_API = 'https://tienda.mercadona.es/api'

/**
 * Scrapea el catálogo completo de Mercadona recorriendo el árbol:
 *   /api/categories/ → categorías padre
 *     └── /api/categories/{subId} → sub-subcategorías con productos
 */
async function scrapearMercadona() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Mercadona] ⏳ Obteniendo categorías padre...')

    const raw = await fetchJSON(`${MERCADONA_API}/categories/`)
    const padres = raw.results || []
    console.log(`[Mercadona] ✅ ${padres.length} categorías padre`)

    const subIds = padres.flatMap(p =>
        (p.categories || []).filter(c => c.published !== false).map(c => c.id)
    )
    console.log(`[Mercadona] 🔍 ${subIds.length} subcategorías para procesar\n`)

    for (let i = 0; i < subIds.length; i++) {
        await delay(RATE_LIMIT_MS)
        const subId = subIds[i]

        try {
            const detalle = await fetchJSON(`${MERCADONA_API}/categories/${subId}`)
            const subSubs = detalle.categories || []

            for (const subSub of subSubs) {
                const prods = subSub.products || []
                for (const prod of prods) {
                    const price = prod.price_instructions || {}

                    let precioPorKg
                    if (price.reference_price) {
                        const val = parseFloat(String(price.reference_price).replace(',', '.'))
                        if (!isNaN(val)) precioPorKg = val
                    }

                    const precioUnitario = parseFloat(String(price.unit_price || '0').replace(',', '.'))
                    if (!precioPorKg && precioUnitario) {
                        precioPorKg = precioUnitario
                    }

                    productos.push({
                        nombre: prod.display_name || prod.slug || '',
                        precio_actual: precioUnitario,
                        precio_por_kg: precioPorKg,
                        unidad: price.reference_format || 'kg',
                        url_producto: prod.share_url || '',
                        imagen_url: prod.thumbnail || '',
                        marca: prod.brand || 'Hacendado',
                        cantidad: prod.packaging || '',
                        disponible: true,
                        categoria: subSub.name || '',
                    })
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error en subcategoría ${subId}: ${msg}`)
            process.stderr.write(`  ⚠️  Subcategoría ${subId}: ${msg}\n`)
        }

        if (i > 0 && i % 5 === 0) {
            console.log(`  📊 ${i}/${subIds.length} subcats · ${productos.length} productos`)
        }
    }

    console.log(`\n[Mercadona] 📦 ${productos.length} productos totales`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── Carrefour API ─────────────────────────────────────────────

const CARREFOUR_API = 'https://www.carrefour.es'

// Categorías NO comestibles en Carrefour
const CAT_NO_COMESTIBLE = new Set([
    'champú', 'acondicionador', 'mascarilla cabello', 'laca cabello', 'gel cabello',
    'espuma cabello', 'tinte cabello', 'coloración cabello', 'ampollas capilares',
    'protector térmico cabello', 'agua de peinado', 'spray cabello',
    'gel de baño', 'jabón de manos', 'esponja de baño', 'toalla turbante',
    'desodorante', 'colonia', 'eau de toilette', 'eau de parfum', 'fragancia',
    'body spray', 'lote hombre', 'lote mujer', 'lote infantil',
    'crema corporal', 'loción corporal', 'manteca corporal', 'aceite corporal',
    'exfoliante corporal', 'sorbete corporal', 'crema de manos', 'crema para pies',
    'gel refrescante', 'stick para pies',
    'crema facial', 'gel facial', 'sérum facial', 'contorno de ojos',
    'mascarilla facial', 'bruma facial', 'tónico facial', 'agua micelar',
    'leche facial', 'desmaquillador', 'discos desmaquillantes',
    'toallitas desmaquillantes', 'toallitas dermo', 'toallitas rostro',
    'exfoliante arcilla', 'tiras faciales', 'mousse facial',
    'bandas de cera', 'crema depilatoria', 'pinza de cejas',
    'maquillaje fluido', 'maquillaje serum', 'maquillaje mate',
    'corrector', 'prebase de maquillaje', 'iluminador facial',
    'colorete', 'polvo compacto', 'polvo suelto',
    'pintalabios', 'bálsamo labial', 'brillo de labios', 'vaselina perfumada',
    'perfilador de ojos', 'delineador de ojos', 'máscara de pestañas',
    'paleta sombras', 'kit de pinceles', 'kit de esponjas', 'kit esencial',
    'rizador de pestañas', 'sacapuntas doble',
    'gel de afeitar', 'espuma de afeitar', 'bálsamo after shave',
    'loción after shave', 'maquinillas de afeitar',
    'compresa', 'protegeslip', 'tampones', 'toallitas íntimas',
    'gel de higiene íntima',
    'dentífrico', 'cepillo dental', 'enjuague bucal', 'hilo dental',
    'cepillo interdental', 'crema adhesiva prótesis', 'spray bucal',
    'tabletas limpiadoras prótesis', 'arcos dentales', 'kit de viaje higiene dental',
    'laca de uñas', 'tratamiento para uñas', 'quitaesmalte',
    'cortaúñas', 'tijera uñas', 'alicate uñas', 'corta cutículas',
    'taco pulidor', 'piedra pómez',
    'protector solar', 'aceite bruma protectora', 'aftersun',
    'protector labial',
    'alcohol', 'povidona yodada', 'apósitos', 'esparadrapo',
    'tiras adhesivas', 'bandas adhesivas', 'algodón hidrófilo',
    'mascarillas quirúrgicas', 'preservativos',
    'comprimidos vitaminas', 'perlas omega', 'cápsulas', 'gominolas',
    'spray oral', 'sticks jalea real',
    'papilla', 'postre lácteo infantil', 'preparado lácteo crecimiento',
    'leche para lactantes', 'biberón', 'cepillo limpiabiberón',
    'chupete', 'gel corporal infantil', 'gel-champú bebé',
    'pomada del pañal', 'agua de colonia bebé', 'agua perfumada bebé',
    'solución fisiológica', 'gasas para bebé', 'esponja anatómica bebé',
    'polvos de talco', 'bastoncillos algodón bebé', 'toallitas infantiles',
    'toallitas bebé', 'cambiador multiusos', 'pañal bebé',
    'comida gato', 'comida perro', 'mousse con ternera', 'bocaditos en gelatina',
    'arena para gato', 'malta para gato', 'champú perros',
    'snack gato', 'snack perro', 'bolsas para residuos caninos',
    'alimento completo para periquitos',
    'detergente ropa', 'suavizante ropa', 'perfumador ropa',
    'lejía', 'amoníaco', 'quitagrasas', 'limpiacristales',
    'friegasuelos', 'limpiahogar', 'limpiador concentrado',
    'limpiador muebles', 'limpia tapicerías', 'limpia mopas',
    'desincrustante', 'multiusos ph neutro',
    'lavavajillas', 'lavaparabrisas', 'limpiagafas',
    'cera multisuperficies', 'abrillantador suelos',
    'desinfectante tejidos', 'eliminador de olores',
    'jabón blando', 'jabón con glicerina', 'disuelve manchas',
    'pastillas antical', 'activador quitamanchas', 'percarbonato',
    'planchado fácil', 'agua destilada',
    'colgador wc', 'limpiador wc', 'pastillas cisterna', 'discos wc',
    'papel higiénico', 'papel hogar', 'papel multiusos',
    'pañuelos de papel', 'servilleta papel',
    'insecticida', 'colgador antipolillas', 'bolsitas antipolillas',
    'trampa', 'espirales antimosquitos', 'vela citronela', 'raticida',
    'ambientador spray', 'difusor ambientador', 'recambio ambientador',
    'ambientador coche', 'ambientador varitas', 'ambientador perlas',
    'vela perfumada', 'ambientador spa', 'ambientador líquido',
    'absorbeolores', 'set antihumedad',
    'molde de aluminio', 'molde de papel', 'recipiente de plástico',
    'papel de aluminio', 'bolsas congelación', 'bolsa isotérmica',
    'bolsa de rafia', 'vaso mediano', 'plato llano', 'pajitas',
    'palillos redondos', 'bandeja de cartón',
    'velote rojo', 'fósforos', 'mini mechero', 'encendedor cocina',
    'pastillas enciende fuegos',
    'pila alcalina',
    'bolsas de basura', 'alguicida', 'cloro rápido', 'dosificador flotante',
    'kit analizador', 'cloro 5 acciones',
    'escoba', 'fregona', 'mopa atrapa polvo', 'gamuzas atrapa polvo',
    'recambio mopa', 'recogedor', 'palo extensible', 'barreño',
    'cubo con ruedas', 'escurridor', 'pinzas de ropa',
    'rodillo quitapelusas', 'cepillo para lavar',
    'recambios plumero', 'plumero de avestruz',
    'esponja de calzado', 'estropajo', 'borrador mágico',
    'bayeta', 'posavajillas', 'guantes de látex',
    'protector cama', 'compresa de incontinencia',
])

function esComestible(categoria) {
    if (!categoria) return true
    const cat = categoria.toLowerCase().trim()
    return !CAT_NO_COMESTIBLE.has(cat)
}

// ── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/json',
        },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
    return res.json()
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

/**
 * Limpia un nombre de producto quitando marcas, cantidades,
 * paréntesis y palabras genéricas de preparación.
 */
function limpiarNombre(nombre) {
    let limpio = nombre
    limpio = limpio.replace(/\([^)]*\)/g, '')
    limpio = limpio.replace(/\d+\s*(kg|g|ml|l|litro|unidad(?:es)?|pack|ud|uds|unid|pieza(?:s)?)/gi, '')
    limpio = limpio.replace(/^(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)\s*/i, '')
    limpio = limpio.replace(/\s*(Hacendado|Bosque Verde|Deliplus|Carrefour|Carrefour Bio|Carrefour Discount|Milbona|Cien|Lidl|Bellsola)$/i, '')
    limpio = limpio.replace(/\b(para\s+)?(freír|asar|cocinar|horno|plancha|vapor|microondas|troceado|fileteado|cortado|entero|natural|ecológico|tradicional)\b/gi, '')
    limpio = limpio.replace(/\s+/g, ' ').trim()
    return limpio
}

/**
 * Busca un alimento por nombre normalizado o lo crea si no existe.
 * Devuelve el UUID del alimento o null si no se pudo determinar.
 */
async function buscarOMCrearAlimento(nombreLimpio, categoria) {
    if (!nombreLimpio || nombreLimpio.length < 2) return null

    // 1. Coincidencia exacta
    const { data: exacto } = await supabase
        .from('alimentos')
        .select('id')
        .ilike('nombre', nombreLimpio)
        .maybeSingle()
    if (exacto) return exacto.id

    // 2. Coincidencia por contenido
    const { data: contains } = await supabase
        .from('alimentos')
        .select('id')
        .or(`nombre.ilike.%${nombreLimpio}%,nombre.ilike.${nombreLimpio}%`)
        .limit(1)
        .maybeSingle()
    if (contains) return contains.id

    // 3. Crear alimento nuevo (con macros a 0, el coach los rellenará después)
    const { data: nuevo, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreLimpio,
            categoria: categoria || 'Supermercado',
            calorias: 0,
            proteinas: 0,
            carbohidratos: 0,
            grasas: 0,
        })
        .select('id')
        .single()

    if (error) {
        process.stderr.write(`  ⚠️  No se pudo crear alimento "${nombreLimpio}": ${error.message}\n`)
        return null
    }
    return nuevo.id
}

/**
 * Upsert manual por (supermercado_id, nombre_original).
 * Como la BD no tiene UNIQUE sobre (supermercado_id, nombre_original),
 * primero buscamos si existe y hacemos update; si no, insert.
 */
async function upsertProducto(supermercadoId, producto) {
    // Buscar por nombre original exacto en el mismo supermercado
    const { data: existente } = await supabase
        .from('productos_supermercado')
        .select('id, alimento_id')
        .eq('supermercado_id', supermercadoId)
        .eq('nombre_original', producto.nombre)
        .maybeSingle()

    const payload = {
        supermercado_id: supermercadoId,
        nombre_original: producto.nombre,
        precio_por_kg: producto.precio_por_kg ?? producto.precio_actual,
        precio_unidad: producto.precio_actual !== (producto.precio_por_kg ?? producto.precio_actual)
            ? producto.precio_actual : null,
        unidad: producto.unidad || 'kg',
        url_producto: producto.url_producto || null,
        marca: producto.marca || null,
        fecha_precio: new Date().toISOString().split('T')[0],
    }

    if (existente) {
        // Actualizar
        const { error } = await supabase
            .from('productos_supermercado')
            .update(payload)
            .eq('id', existente.id)

        if (error) return { error: error.message }
        return { id: existente.id, alimento_id: existente.alimento_id, accion: 'actualizado' }
    }

    // Nuevo — necesitamos determinar el alimento_id
    const nombreLimpio = limpiarNombre(producto.nombre)
    const alimentoId = await buscarOMCrearAlimento(nombreLimpio, producto.categoria)

    if (!alimentoId) {
        return { error: 'No se pudo determinar/crear alimento', accion: 'saltado' }
    }

    payload.alimento_id = alimentoId

    const { data, error } = await supabase
        .from('productos_supermercado')
        .insert(payload)
        .select('id, alimento_id')
        .single()

    if (error) return { error: error.message }
    return { id: data.id, alimento_id: data.alimento_id, accion: 'nuevo' }
}

async function registrarHistorico(supermercadoId, producto, alimentoId) {
    try {
        await supabase.from('precios_historico').insert({
            supermercado_id: supermercadoId,
            alimento_id: alimentoId,
            nombre_producto: producto.nombre,
            precio_por_kg: producto.precio_por_kg ?? producto.precio_actual,
            precio_unidad: producto.precio_actual !== (producto.precio_por_kg ?? producto.precio_actual)
                ? producto.precio_actual : null,
            url_producto: producto.url_producto || null,
            fuente: 'scraping_http',
            metadatos: {
                marca: producto.marca,
                cantidad: producto.cantidad,
                disponible: producto.disponible,
                imagen_url: producto.imagen_url,
            },
        })
    } catch {
        // Ignorar errores de histórico (duplicados, etc.)
    }
}

// ── Scraper Carrefour (vía búsqueda por categorías) ───────────

async function scrapearCarrefour() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Carrefour] ⏳ Obteniendo categorías...')

    const headers = {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }

    const fetchJSON = async (url) => {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(TIMEOUT_MS),
            headers,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
        return res.json()
    }

    try {
        const raw = await fetchJSON(`${CARREFOUR_API}/api/categories/v1/`)
        const categorias = raw.data || []

        // Extraer subcategorías con productos
        const subCats = []
        for (const cat of categorias) {
            if (cat.subcategories) {
                for (const sub of cat.subcategories) {
                    if (sub.productCount && sub.productCount > 0) {
                        subCats.push({ id: sub.id, name: sub.name })
                    }
                }
            }
        }

        console.log(`[Carrefour] 🔍 ${subCats.length} subcategorías con productos`)

        for (let i = 0; i < subCats.length; i++) {
            const sub = subCats[i]
            await delay(RATE_LIMIT_MS * 2) // Carrefour es más restrictivo

            try {
                const prodsRaw = await fetchJSON(
                    `${CARREFOUR_API}/api/products/v1/category/${sub.id}?pageSize=100`
                )
                const prods = prodsRaw.data || []

                for (const p of prods) {
                    const precioKg = p.pricePerKg
                        || (p.referencePrice ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)

                    productos.push({
                        nombre: p.displayName || p.name || '',
                        precio_actual: p.price || 0,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http')
                            ? p.url
                            : `https://www.carrefour.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Carrefour',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: sub.name || '',
                    })
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${sub.name} (${sub.id}): ${msg}`)
                process.stderr.write(`  ⚠️  Categoría ${sub.name}: ${msg}\n`)
            }

            if (i > 0 && i % 5 === 0) {
                console.log(`  📊 ${i}/${subCats.length} cats · ${productos.length} productos`)
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Carrefour] Error:', msg)
    }

    console.log(`\n[Carrefour] 📦 ${productos.length} productos totales`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── Pipeline de guardado ──────────────────────────────────────

async function procesarSupermercado(slug, scrapeFn, supermercados) {
    const sm = supermercados[slug]
    if (!sm) {
        console.error(`❌ "${slug}" no encontrado en la BD. Ejecuta primero el seed.`)
        return
    }

    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  🏪  ${sm.nombre} (${sm.id})`)
    console.log(`═══════════════════════════════════════════════\n`)

    // 1. Scrapear
    const resultado = await scrapeFn()

    console.log(`\n📊 Resultado del scraping:`)
    console.log(`   📦 Total extraídos: ${resultado.productos.length}`)
    console.log(`   ⚠️  Errores: ${resultado.errores.length}`)
    console.log(`   ⏱️  Duración: ${(resultado.duracion_ms / 1000).toFixed(1)}s`)

    if (resultado.errores.length > 0) {
        console.log('\n⚠️  Errores:')
        resultado.errores.forEach(e => console.log(`   • ${e}`))
    }

    // 2. Filtrar comestibles
    const comestibles = resultado.productos.filter(p => esComestible(p.categoria))
    const descartados = resultado.productos.length - comestibles.length
    console.log(`\n🍽️  Comestibles: ${comestibles.length}`)
    console.log(`🚫  Descartados: ${descartados}`)

    if (comestibles.length === 0) {
        console.log('\n⚠️  No hay productos comestibles para procesar.')
        return
    }

    // 3. Guardar en Supabase
    console.log('\n⏳ Insertando/actualizando en Supabase...')

    let nuevos = 0, actualizados = 0, errores = 0, sinAlimento = 0

    for (let i = 0; i < comestibles.length; i++) {
        const prod = comestibles[i]

        const result = await upsertProducto(sm.id, prod)

        if (result.error) {
            if (result.accion !== 'saltado') {
                process.stderr.write(`  ❌ ${prod.nombre}: ${result.error}\n`)
            }
            errores++
            continue
        }

        if (result.accion === 'nuevo') nuevos++
        else if (result.accion === 'actualizado') actualizados++

        if (result.alimento_id) {
            await registrarHistorico(sm.id, prod, result.alimento_id)
        } else {
            sinAlimento++
        }

        if (i > 0 && i % 500 === 0) {
            const pct = ((i / comestibles.length) * 100).toFixed(1)
            console.log(`   📊 ${i}/${comestibles.length} (${pct}%) · nuevos: ${nuevos} · act: ${actualizados}`)
        }
    }

    console.log(`\n📊 Resumen de ${sm.nombre}:`)
    console.log(`   🆕 Nuevos:           ${nuevos}`)
    console.log(`   🔄 Actualizados:     ${actualizados}`)
    console.log(`   ❌ Errores:          ${errores}`)
    console.log(`   ❓ Sin alimento:     ${sinAlimento}`)
    console.log(`   🍽️  Procesados:      ${comestibles.length}`)
    console.log(`   🚫 Descartados:      ${descartados}`)
    console.log(`   ⏱️  Scraping:        ${(resultado.duracion_ms / 1000).toFixed(1)}s`)
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
    const args = process.argv.slice(2)
    const modo = args.includes('--all') ? 'all'
        : args.includes('--carrefour') ? 'carrefour'
            : args.includes('--mercadona') ? 'mercadona'
                : 'mercadona' // default

    console.log('═══════════════════════════════════════════════')
    console.log('  🛒  NutriCoach · Scraping de Supermercados')
    console.log('═══════════════════════════════════════════════\n')

    const { data: supermercados, error: smError } = await supabase
        .from('supermercados')
        .select('*')
        .eq('activo', true)

    if (smError) {
        console.error('❌ Error al obtener supermercados:', smError.message)
        process.exit(1)
    }

    const smMap = {}
    for (const sm of supermercados) smMap[sm.slug] = sm

    const inicioTotal = Date.now()

    if (modo === 'mercadona' || modo === 'all') {
        await procesarSupermercado('mercadona', scrapearMercadona, smMap)
    }

    if (modo === 'carrefour' || modo === 'all') {
        await procesarSupermercado('carrefour', scrapearCarrefour, smMap)
    }

    const totalMs = Date.now() - inicioTotal
    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  ✅ Scraping completado en ${(totalMs / 1000 / 60).toFixed(1)} min`)
    console.log(`═══════════════════════════════════════════════`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})

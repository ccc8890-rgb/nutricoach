#!/usr/bin/env node
/**
 * ejecutar-scraping.mjs
 *
 * Script autónomo para descargar el catálogo completo de todos los
 * supermercados soportados e insertarlos en Supabase
 * con upsert por (supermercado_id, nombre_original).
 *
 * USO:
 *   node scripts/ejecutar-scraping.mjs                    # Solo Mercadona
 *   node scripts/ejecutar-scraping.mjs --mercadona        # Explícito
 *   node scripts/ejecutar-scraping.mjs --carrefour        # Solo Carrefour
 *   node scripts/ejecutar-scraping.mjs --dia              # Solo Día
 *   node scripts/ejecutar-scraping.mjs --alcampo          # Solo Alcampo
 *   node scripts/ejecutar-scraping.mjs --consum           # Solo Consum
 *   node scripts/ejecutar-scraping.mjs --eroski           # Solo Eroski
 *   node scripts/ejecutar-scraping.mjs --lidl             # Solo Lidl
 *   node scripts/ejecutar-scraping.mjs --all              # Todos los supermercados
 *
 * Requiere: .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * Para Lidl: playwright debe estar instalado (npm exec playwright install chromium)
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

const RATE_LIMIT_MS = 200   // Default entre llamadas
const TIMEOUT_MS = 8000     // Timeout por petición (8s, Cloudflare bloquea rápido)

// ── Helpers ───────────────────────────────────────────────────

async function fetchJSON(url, headers = {}) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: 'application/json',
                ...headers,
            },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`)
        const contentType = res.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
            throw new Error(`CLOUDFLARE: recibido HTML en vez de JSON (${url})`)
        }
        return res.json()
    } finally {
        clearTimeout(timer)
    }
}

function delay(ms) {
    return new Promise(r => setTimeout(r, ms))
}

// ── Filtro de comestibles ─────────────────────────────────────

// Palabras clave que indican que un producto NO es comestible.
// Se usa .some() + includes() para capturar variantes (ej: "Champú cabello graso")
const CAT_NO_COMESTIBLE = [
    'champú', 'champu', 'acondicionador', 'mascarilla cabello', 'laca cabello', 'gel cabello',
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
    'compresa incontinencia', 'protector cama',
]

function esComestible(categoria) {
    if (!categoria) return true
    const cat = categoria.toLowerCase().trim()
    // Usar some() + includes() en vez de Set.has() para capturar
    // categorías como "Champú cabello graso" o "Crema facial hidratante"
    return !CAT_NO_COMESTIBLE.some(kw => cat.includes(kw))
}

// ── Normalización de nombre ───────────────────────────────────

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

// ─── Buscar o crear alimento ──────────────────────────────────

async function buscarOMCrearAlimento(nombreLimpio, categoria) {
    if (!nombreLimpio || nombreLimpio.length < 2) return null

    const { data: exacto } = await supabase
        .from('alimentos')
        .select('id')
        .ilike('nombre', nombreLimpio)
        .maybeSingle()
    if (exacto) return exacto.id

    const { data: contains } = await supabase
        .from('alimentos')
        .select('id')
        .or(`nombre.ilike.%${nombreLimpio}%,nombre.ilike.${nombreLimpio}%`)
        .limit(1)
        .maybeSingle()
    if (contains) return contains.id

    const { data: nuevo, error } = await supabase
        .from('alimentos')
        .insert({
            nombre: nombreLimpio,
            categoria: categoria || 'Supermercado',
            calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0,
        })
        .select('id')
        .single()

    if (error) {
        process.stderr.write(`  ⚠️  No se pudo crear alimento "${nombreLimpio}": ${error.message}\n`)
        return null
    }
    return nuevo.id
}

// ─── Upsert y guardado ────────────────────────────────────────

async function upsertProducto(supermercadoId, producto) {
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
        const { error } = await supabase
            .from('productos_supermercado')
            .update(payload)
            .eq('id', existente.id)
        if (error) return { error: error.message }
        return { id: existente.id, alimento_id: existente.alimento_id, accion: 'actualizado' }
    }

    const nombreLimpio = limpiarNombre(producto.nombre)
    const alimentoId = await buscarOMCrearAlimento(nombreLimpio, producto.categoria)

    if (!alimentoId) return { error: 'No se pudo determinar/crear alimento', accion: 'saltado' }

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
    } catch { /* ignorar errores de históricos */ }
}

// ═══════════════════════════════════════════════════════════════
//  SCRAPERS POR SUPERMERCADO
// ═══════════════════════════════════════════════════════════════

// ── MERCADONA ──────────────────────────────────────────────────

const MERCADONA_API = 'https://tienda.mercadona.es/api'

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
    console.log(`[Mercadona] 🔍 ${subIds.length} subcategorías\n`)

    for (let i = 0; i < subIds.length; i++) {
        await delay(200)
        try {
            const detalle = await fetchJSON(`${MERCADONA_API}/categories/${subIds[i]}`)
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
                    if (!precioPorKg && precioUnitario) precioPorKg = precioUnitario
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
            errores.push(`Error subcat ${subIds[i]}: ${msg}`)
        }
        if (i > 0 && i % 5 === 0) console.log(`  📊 ${i}/${subIds.length} subcats · ${productos.length} prods`)
    }
    console.log(`\n[Mercadona] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── CARREFOUR ──────────────────────────────────────────────────

const CARREFOUR_BASE = 'https://www.carrefour.es'
const CARREFOUR_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
}

async function scrapearCarrefour() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Carrefour] ⏳ Obteniendo categorías...')

    // Probar primera request para detectar Cloudflare rápido
    let cloudflareDetected = false
    try {
        const raw = await fetchJSON(`${CARREFOUR_BASE}/api/categories/v1/`, CARREFOUR_HEADERS)
        const categorias = raw.data || []

        if (categorias.length > 0) {
            const subCats = []
            for (const cat of categorias) {
                if (cat.subcategories) {
                    for (const sub of cat.subcategories) {
                        if (sub.productCount && sub.productCount > 0) subCats.push(sub)
                    }
                }
            }
            console.log(`[Carrefour] 🔍 ${subCats.length} subcategorías\n`)

            for (let i = 0; i < subCats.length; i++) {
                await delay(500)
                try {
                    const prodsRaw = await fetchJSON(
                        `${CARREFOUR_BASE}/api/products/v1/category/${subCats[i].id}?pageSize=100`,
                        CARREFOUR_HEADERS
                    )
                    const prods = prodsRaw.data || []
                    for (const p of prods) {
                        const precioKg = p.pricePerKg || (p.referencePrice
                            ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)
                        productos.push({
                            nombre: p.displayName || p.name || '',
                            precio_actual: p.price || 0,
                            precio_por_kg: precioKg,
                            unidad: 'kg',
                            url_producto: p.url?.startsWith('http') ? p.url : `https://www.carrefour.es${p.url || ''}`,
                            imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                            marca: p.brand || 'Carrefour',
                            cantidad: p.packaging || '',
                            disponible: p.available !== false,
                            categoria: subCats[i].name || '',
                        })
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    if (msg.includes('CLOUDFLARE')) {
                        cloudflareDetected = true
                        errores.push(`[Carrefour] Cloudflare bloquea — saltando`)
                        console.warn(`[Carrefour] ⛔ Cloudflare detectado en subcategoría — abortando`)
                        break
                    }
                    errores.push(`Error cat ${subCats[i].name}: ${msg}`)
                }
                if (cloudflareDetected) break
                if (i > 0 && i % 5 === 0) console.log(`  📊 ${i}/${subCats.length} cats · ${productos.length} prods`)
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        cloudflareDetected = msg.includes('CLOUDFLARE')
        if (!cloudflareDetected) {
            console.warn('[Carrefour] Fallback: búsqueda por términos')
        }
    }

    // Si Cloudflare bloqueó o categorías fallaron, intentar fallback search
    if (!cloudflareDetected && productos.length === 0) {
        const CATS = [
            'leche', 'huevos', 'pan', 'arroz', 'pasta', 'aceite oliva',
            'legumbres', 'lentejas', 'garbanzos',
            'atún', 'salmón', 'pollo', 'ternera', 'cerdo',
            'jamón serrano', 'queso', 'yogurt', 'mantequilla',
            'tomate frito', 'salsa', 'mayonesa', 'mostaza', 'ketchup',
            'fruta fresca', 'manzana', 'plátano', 'naranja',
            'verdura', 'lechuga', 'tomate', 'cebolla', 'patata', 'zanahoria',
            'agua mineral', 'refresco', 'zumo', 'cerveza', 'vino',
            'café', 'té', 'galletas', 'cereales', 'avena',
            'miel', 'mermelada', 'chocolate',
            'frutos secos', 'almendras', 'nueces',
            'harina', 'azúcar', 'sal', 'vinagre', 'especia',
            'conserva', 'aceituna', 'encurtido',
            'congelados', 'pan molde', 'pan tostado',
            'fiambre pavo', 'salchicha',
        ]
        for (let i = 0; i < CATS.length; i++) {
            await delay(500)
            try {
                const sr = await fetchJSON(
                    `${CARREFOUR_BASE}/api/search/v1/?q=${encodeURIComponent(CATS[i])}&pageSize=50`,
                    CARREFOUR_HEADERS
                )
                const prods = sr.data || []
                for (const p of prods) {
                    const precioKg = p.pricePerKg || (p.referencePrice
                        ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)
                    productos.push({
                        nombre: p.displayName || p.name || '',
                        precio_actual: p.price || 0,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http') ? p.url : `https://www.carrefour.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Carrefour',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: CATS[i],
                    })
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                if (msg.includes('CLOUDFLARE')) {
                    errores.push(`[Carrefour] Cloudflare bloquea búsquedas — saltando`)
                    console.warn(`[Carrefour] ⛔ Cloudflare en búsqueda — abortando`)
                    break
                }
                errores.push(`Error búsqueda "${CATS[i]}": ${msg}`)
            }
            if (i > 0 && i % 10 === 0) console.log(`  📊 ${i}/${CATS.length} búsquedas · ${productos.length} prods`)
        }
    }

    if (cloudflareDetected) {
        console.warn(`\n[Carrefour] ⛔ Saltado por bloqueo Cloudflare`)
    }
    console.log(`[Carrefour] 📦 ${productos.length} productos · ${errores.length} errores`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── DÍA ────────────────────────────────────────────────────────

const DIA_BASE = 'https://www.dia.es'
const DIA_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

async function scrapearDia() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Día] ⏳ Obteniendo categorías...')
    try {
        const raw = await fetchJSON(`${DIA_BASE}/api/categories/v1/`, DIA_HEADERS)
        const cats = raw.items || []
        const leafCats = []
        const extract = (list) => {
            for (const c of list) {
                if (c.children && c.children.length > 0) extract(c.children)
                else leafCats.push({ id: c.id, name: c.name })
            }
        }
        extract(cats)
        console.log(`[Día] 🔍 ${leafCats.length} categorías hoja\n`)

        for (let i = 0; i < leafCats.length; i++) {
            await delay(RATE_LIMIT_MS)
            try {
                const prodsRaw = await fetchJSON(
                    `${DIA_BASE}/api/products/v1/category/${leafCats[i].id}?pageSize=50`,
                    DIA_HEADERS
                )
                const prods = prodsRaw.items || []
                for (const p of prods) {
                    let precioKg
                    if (p.pricePerKg) {
                        const m = String(p.pricePerKg).match(/([\d,]+)/)
                        if (m) precioKg = parseFloat(m[1].replace(',', '.'))
                    }
                    productos.push({
                        nombre: p.name,
                        precio_actual: p.price,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http') ? p.url : `https://www.dia.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Día',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: leafCats[i].name,
                    })
                }
            } catch (err) {
                errores.push(`Error cat ${leafCats[i].name}: ${err.message}`)
            }
            if (i > 0 && i % 10 === 0) console.log(`  📊 ${i}/${leafCats.length} cats · ${productos.length} prods`)
        }
    } catch (err) {
        errores.push(`Error general: ${err.message}`)
        console.error('[Día] Error:', err.message)
    }
    console.log(`\n[Día] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── AL CAMPO ───────────────────────────────────────────────────

const ALCAMPO_BASE = 'https://www.alcampo.es'
const ALCAMPO_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

async function scrapearAlcampo() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Alcampo] ⏳ Obteniendo categorías...')
    try {
        const raw = await fetchJSON(`${ALCAMPO_BASE}/api/rest/v1/categories`, ALCAMPO_HEADERS)
        const cats = raw.data || []
        const leafCats = []
        const extract = (list) => {
            for (const c of list) {
                if (c.subcategories && c.subcategories.length > 0) extract(c.subcategories)
                else leafCats.push({ id: c.id, name: c.name })
            }
        }
        extract(cats)
        console.log(`[Alcampo] 🔍 ${leafCats.length} categorías hoja\n`)

        for (let i = 0; i < leafCats.length; i++) {
            await delay(RATE_LIMIT_MS)
            try {
                const prodsRaw = await fetchJSON(
                    `${ALCAMPO_BASE}/api/rest/v1/categories/${leafCats[i].id}/products?pageSize=100`,
                    ALCAMPO_HEADERS
                )
                const prods = prodsRaw.data || []
                for (const p of prods) {
                    const precioKg = p.pricePerKg || (p.referencePrice
                        ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)
                    productos.push({
                        nombre: p.name,
                        precio_actual: p.price,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http') ? p.url : `https://www.alcampo.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Alcampo',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: leafCats[i].name,
                    })
                }
            } catch (err) {
                errores.push(`Error cat ${leafCats[i].name}: ${err.message}`)
            }
            if (i > 0 && i % 10 === 0) console.log(`  📊 ${i}/${leafCats.length} cats · ${productos.length} prods`)
        }
    } catch (err) {
        errores.push(`Error general: ${err.message}`)
        console.error('[Alcampo] Error:', err.message)
    }
    console.log(`\n[Alcampo] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── CONSUM ─────────────────────────────────────────────────────

const CONSUM_BASE = 'https://tienda.consum.es'
const CONSUM_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

async function scrapearConsum() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Consum] ⏳ Obteniendo categorías...')
    try {
        const raw = await fetchJSON(`${CONSUM_BASE}/api/rest/v1/categories`, CONSUM_HEADERS)
        const cats = Array.isArray(raw) ? raw : []
        const leafCats = []
        const extract = (list) => {
            for (const c of list) {
                if (c.subcategories && c.subcategories.length > 0) extract(c.subcategories)
                else leafCats.push({ id: c.id, name: c.name })
            }
        }
        extract(cats)
        console.log(`[Consum] 🔍 ${leafCats.length} categorías hoja\n`)

        for (let i = 0; i < leafCats.length; i++) {
            await delay(RATE_LIMIT_MS)
            try {
                const prods = await fetchJSON(
                    `${CONSUM_BASE}/api/rest/v1/categories/${leafCats[i].id}/products?pageSize=100`,
                    CONSUM_HEADERS
                )
                const prodsList = Array.isArray(prods) ? prods : []
                for (const p of prodsList) {
                    const precioKg = p.unitPrice || (p.referencePrice
                        ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)
                    productos.push({
                        nombre: p.name,
                        precio_actual: p.price,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http') ? p.url : `https://tienda.consum.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Consum',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: leafCats[i].name,
                    })
                }
            } catch (err) {
                errores.push(`Error cat ${leafCats[i].name}: ${err.message}`)
            }
            if (i > 0 && i % 10 === 0) console.log(`  📊 ${i}/${leafCats.length} cats · ${productos.length} prods`)
        }
    } catch (err) {
        errores.push(`Error general: ${err.message}`)
        console.error('[Consum] Error:', err.message)
    }
    console.log(`\n[Consum] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── EROSKI ─────────────────────────────────────────────────────

const EROSKI_BASE = 'https://supermercado.eroski.es'
const EROSKI_HEADERS = { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }

async function scrapearEroski() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Eroski] ⏳ Obteniendo categorías...')
    try {
        const raw = await fetchJSON(`${EROSKI_BASE}/api/categories`, EROSKI_HEADERS)
        const cats = Array.isArray(raw) ? raw : []
        const leafCats = []
        const extract = (list) => {
            for (const c of list) {
                if (c.subcategories && c.subcategories.length > 0) extract(c.subcategories)
                else leafCats.push({ id: c.id, name: c.name })
            }
        }
        extract(cats)
        console.log(`[Eroski] 🔍 ${leafCats.length} categorías hoja\n`)

        for (let i = 0; i < leafCats.length; i++) {
            await delay(RATE_LIMIT_MS)
            try {
                const prods = await fetchJSON(
                    `${EROSKI_BASE}/api/categories/${leafCats[i].id}/products?pageSize=100`,
                    EROSKI_HEADERS
                )
                const prodsList = Array.isArray(prods) ? prods : []
                for (const p of prodsList) {
                    const precioKg = p.unitPrice || (p.referencePrice
                        ? parseFloat(String(p.referencePrice).replace(',', '.')) : undefined)
                    productos.push({
                        nombre: p.name,
                        precio_actual: p.price,
                        precio_por_kg: precioKg,
                        unidad: 'kg',
                        url_producto: p.url?.startsWith('http') ? p.url : `https://supermercado.eroski.es${p.url || ''}`,
                        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
                        marca: p.brand || 'Eroski',
                        cantidad: p.packaging || '',
                        disponible: p.available !== false,
                        categoria: leafCats[i].name,
                    })
                }
            } catch (err) {
                errores.push(`Error cat ${leafCats[i].name}: ${err.message}`)
            }
            if (i > 0 && i % 10 === 0) console.log(`  📊 ${i}/${leafCats.length} cats · ${productos.length} prods`)
        }
    } catch (err) {
        errores.push(`Error general: ${err.message}`)
        console.error('[Eroski] Error:', err.message)
    }
    console.log(`\n[Eroski] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── LIDL (Playwright) ──────────────────────────────────────────

async function scrapearLidl() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    let playwright
    try {
        playwright = await import('playwright')
    } catch {
        errores.push('Playwright no está instalado. Ejecuta: npm install playwright && npx playwright install chromium')
        console.warn('[Lidl] ⚠️  Playwright no disponible, saltando')
        return { productos, errores, duracion_ms: Date.now() - inicio }
    }

    console.log('[Lidl] ⏳ Lanzando navegador...')
    let browser
    try {
        browser = await playwright.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })
        const page = await context.newPage()

        console.log('[Lidl] Navegando a alimentación...')
        await page.goto('https://www.lidl.es/c/alimentacion', {
            waitUntil: 'networkidle',
            timeout: 30000,
        })

        const categorias = await page.evaluate(() => {
            const links = document.querySelectorAll('a[data-category]')
            return Array.from(links).map(a => ({
                url: a.href,
                name: a.textContent?.trim() || '',
            }))
        })

        console.log(`[Lidl] 🔍 ${categorias.length} categorías\n`)
        const catsToScrape = categorias.length > 0
            ? categorias : [{ url: 'https://www.lidl.es/c/alimentacion', name: 'Alimentación' }]
        const maxCats = Math.min(catsToScrape.length, 10)

        for (let i = 0; i < maxCats; i++) {
            await delay(1000)
            try {
                await page.goto(catsToScrape[i].url, { waitUntil: 'networkidle', timeout: 30000 })
                await page.waitForSelector('article[data-product]', { timeout: 10000 }).catch(() => { })

                const prods = await page.evaluate(() => {
                    const items = document.querySelectorAll('article[data-product]')
                    return Array.from(items).map(item => ({
                        nombre: (item.querySelector('[data-product-name], .product__title')?.textContent || '').trim(),
                        precio: parseFloat(
                            (item.querySelector('[data-product-price], .product__price')?.textContent || '0')
                                .replace(/[^\d,]/g, '').replace(',', '.') || '0'
                        ),
                        precioPorKg: (() => {
                            const el = item.querySelector('.product__base-price')
                            if (!el?.textContent) return undefined
                            const m = el.textContent.replace(/[^\d,]/g, '').replace(',', '.')
                            return m ? parseFloat(m) : undefined
                        })(),
                        url: item.querySelector('a.product__link')?.href || '',
                        imagen: item.querySelector('img.product__image')?.src || '',
                        cantidad: (item.querySelector('.product__quantity')?.textContent || '').trim(),
                    }))
                })

                for (const p of prods) {
                    if (p.nombre && p.precio > 0) {
                        productos.push({
                            nombre: p.nombre,
                            precio_actual: p.precio,
                            precio_por_kg: p.precioPorKg,
                            unidad: 'kg',
                            url_producto: p.url,
                            imagen_url: p.imagen || undefined,
                            marca: 'Lidl',
                            cantidad: p.cantidad || undefined,
                            disponible: true,
                            categoria: catsToScrape[i].name,
                        })
                    }
                }
            } catch (err) {
                errores.push(`Error cat ${catsToScrape[i].name}: ${err.message}`)
            }
            console.log(`  📊 ${i + 1}/${maxCats} cats · ${productos.length} prods`)
        }
    } catch (err) {
        errores.push(`Error general: ${err.message}`)
        console.error('[Lidl] Error:', err.message)
    } finally {
        if (browser) await browser.close()
    }
    console.log(`\n[Lidl] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ═══════════════════════════════════════════════════════════════
//  PIPELINE DE GUARDADO
// ═══════════════════════════════════════════════════════════════

async function procesarSupermercado(slug, scrapeFn, supermercados) {
    const sm = supermercados[slug]
    if (!sm) {
        console.error(`❌ "${slug}" no encontrado en la BD. Ejecuta primero el seed.`)
        return
    }

    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  🏪  ${sm.nombre} (${sm.id})`)
    console.log(`═══════════════════════════════════════════════\n`)

    const resultado = await scrapeFn()

    console.log(`\n📊 Scraping:`)
    console.log(`   📦 Total: ${resultado.productos.length}`)
    console.log(`   ⚠️  Errores: ${resultado.errores.length}`)
    console.log(`   ⏱️  ${(resultado.duracion_ms / 1000).toFixed(1)}s`)

    if (resultado.errores.length > 0) {
        console.log('\n⚠️  Errores:')
        resultado.errores.forEach(e => console.log(`   • ${e}`))
    }

    const comestibles = resultado.productos.filter(p => esComestible(p.categoria))
    const descartados = resultado.productos.length - comestibles.length
    console.log(`\n🍽️  Comestibles: ${comestibles.length}`)
    console.log(`🚫  Descartados: ${descartados}`)

    if (comestibles.length === 0) {
        console.log('\n⚠️  No hay productos comestibles.')
        return
    }

    console.log('\n⏳ Guardando en Supabase...')
    let nuevos = 0, actualizados = 0, errores = 0, sinAlimento = 0

    for (let i = 0; i < comestibles.length; i++) {
        const prod = comestibles[i]
        const result = await upsertProducto(sm.id, prod)

        if (result.error) {
            errores++
            continue
        }
        if (result.accion === 'nuevo') nuevos++
        else if (result.accion === 'actualizado') actualizados++
        if (result.alimento_id) await registrarHistorico(sm.id, prod, result.alimento_id)
        else sinAlimento++

        if (i > 0 && i % 500 === 0) {
            const pct = ((i / comestibles.length) * 100).toFixed(1)
            console.log(`   📊 ${i}/${comestibles.length} (${pct}%) · nuevos: ${nuevos} · act: ${actualizados}`)
        }
    }

    console.log(`\n📊 Resumen ${sm.nombre}:`)
    console.log(`   🆕 Nuevos:       ${nuevos}`)
    console.log(`   🔄 Actualizados: ${actualizados}`)
    console.log(`   ❌ Errores:      ${errores}`)
    console.log(`   ❓ Sin alimento: ${sinAlimento}`)
    console.log(`   🍽️  Procesados:  ${comestibles.length}`)
    console.log(`   🚫 Descartados:  ${descartados}`)
    console.log(`   ⏱️  Scraping:    ${(resultado.duracion_ms / 1000).toFixed(1)}s`)
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const MODOS = {
    mercadona: scrapearMercadona,
    carrefour: scrapearCarrefour,
    dia: scrapearDia,
    alcampo: scrapearAlcampo,
    consum: scrapearConsum,
    eroski: scrapearEroski,
    lidl: scrapearLidl,
}

async function main() {
    const args = process.argv.slice(2)
    const flags = args.filter(a => a.startsWith('--')).map(a => a.replace('--', ''))

    let slugsAEjecutar

    if (flags.includes('all')) {
        slugsAEjecutar = Object.keys(MODOS)
    } else if (flags.length > 0) {
        slugsAEjecutar = flags.filter(f => MODOS[f])
        if (slugsAEjecutar.length === 0) {
            console.error('❌ Modo no reconocido. Usa: --mercadona, --carrefour, --dia, --alcampo, --consum, --eroski, --lidl, --all')
            process.exit(1)
        }
    } else {
        slugsAEjecutar = ['mercadona'] // default
    }

    console.log('═══════════════════════════════════════════════')
    console.log('  🛒  NutriCoach · Scraping de Supermercados')
    console.log(`  Modo: ${slugsAEjecutar.join(', ')}`)
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

    for (const slug of slugsAEjecutar) {
        const scrapeFn = MODOS[slug]
        if (scrapeFn) {
            try {
                await procesarSupermercado(slug, scrapeFn, smMap)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.error(`\n❌ Error crítico en "${slug}": ${msg}`)
                console.warn(`   ⏩ Continuando con el siguiente supermercado...\n`)
            }
        } else {
            console.warn(`⚠️  No hay scraper para "${slug}"`)
        }
    }

    const totalMs = Date.now() - inicioTotal
    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  ✅ Scraping completado en ${(totalMs / 1000 / 60).toFixed(1)} min (${(totalMs / 1000).toFixed(0)}s)`)
    console.log(`═══════════════════════════════════════════════`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})

/**
 * lidl.ts — Scraper para Lidl España v4 (híbrido: Playwright DOM + gridboxes API)
 *
 * ESTRATEGIA:
 *   Fase 1 — Playwright (lotes de 15): busca por términos, extrae URLs → erpNumbers
 *   Fase 2 — HTTP gridboxes: precio real (price.price) + categoría verificada
 *   Fase 3 — Filtro: solo categorías de alimentación (bricolaje/ropa/hogar → descartados)
 *
 * MEJORAS vs v3:
 *   - Precios desde gridboxes API (float exacto) en vez de parsing DOM poco fiable
 *   - Filtrado por categoría real → 0 falsos positivos (herramientas, electrodomésticos, etc.)
 *   - String IIFE en page.evaluate → corrige bug __name de tsx (arrow fn en browser ctx)
 *   - Browser se cierra al final de Fase 1; Fase 2 es HTTP puro (sin Playwright)
 *
 * API interna confirmada 16-05-2026:
 *   /p/api/gridboxes/ES/es?erpNumbers=... → price.price (float), category="Food", fullTitle
 *   category="Food" para alimentos, "Categorías/Hogar y cocina/..." para no-alimentos
 *   brand = { name?, url?, showBrand }, price.packaging.text = "500 g" / "8x125 g"
 *   Requiere cookies de sesión + Accept-Encoding gzip (Node 18 fetch lo maneja auto)
 *
 * Web: https://www.lidl.es/
 */
import type { ProductoRaw } from '../types'
import { chromium, type Browser } from 'playwright'

const URL_BASE = 'https://www.lidl.es'
const GRIDBOXES_API = `${URL_BASE}/p/api/gridboxes/ES/es`

const TERMINOS_POR_LOTE = 15
const TIMEOUT_PAGINA_MS = 20_000
const PAUSA_ENTRE_TERMINOS_MS = 600
const PAUSA_ENTRE_LOTES_MS = 2_000
const GRIDBOXES_BATCH_SIZE = 25

/* ─── Términos de búsqueda — priorizados por productividad ─── */
const TERMINOS_BUSQUEDA = [
    // Alta productividad (según historial v2/v3)
    'leche', 'pollo', 'pan', 'arroz', 'aceite', 'café', 'yogur', 'queso',
    'chocolate', 'pasta', 'galletas', 'salsa', 'huevos', 'jamón',
    // Media
    'salmón', 'atún', 'congelados', 'helado', 'verduras congeladas',
    'agua', 'zumo', 'refresco', 'vino', 'cerveza',
    'manzana', 'plátano', 'naranja', 'fresas',
    'ternera', 'cerdo', 'pavo',
    'legumbres', 'lentejas', 'garbanzos',
    'harina', 'cacao', 'miel',
    'merluza', 'pescado', 'gambas',
    // Baja (específicos)
    'sal', 'azúcar', 'vinagre', 'especias',
    'patata', 'cebolla', 'zanahoria',
    'infusiones', 'tomate', 'lechuga',
    'pizza', 'nata', 'mantequilla',
    'cordero', 'conservas',
    'frutos secos', 'mermelada', 'caldo', 'crema de cacao', 'cereales',
]

/* ─── Categorías de alimentación ─── */
// Lidl devuelve category="Food" para todos los alimentos.
// Para no-alimentos usa rutas como "Categorías/Hogar y cocina/..."
const CATEGORIAS_ALIM_FALLBACK = [
    'alimentaci', 'food', 'frutas', 'verduras', 'carnes', 'aves', 'pescados', 'mariscos',
    'lácteos', 'lacteos', 'bebidas', 'panadería', 'panaderia', 'congelados',
    'conservas', 'cereales', 'snacks', 'dulces', 'café', 'cafe', 'aceites',
    'salsas', 'especias', 'legumbres', 'huevos', 'embutidos', 'charcuter',
    'pastelería', 'pasteleria', 'helados', 'ultracongelados', 'frescos',
]

function esCategoriaAlimentacion(category: string | undefined): boolean {
    if (!category) return false
    const cat = category.toLowerCase().trim()
    // Caso principal: Lidl devuelve "Food" exacto para alimentos
    if (cat === 'food') return true
    // Fallback: paths en español o keywords
    return CATEGORIAS_ALIM_FALLBACK.some(k => cat.includes(k))
}

function extraerErpNumber(url: string): string | null {
    // URL format: /p/nombre-producto/p100398189 o .../p100398189?param=x
    const match = url.match(/\/p(\d{6,12})(?:[?#/]|$)/)
    return match ? match[1] : null
}

/* ─── Gridboxes API ─── */

interface GridboxBrand {
    name?: string
    url?: string
    showBrand?: boolean
}

interface GridboxPrice {
    price?: number
    pricePerUnit?: number
    packaging?: { text?: string }
    currencySymbol?: string
    oldPrice?: number
}

interface GridboxProduct {
    erpNumber?: string
    fullTitle?: string
    title?: string
    price?: GridboxPrice
    category?: string
    image?: string
    canonicalPath?: string
    canonicalUrl?: string
    brand?: GridboxBrand
}

async function fetchGridboxes(erpNumbers: string[], cookieHeader: string): Promise<GridboxProduct[]> {
    if (!erpNumbers.length) return []
    try {
        const resp = await fetch(`${GRIDBOXES_API}?erpNumbers=${erpNumbers.join(',')}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Cookie': cookieHeader,
                'Referer': 'https://www.lidl.es/',
                'Origin': 'https://www.lidl.es',
            },
        })
        if (!resp.ok) {
            console.warn(`[Lidl Gridboxes] HTTP ${resp.status} para ${erpNumbers.length} erpNumbers`)
            return []
        }
        const data = await resp.json() as unknown
        if (Array.isArray(data)) return data as GridboxProduct[]
        if (data && typeof data === 'object') {
            for (const key of ['products', 'items', 'gridboxes', 'data', 'results']) {
                const val = (data as Record<string, unknown>)[key]
                if (Array.isArray(val)) return val as GridboxProduct[]
            }
            console.warn('[Lidl Gridboxes] Formato inesperado:', JSON.stringify(data).substring(0, 300))
        }
        return []
    } catch (err) {
        console.warn('[Lidl Gridboxes] Error:', err instanceof Error ? err.message : String(err))
        return []
    }
}

/* ─── Fase 1: Playwright por lotes ─── */

interface DomProduct {
    nombre: string
    url: string
    imagen: string
}

async function procesarLote(
    terminos: string[],
    loteIndex: number,
    totalLotes: number,
): Promise<{ erpMap: Map<string, DomProduct>; cookieHeader: string; errores: string[] }> {
    const erpMap = new Map<string, DomProduct>()
    const errores: string[] = []
    let browser: Browser | null = null
    let cookieHeader = ''

    try {
        console.log(`[Lidl Lote ${loteIndex}/${totalLotes}] Lanzando navegador (${terminos.length} términos)...`)
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })
        const page = await context.newPage()
        page.setDefaultTimeout(TIMEOUT_PAGINA_MS)

        await page.goto(URL_BASE + '/', { waitUntil: 'domcontentloaded', timeout: TIMEOUT_PAGINA_MS }).catch(() => {})
        await page.waitForTimeout(2000)

        // Capturar cookies para Fase 2 (solo del primer lote)
        const cookies = await context.cookies()
        cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')

        for (let i = 0; i < terminos.length; i++) {
            const termino = terminos[i]
            const global = (loteIndex - 1) * TERMINOS_POR_LOTE + i + 1
            console.log(`[Lidl] [${global}/${TERMINOS_BUSQUEDA.length}] "${termino}"`)

            try {
                await page.goto(`${URL_BASE}/q/search?q=${encodeURIComponent(termino)}`, {
                    waitUntil: 'domcontentloaded',
                    timeout: TIMEOUT_PAGINA_MS,
                }).catch(() => {})
                await page.waitForTimeout(1500)

                // String IIFE — evita bug __name de tsx (arrow functions no se pueden serializar al browser context)
                await page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                await page.waitForTimeout(800)

                const items = await page.evaluate<DomProduct[]>(`
                    (function() {
                        var results = [];
                        var selectors = [
                            '.product-grid-box',
                            '.odsc-tile',
                            '.ods-tile',
                            '[class*="product-grid"] > li',
                            '[class*="product-grid"] > div',
                        ];
                        var tiles = [];
                        for (var s = 0; s < selectors.length; s++) {
                            var found = document.querySelectorAll(selectors[s]);
                            if (found.length > 0) { tiles = Array.prototype.slice.call(found); break; }
                        }
                        tiles.forEach(function(tile) {
                            var linkEl = tile.querySelector('a[href*="/p/"]');
                            if (!linkEl) return;
                            var href = linkEl.href || '';
                            if (!href.match(/\\/p\\d{6,12}(?:[?#\\/]|$)/)) return;
                            var titleEl = tile.querySelector(
                                '.product-grid-box__title, [class*="product-title"], [class*="title"], h3, h2'
                            );
                            var nombre = titleEl ? titleEl.textContent.trim() : (linkEl.title || linkEl.textContent.trim() || '');
                            if (!nombre) return;
                            var imgEl = tile.querySelector('img');
                            var img = imgEl
                                ? (imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('data-lazy') || '')
                                : '';
                            results.push({ nombre: nombre, url: href, imagen: img });
                        });
                        return results;
                    })()
                `)

                let nuevos = 0
                for (const item of items) {
                    const erp = extraerErpNumber(item.url)
                    if (erp && !erpMap.has(erp)) {
                        erpMap.set(erp, item)
                        nuevos++
                    }
                }
                console.log(`[Lidl]   → ${items.length} tiles, ${nuevos} nuevos erpNumbers`)

                if (i < terminos.length - 1) {
                    await new Promise(r => setTimeout(r, PAUSA_ENTRE_TERMINOS_MS))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message.substring(0, 100) : String(err)
                errores.push(`"${termino}": ${msg}`)
                console.warn(`[Lidl]   ❌ ${msg}`)
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Lote ${loteIndex}: ${msg}`)
        console.error(`[Lidl Lote ${loteIndex}] Error:`, msg)
    } finally {
        if (browser) await browser.close().catch(() => {})
    }

    return { erpMap, cookieHeader, errores }
}

/* ─── Scraper principal ─── */

export async function scrapearLidl(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const allErpMap = new Map<string, DomProduct>()
    const allErrores: string[] = []
    let cookieHeader = ''

    // Dividir en lotes
    const lotes: string[][] = []
    for (let i = 0; i < TERMINOS_BUSQUEDA.length; i += TERMINOS_POR_LOTE) {
        lotes.push(TERMINOS_BUSQUEDA.slice(i, i + TERMINOS_POR_LOTE))
    }

    console.log(`\n[Lidl] 🚀 v4 (híbrido) — ${TERMINOS_BUSQUEDA.length} términos en ${lotes.length} lotes + gridboxes API`)

    // ══ Fase 1: Playwright DOM search ══
    for (let l = 0; l < lotes.length; l++) {
        console.log(`\n╔═══ LOTE ${l + 1}/${lotes.length} ═══╗`)
        const { erpMap, cookieHeader: ck, errores } = await procesarLote(lotes[l], l + 1, lotes.length)

        for (const [erp, dom] of erpMap) {
            if (!allErpMap.has(erp)) allErpMap.set(erp, dom)
        }
        if (ck) cookieHeader = ck   // capturar cookies del primer lote
        allErrores.push(...errores)

        console.log(`╚═══ LOTE ${l + 1}: ${erpMap.size} nuevos, acum ${allErpMap.size} erpNumbers ═══╝`)

        if (l < lotes.length - 1) {
            await new Promise(r => setTimeout(r, PAUSA_ENTRE_LOTES_MS))
        }
    }

    const allErps = Array.from(allErpMap.keys())
    console.log(`\n[Lidl] Fase 1 completada: ${allErps.length} erpNumbers únicos`)

    if (allErps.length === 0) {
        console.warn('[Lidl] Sin erpNumbers — el DOM search no encontró productos con URL /p/...')
        return { productos: [], errores: allErrores, duracion_ms: Date.now() - inicio }
    }

    // ══ Fase 2: Gridboxes API (HTTP puro) ══
    console.log(`[Lidl] Fase 2: Gridboxes API en lotes de ${GRIDBOXES_BATCH_SIZE}...`)

    const productos: ProductoRaw[] = []
    let alim = 0
    let descartados = 0
    let sinGridbox = 0

    for (let i = 0; i < allErps.length; i += GRIDBOXES_BATCH_SIZE) {
        const batchErps = allErps.slice(i, i + GRIDBOXES_BATCH_SIZE)
        const gridProducts = await fetchGridboxes(batchErps, cookieHeader)

        if (gridProducts.length === 0) {
            // Gridboxes no respondió — incluir con datos DOM (sin filtro de categoría)
            // El filtro NO_COMESTIBLE_KEYWORDS de index.ts actúa como segunda defensa
            for (const erp of batchErps) {
                const dom = allErpMap.get(erp)
                if (!dom?.nombre) continue
                sinGridbox++
                productos.push({
                    nombre: dom.nombre,
                    precio_actual: 0,
                    unidad: 'kg',
                    url_producto: dom.url,
                    imagen_url: dom.imagen || undefined,
                    marca: 'Lidl',
                    disponible: true,
                    categoria: 'lidl:alimentacion',
                })
            }
        } else {
            for (const gp of gridProducts) {
                const erp = gp.erpNumber || ''
                const dom = allErpMap.get(erp)
                const cat = gp.category || ''

                if (!esCategoriaAlimentacion(cat)) {
                    descartados++
                    continue
                }

                alim++
                const nombre = gp.fullTitle || gp.title || dom?.nombre || ''
                if (!nombre) continue

                const canonUrl = gp.canonicalPath
                    ? URL_BASE + gp.canonicalPath
                    : gp.canonicalUrl
                        ? (gp.canonicalUrl.startsWith('http') ? gp.canonicalUrl : URL_BASE + gp.canonicalUrl)
                        : dom?.url || ''

                // category="Food" → subcategoria genérica; path completo → última sección
                const subcategoria = cat === 'Food' ? 'alimentacion'
                    : cat.split('/').pop()?.toLowerCase().replace(/\s+/g, '-') || 'alimentacion'

                productos.push({
                    nombre,
                    precio_actual: gp.price?.price ?? 0,
                    precio_por_kg: gp.price?.pricePerUnit ?? undefined,
                    unidad: 'kg',
                    url_producto: canonUrl,
                    imagen_url: gp.image || dom?.imagen || undefined,
                    marca: gp.brand?.name || 'Lidl',
                    cantidad: gp.price?.packaging?.text ?? undefined,
                    disponible: true,
                    categoria: `lidl:${subcategoria}`,
                })
            }
        }

        const loteNum = Math.ceil((i + GRIDBOXES_BATCH_SIZE) / GRIDBOXES_BATCH_SIZE)
        const totalLotes = Math.ceil(allErps.length / GRIDBOXES_BATCH_SIZE)
        console.log(`[Lidl]   Gridboxes ${loteNum}/${totalLotes}: alim=${alim}, descartados=${descartados}`)
        await new Promise(r => setTimeout(r, 150))
    }

    if (sinGridbox > 0) {
        console.warn(`[Lidl] ${sinGridbox} productos sin categoría (gridboxes no respondió para su lote)`)
    }
    console.log(`\n[Lidl] ✅ Completado: ${productos.length} productos (${alim} verificados + ${sinGridbox} sin cat, ${descartados} descartados) en ${Date.now() - inicio}ms`)

    return { productos, errores: allErrores, duracion_ms: Date.now() - inicio }
}

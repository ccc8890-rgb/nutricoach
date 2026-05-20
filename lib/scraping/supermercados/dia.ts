/**
 * dia.ts — Scraper para Día España v2
 *
 * ✅ REESCRITO 20-05-2026 v2: SSR directo via HTTP, sin Playwright
 *
 * Día usa Akamai WAF que bloquea cualquier headless browser (Playwright).
 * PERO responde a peticiones HTTP directas con User-Agent real, devolviendo
 * el HTML renderizado vía SSR con datos de producto incrustados en JSON.
 *
 * Estrategia:
 *   - HTTP directo con fetch (User-Agent real)
 *   - Extraer JSON de productos del HTML SSR vía regex
 *   - 13 categorías predefinidas con paginación (?page=N)
 *   - Sin Playwright, sin Chromium, sin memory leaks
 *
 * Web: https://www.dia.es/compra-online/
 */

import type { ProductoRaw } from '../types'

// ── Config ──

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

interface CategoriaDia {
    id: string
    slug: string
    name: string
}

const CATEGORIAS: CategoriaDia[] = [
    { id: 'AL00', slug: 'alimentacion', name: 'Alimentación' },
    { id: 'AL01', slug: 'leches-y-postres', name: 'Leches y Postres' },
    { id: 'AL02', slug: 'huevos', name: 'Huevos' },
    { id: 'AL03', slug: 'aceite', name: 'Aceite' },
    { id: 'AL04', slug: 'arroz-pasta-legumbres', name: 'Arroz, Pasta y Legumbres' },
    { id: 'AL05', slug: 'pan-panaderia', name: 'Pan y Panadería' },
    { id: 'AL06', slug: 'cereales-y-galletas', name: 'Cereales y Galletas' },
    { id: 'AL07', slug: 'chocolates-y-dulces', name: 'Chocolates y Dulces' },
    { id: 'AL08', slug: 'conservas', name: 'Conservas' },
    { id: 'AL09', slug: 'congelados', name: 'Congelados' },
    { id: 'AL10', slug: 'bebidas', name: 'Bebidas' },
    { id: 'AL11', slug: 'salsas-especias', name: 'Salsas y Especias' },
    { id: 'AL12', slug: 'frutos-secos', name: 'Frutos Secos' },
]

const MAX_PAGINAS = 10          // Máximo de páginas por categoría
const RATE_LIMIT_MS = 800       // ms entre peticiones

// ── Interfaces de la API SSR ──

interface DiaSSRProduct {
    brand: string
    display_name: string
    image: string
    prices: {
        currency: string
        price: number
        price_per_unit: number
        measure_unit: string
        is_promo_price: boolean
    }
    sku_id: string
    url: string
}

// ── Mapeo ──

function mapearProducto(p: DiaSSRProduct, categoria: string): ProductoRaw {
    return {
        nombre: p.display_name,
        precio_actual: p.prices.price,
        precio_por_kg: p.prices.price_per_unit || undefined,
        unidad: p.prices.measure_unit === 'KILO' ? 'kg' : 'unidad',
        url_producto: p.url.startsWith('http') ? p.url : `https://www.dia.es${p.url}`,
        imagen_url: p.image
            ? (p.image.startsWith('http') ? p.image : `https://www.dia.es${p.image}`)
            : undefined,
        marca: p.brand || 'Día',
        cantidad: undefined,
        disponible: true,
        categoria,
    }
}

// ── Extracción JSON del HTML SSR ──

/**
 * Busca "products": en el HTML y extrae el array JSON balanceando corchetes.
 * Día renderiza los productos vía SSR en JSON incrustado en el HTML.
 * El patrón es: "products":[{"brand":"...", ...}]
 */
function extraerProductos(html: string): DiaSSRProduct[] {
    const PRODUCTS_MARKER = '"products"'
    const idx = html.indexOf(PRODUCTS_MARKER)
    if (idx === -1) return []

    // Buscar el '[' después de "products":
    const startIdx = html.indexOf('[', idx + PRODUCTS_MARKER.length)
    if (startIdx === -1) return []

    // Balancear corchetes para encontrar el cierre del array
    let depth = 0
    let endIdx = -1
    for (let i = startIdx; i < html.length; i++) {
        if (html[i] === '[') depth++
        else if (html[i] === ']') {
            depth--
            if (depth === 0) {
                endIdx = i
                break
            }
        }
    }

    if (endIdx === -1) return []

    const jsonStr = html.slice(startIdx, endIdx + 1)
    if (jsonStr.length < 10) return []

    try {
        return JSON.parse(jsonStr) as DiaSSRProduct[]
    } catch {
        return []
    }
}

// ── Petición HTTP a una categoría ──

async function fetchCategoria(cat: CategoriaDia, pagina: number): Promise<{ productos: DiaSSRProduct[]; hasNext: boolean }> {
    const url = `https://www.dia.es/compra-online/${cat.slug}/c/${cat.id}?page=${pagina}`

    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Referer': 'https://www.dia.es/compra-online/',
        },
        signal: AbortSignal.timeout(30000),
    })

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} para ${url}`)
    }

    const html = await response.text()

    // Detectar si hay página siguiente
    const hasNext = html.includes(`page=${pagina + 1}`) ||
        html.includes(`page\\u003d${pagina + 1}`)

    const productos = extraerProductos(html)
    return { productos, hasNext }
}

// ── Scraper principal ──

export async function scrapearDia(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    for (let i = 0; i < CATEGORIAS.length; i++) {
        const cat = CATEGORIAS[i]
        console.log(`[Día v2] Categoría ${i + 1}/${CATEGORIAS.length}: ${cat.name} (${cat.slug})`)

        let pagina = 1
        let productosCat = 0

        while (pagina <= MAX_PAGINAS) {
            await new Promise(r => setTimeout(r, RATE_LIMIT_MS))

            try {
                const { productos: prods, hasNext } = await fetchCategoria(cat, pagina)
                if (prods.length === 0) break  // Sin más productos

                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                productosCat += prods.length
                console.log(`[Día v2]   Página ${pagina}: ${prods.length} productos`)

                if (!hasNext) break
                pagina++
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en ${cat.name} página ${pagina}: ${msg}`)
                console.warn(`[Día v2]   ❌ Página ${pagina}: ${msg}`)
                break
            }
        }

        console.log(`[Día v2]   → ${productosCat} productos en total`)
    }

    console.log(`[Día v2] ${productos.length} productos totales, ${errores.length} errores`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

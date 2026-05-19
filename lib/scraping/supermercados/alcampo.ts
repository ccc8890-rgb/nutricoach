/**
 * alcampo.ts — Scraper para Alcampo España
 *
 * Alcampo migró a plataforma Ocado Technology.
 * API REST funcional descubierta en www.compraonline.alcampo.es:
 *   - Sugerencias: GET /api/search/v1/suggestions/primary?searchTerm={q}
 *   - Productos:   GET /api/webproductpagews/v5/product-pages
 *   - GraphQL:     POST /graphql
 *
 * La API necesita regionId. Se obtiene de la página principal.
 * También usa GraphQL para ciertas operaciones.
 *
 * ⚠️ NOTA: La API devuelve los precios como objetos {amount, currency}
 * y no como números planos. El mapper extrae `amount` como string y lo
 * convierte a número.
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

export const configAlcampo: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Alcampo',
        slug: 'alcampo',
    },
    metodo: 'api_http',
    url_base: 'https://www.compraonline.alcampo.es',
    categorias_endpoint: '/api/search/v1/suggestions/primary',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
    },
    rate_limit_ms: 500,
    timeout_ms: 15000,
}

/* ─── Interfaces reales de la API Ocado ─── */

interface AlcampoPrice {
    amount: string
    currency: string
}

interface AlcampoUnitPrice {
    price: AlcampoPrice
    unit: string
}

interface AlcampoProductData {
    productId: string
    retailerProductId: string
    name?: string
    brand?: string
    /** La API devuelve {amount: "1.80", currency: "EUR"} */
    price?: AlcampoPrice | number
    /** Precio por unidad (kg/L) */
    unitPrice?: AlcampoUnitPrice
    /** Imagen del producto */
    image?: { src?: string }
    /** Ruta de categoría */
    categoryPath?: string[]
    packaging?: string
    available?: boolean
    packSizeDescription?: string
}

interface AlcampoProductPage {
    productId: string
    product: AlcampoProductData
}

interface AlcampoProductGroupsResponse {
    productGroups: {
        type: string
        products: AlcampoProductPage[]
    }[]
}

/* ─── Helpers ─── */

/** Extrae el valor numérico de un precio que puede ser objeto {amount, currency} o número directo */
function extraerPrecio(p: AlcampoPrice | number | undefined): number {
    if (p === undefined || p === null) return 0
    if (typeof p === 'number') return p
    // Es objeto {amount, currency}
    const val = parseFloat(String(p.amount).replace(',', '.'))
    return isNaN(val) ? 0 : val
}

/** Extrae precio por kg desde unitPrice */
function extraerPrecioPorKg(unitPrice: AlcampoUnitPrice | undefined): number | undefined {
    if (!unitPrice?.price?.amount) return undefined
    const val = parseFloat(String(unitPrice.price.amount).replace(',', '.'))
    return isNaN(val) ? undefined : val
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            ...configAlcampo.headers,
        },
    })
    if (!res.ok) {
        throw new Error(`Alcampo HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: AlcampoProductData, categoria?: string): ProductoRaw {
    const precio = extraerPrecio(p.price)
    const precioPorKg = p.unitPrice ? extraerPrecioPorKg(p.unitPrice) : undefined

    // Construir URL desde productId o retailerProductId
    const productId = p.productId || p.retailerProductId
    const url_producto = productId
        ? `https://www.compraonline.alcampo.es/product/${productId}`
        : ''

    return {
        nombre: p.name || '',
        precio_actual: precio,
        precio_por_kg: precioPorKg,
        unidad: p.unitPrice?.unit?.replace('fop.price.per.', '') || 'kg',
        url_producto,
        imagen_url: p.image?.src || undefined,
        marca: p.brand || 'Alcampo',
        cantidad: p.packSizeDescription || p.packaging || undefined,
        disponible: p.available !== false,
        categoria: categoria || p.categoryPath?.join(' > '),
    }
}

/* ─── Palabras de búsqueda para categorías de alimentos ─── */

const CATEGORIAS_BUSQUEDA = [
    'leche', 'huevos', 'pan', 'arroz', 'pasta', 'aceite oliva',
    'legumbres', 'lentejas', 'garbanzos', 'judías',
    'arroz integral', 'quinoa',
    'atún', 'salmón', 'merluza', 'pollo', 'ternera', 'cerdo',
    'jamón serrano', 'jamón ibérico', 'lomo embutido', 'chorizo',
    'queso', 'yogur', 'mantequilla', 'nata',
    'tomate frito', 'salsa',
    'fruta fresca', 'manzana', 'plátano', 'naranja',
    'verdura', 'lechuga', 'tomate', 'cebolla', 'ajo', 'patata',
    'brócoli', 'coliflor', 'espinacas',
    'agua mineral', 'refresco', 'zumo', 'cerveza', 'vino',
    'café', 'té', 'infusiones', 'cacao',
    'galletas', 'cereales', 'avena', 'muesli',
    'miel', 'mermelada',
    'frutos secos', 'almendras', 'nueces',
    'chocolate',
    'harina', 'azúcar', 'sal', 'vinagre', 'especia',
    'caldo', 'sopa',
    'conserva', 'aceituna',
    'congelados',
    'pan molde', 'pan tostado',
    'fiambre pavo', 'fiambre pollo',
]

/* ─── Lógica principal ─── */

export async function scrapearAlcampo(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    const vistos = new Set<string>()

    try {
        // 1. Obtener la página principal para extraer regionId
        console.log('[Alcampo] Obteniendo página principal...')
        const homeRes = await fetch(configAlcampo.url_base, {
            signal: AbortSignal.timeout(configAlcampo.timeout_ms),
            headers: configAlcampo.headers,
        })
        const homeHtml = await homeRes.text()

        // Extraer regionId del HTML (búsqueda simple)
        const regionMatch = homeHtml.match(/regionId[=:]["']?([a-f0-9-]{36})/i)
        const regionId = regionMatch?.[1] || 'ac90d761-9d58-4918-a37d-dd14e1ce384a'
        console.log(`[Alcampo] Region ID: ${regionId}`)

        // 2. Obtener sugerencias de categorías/búsquedas populares
        console.log('[Alcampo] Obteniendo sugerencias de búsqueda...')
        const sugerencias = await fetchJSON<string[]>(
            `${configAlcampo.url_base}/api/search/v1/suggestions/primary?searchTerm=&limit=50&regionId=${regionId}`,
            configAlcampo.timeout_ms
        )
        console.log(`[Alcampo] ${sugerencias.length} sugerencias obtenidas`)

        // 3. Buscar productos por categorías predefinidas
        const categorias = [...new Set([...CATEGORIAS_BUSQUEDA, ...(Array.isArray(sugerencias) ? sugerencias : [])])]
        console.log(`[Alcampo] Buscando en ${categorias.length} términos...`)

        for (let i = 0; i < categorias.length; i++) {
            const term = categorias[i]
            await new Promise(r => setTimeout(r, configAlcampo.rate_limit_ms))

            try {
                const result = await fetchJSON<AlcampoProductGroupsResponse>(
                    `${configAlcampo.url_base}/api/webproductpagews/v5/product-pages?decoratedOnly=true&limit=50&searchTerm=${encodeURIComponent(term)}&tag=web`,
                    configAlcampo.timeout_ms
                )

                const groups = result.productGroups || []
                for (const group of groups) {
                    const prods = group.products || []
                    for (const page of prods) {
                        if (!page.product?.name) continue
                        const key = page.product.productId || page.product.name
                        if (vistos.has(key)) continue
                        vistos.add(key)
                        productos.push(mapearProducto(page.product, term))
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en búsqueda "${term}": ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Alcampo] ${i}/${categorias.length} búsquedas — ${productos.length} productos`)
            }
        }

        console.log(`[Alcampo] ${productos.length} productos totales (${vistos.size} únicos)`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Alcampo] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

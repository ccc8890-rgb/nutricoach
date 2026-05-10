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

/* ─── Interfaces ─── */

interface AlcampoProductPage {
    productId: string
    product: {
        productId: string
        retailerProductId: string
        name?: string
        brand?: string
        price?: number
        pricePerKg?: number
        unit?: string
        imageUrl?: string
        url?: string
        packaging?: string
        available?: boolean
    }
}

interface AlcampoProductPagesResponse {
    productGroups: {
        type: string
        products: AlcampoProductPage[]
    }[]
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

function mapearProducto(p: AlcampoProductPage['product'], categoria?: string): ProductoRaw {
    return {
        nombre: p.name || '',
        precio_actual: p.price || 0,
        precio_por_kg: p.pricePerKg,
        unidad: p.unit || 'kg',
        url_producto: p.url || '',
        imagen_url: p.imageUrl || undefined,
        marca: p.brand || 'Alcampo',
        cantidad: p.packaging || undefined,
        disponible: p.available !== false,
        categoria,
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
                const result = await fetchJSON<AlcampoProductPagesResponse>(
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

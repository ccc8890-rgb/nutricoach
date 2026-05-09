/**
 * carrefour.ts — Scraper para Carrefour España
 *
 * API pública de Carrefour:
 * - Catálogo: GET https://www.carrefour.es/api/categories/v1/
 * - Productos por categoría: GET https://www.carrefour.es/api/products/v1/category/{id}
 * - Búsqueda: GET https://www.carrefour.es/api/search/v1/?q={query}
 *
 * Nota: Carrefour tiene rate limiting, usar delays generosos.
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

export const configCarrefour: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Carrefour',
        slug: 'carrefour',
    },
    metodo: 'api_http',
    url_base: 'https://www.carrefour.es',
    categorias_endpoint: '/api/categories/v1/',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rate_limit_ms: 500,
    timeout_ms: 15000,
}

/* ─── Interfaces ─── */

interface CarrefourCategory {
    id: string
    name: string
    subcategories?: CarrefourCategory[]
    productCount?: number
}

interface CarrefourProduct {
    id: string
    name: string
    displayName?: string
    price: number
    pricePerKg?: number
    referencePrice?: string
    url: string
    image: string
    brand?: string
    packaging?: string
    available: boolean
}

interface CarrefourApiResponse<T> {
    data: T
    total?: number
    page?: number
    pageSize?: number
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: configCarrefour.headers,
    })
    if (!res.ok) {
        throw new Error(`Carrefour HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: CarrefourProduct): ProductoRaw {
    const precioKg = p.pricePerKg || (p.referencePrice ? parseFloat(p.referencePrice.replace(',', '.')) : undefined)

    return {
        nombre: p.displayName || p.name,
        precio_actual: p.price,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: p.url.startsWith('http') ? p.url : `https://www.carrefour.es${p.url}`,
        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
        marca: p.brand || 'Carrefour',
        cantidad: p.packaging,
        disponible: p.available,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearCarrefour(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        // 1. Obtener categorías principales
        console.log('[Carrefour] Obteniendo categorías...')
        const categoriasRaw = await fetchJSON<CarrefourApiResponse<CarrefourCategory[]>>(
            `${configCarrefour.url_base}${configCarrefour.categorias_endpoint}`,
            configCarrefour.timeout_ms
        )
        const categorias = categoriasRaw.data || []

        // 2. Extraer subcategorías con productos
        const subCategorias: { id: string; name: string }[] = []
        for (const cat of categorias) {
            if (cat.subcategories) {
                for (const sub of cat.subcategories) {
                    if (sub.productCount && sub.productCount > 0) {
                        subCategorias.push({ id: sub.id, name: sub.name })
                    }
                }
            }
        }

        console.log(`[Carrefour] ${subCategorias.length} subcategorías con productos`)

        // 3. Fetch productos de cada subcategoría
        for (let i = 0; i < subCategorias.length; i++) {
            const sub = subCategorias[i]
            await new Promise(r => setTimeout(r, configCarrefour.rate_limit_ms))

            try {
                const prodsRaw = await fetchJSON<CarrefourApiResponse<CarrefourProduct[]>>(
                    `${configCarrefour.url_base}/api/products/v1/category/${sub.id}?pageSize=100`,
                    configCarrefour.timeout_ms
                )
                const prods = prodsRaw.data || []
                for (const p of prods) {
                    productos.push(mapearProducto(p))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${sub.name} (${sub.id}): ${msg}`)
            }

            if (i > 0 && i % 5 === 0) {
                console.log(`[Carrefour] ${i}/${subCategorias.length} categorías — ${productos.length} productos`)
            }
        }

        console.log(`[Carrefour] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Carrefour] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * alcampo.ts — Scraper para Alcampo España
 *
 * Alcampo tiene API REST con catálogo de productos.
 * También usamos Playwright como fallback.
 *
 * API: https://www.alcampo.es/
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
    url_base: 'https://www.alcampo.es',
    categorias_endpoint: '/api/rest/v1/categories',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rate_limit_ms: 400,
    timeout_ms: 15000,
}

/* ─── Interfaces ─── */

interface AlcampoCategory {
    id: string
    name: string
    subcategories?: AlcampoCategory[]
}

interface AlcampoProduct {
    id: string
    name: string
    price: number
    pricePerKg?: number
    referencePrice?: string
    image: string
    url: string
    brand?: string
    packaging?: string
    available: boolean
}

interface AlcampoResponse<T> {
    data: T[]
    pagination?: {
        total: number
        page: number
        pages: number
    }
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: configAlcampo.headers,
    })
    if (!res.ok) {
        throw new Error(`Alcampo HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: AlcampoProduct): ProductoRaw {
    const precioKg = p.pricePerKg || (p.referencePrice ? parseFloat(p.referencePrice.replace(',', '.')) : undefined)

    return {
        nombre: p.name,
        precio_actual: p.price,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: p.url.startsWith('http') ? p.url : `https://www.alcampo.es${p.url}`,
        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
        marca: p.brand || 'Alcampo',
        cantidad: p.packaging,
        disponible: p.available,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearAlcampo(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        // 1. Obtener categorías
        console.log('[Alcampo] Obteniendo categorías...')
        const catsRaw = await fetchJSON<AlcampoResponse<AlcampoCategory>>(
            `${configAlcampo.url_base}${configAlcampo.categorias_endpoint}`,
            configAlcampo.timeout_ms
        )
        const categorias = catsRaw.data || []

        // 2. Extraer categorías hoja
        const leafCats: { id: string; name: string }[] = []
        const extractSubs = (cats: AlcampoCategory[]) => {
            for (const c of cats) {
                if (c.subcategories && c.subcategories.length > 0) {
                    extractSubs(c.subcategories)
                } else {
                    leafCats.push({ id: c.id, name: c.name })
                }
            }
        }
        extractSubs(categorias)
        console.log(`[Alcampo] ${leafCats.length} categorías hoja`)

        // 3. Fetch productos
        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await new Promise(r => setTimeout(r, configAlcampo.rate_limit_ms))

            try {
                const prodsRaw = await fetchJSON<AlcampoResponse<AlcampoProduct>>(
                    `${configAlcampo.url_base}/api/rest/v1/categories/${cat.id}/products?pageSize=100`,
                    configAlcampo.timeout_ms
                )
                const prods = prodsRaw.data || []
                for (const p of prods) {
                    productos.push(mapearProducto(p))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Alcampo] ${i}/${leafCats.length} — ${productos.length} productos`)
            }
        }

        console.log(`[Alcampo] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Alcampo] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

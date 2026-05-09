/**
 * consum.ts — Scraper para Consum España
 *
 * Consum tiene API REST.
 * API base: https://tienda.consum.es/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

export const configConsum: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Consum',
        slug: 'consum',
    },
    metodo: 'api_http',
    url_base: 'https://tienda.consum.es',
    categorias_endpoint: '/api/rest/v1/categories',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rate_limit_ms: 400,
    timeout_ms: 15000,
}

/* ─── Interfaces ─── */

interface ConsumCategory {
    id: string
    name: string
    subcategories?: ConsumCategory[]
}

interface ConsumProduct {
    id: string
    name: string
    price: number
    unitPrice?: number
    referencePrice?: string
    image: string
    url: string
    brand?: string
    packaging?: string
    available: boolean
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: configConsum.headers,
    })
    if (!res.ok) {
        throw new Error(`Consum HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: ConsumProduct): ProductoRaw {
    return {
        nombre: p.name,
        precio_actual: p.price,
        precio_por_kg: p.unitPrice || (p.referencePrice ? parseFloat(p.referencePrice.replace(',', '.')) : undefined),
        unidad: 'kg',
        url_producto: p.url.startsWith('http') ? p.url : `https://tienda.consum.es${p.url}`,
        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
        marca: p.brand || 'Consum',
        cantidad: p.packaging,
        disponible: p.available,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearConsum(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        console.log('[Consum] Obteniendo categorías...')
        const catsRaw = await fetchJSON<ConsumCategory[]>(
            `${configConsum.url_base}${configConsum.categorias_endpoint}`,
            configConsum.timeout_ms
        )
        const categorias = Array.isArray(catsRaw) ? catsRaw : []

        const leafCats: { id: string; name: string }[] = []
        const extractSubs = (cats: ConsumCategory[]) => {
            for (const c of cats) {
                if (c.subcategories && c.subcategories.length > 0) {
                    extractSubs(c.subcategories)
                } else {
                    leafCats.push({ id: c.id, name: c.name })
                }
            }
        }
        extractSubs(categorias)
        console.log(`[Consum] ${leafCats.length} categorías hoja`)

        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await new Promise(r => setTimeout(r, configConsum.rate_limit_ms))

            try {
                const prods = await fetchJSON<ConsumProduct[]>(
                    `${configConsum.url_base}/api/rest/v1/categories/${cat.id}/products?pageSize=100`,
                    configConsum.timeout_ms
                )
                const prodsList = Array.isArray(prods) ? prods : []
                for (const p of prodsList) {
                    productos.push(mapearProducto(p))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Consum] ${i}/${leafCats.length} — ${productos.length} productos`)
            }
        }

        console.log(`[Consum] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Consum] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

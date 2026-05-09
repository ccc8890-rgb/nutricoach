/**
 * eroski.ts — Scraper para Eroski España
 *
 * Eroski tiene API REST.
 * API base: https://supermercado.eroski.es/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

export const configEroski: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Eroski',
        slug: 'eroski',
    },
    metodo: 'api_http',
    url_base: 'https://supermercado.eroski.es',
    categorias_endpoint: '/api/categories',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rate_limit_ms: 400,
    timeout_ms: 15000,
}

/* ─── Interfaces ─── */

interface EroskiCategory {
    id: string
    name: string
    subcategories?: EroskiCategory[]
}

interface EroskiProduct {
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
        headers: configEroski.headers,
    })
    if (!res.ok) {
        throw new Error(`Eroski HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: EroskiProduct): ProductoRaw {
    const precioKg = p.unitPrice || (p.referencePrice ? parseFloat(p.referencePrice.replace(',', '.')) : undefined)

    return {
        nombre: p.name,
        precio_actual: p.price,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: p.url.startsWith('http') ? p.url : `https://supermercado.eroski.es${p.url}`,
        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
        marca: p.brand || 'Eroski',
        cantidad: p.packaging,
        disponible: p.available,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearEroski(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        console.log('[Eroski] Obteniendo categorías...')
        const catsRaw = await fetchJSON<EroskiCategory[]>(
            `${configEroski.url_base}${configEroski.categorias_endpoint}`,
            configEroski.timeout_ms
        )
        const categorias = Array.isArray(catsRaw) ? catsRaw : []

        const leafCats: { id: string; name: string }[] = []
        const extractSubs = (cats: EroskiCategory[]) => {
            for (const c of cats) {
                if (c.subcategories && c.subcategories.length > 0) {
                    extractSubs(c.subcategories)
                } else {
                    leafCats.push({ id: c.id, name: c.name })
                }
            }
        }
        extractSubs(categorias)
        console.log(`[Eroski] ${leafCats.length} categorías hoja`)

        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await new Promise(r => setTimeout(r, configEroski.rate_limit_ms))

            try {
                const prods = await fetchJSON<EroskiProduct[]>(
                    `${configEroski.url_base}/api/categories/${cat.id}/products?pageSize=100`,
                    configEroski.timeout_ms
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
                console.log(`[Eroski] ${i}/${leafCats.length} — ${productos.length} productos`)
            }
        }

        console.log(`[Eroski] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Eroski] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

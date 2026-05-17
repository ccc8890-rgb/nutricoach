/**
 * consum.ts — Scraper para Consum España
 *
 * Consum migró a SPA Angular en 2025.
 * API REST funcional descubierta en tienda.consum.es:
 *   - Categorías: GET /api/rest/V1.0/shopping/category/menu
 *   - Productos:  GET /api/rest/V1.0/catalog/product?categories={id}&limit=100&orderById=7
 *   - Producto:   GET /api/rest/V1.0/catalog/product/code/{code}
 *
 * La API devuelve árbol completo de categorías con subcategorías.
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
    categorias_endpoint: '/api/rest/V1.0/shopping/category/menu',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
    },
    rate_limit_ms: 300,
    timeout_ms: 15000,
}

/* ─── Interfaces de la API real ─── */

interface ConsumCategory {
    id: number
    nombre: string
    name: string
    iconUrl?: string
    type: number
    level: number
    subcategories?: ConsumCategory[]
}

interface ConsumProductResponse {
    totalCount: number
    totalRecipeCount: number
    hasMore: boolean
    products: ConsumProduct[]
}

interface ConsumProduct {
    id: number
    productType: number
    code: string
    ean: string
    type: string
    productData: {
        name: string
        brand?: { id: string; name: string }
        url: string
        imageURL?: string
        description?: string
        availability?: string
    }
    priceData?: {
        prices: {
            id: string
            value: {
                centAmount: number
                centUnitAmount?: number
            }
        }[]
        unitPriceUnitType?: string
        priceUnitType?: string
    }
    media?: { url: string; type: string }[]
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            ...configConsum.headers,
            Accept: 'application/json',
        },
    })
    if (!res.ok) {
        throw new Error(`Consum HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: ConsumProduct, categoria?: string): ProductoRaw {
    const d = p.productData || {}
    const pd = p.priceData

    // Extraer precio actual del priceData
    // ⚠️ El API de Consum (Commercetools) devuelve centAmount/centUnitAmount
    //    YA en euros (1.85 = 1.85€), NO en céntimos.
    //    NO dividir entre 100 — eso produciría precios 100× menores.
    let precioActual = 0
    let precioKg: number | undefined

    if (pd?.prices?.length) {
        const price = pd.prices.find(p => p.id === 'PRICE')
        if (price?.value?.centAmount) {
            precioActual = price.value.centAmount
        }
        // unitPrice (precio por kg) a veces viene en centUnitAmount
        const unitPrice = pd.prices.find(p => p.id === 'UNIT_PRICE' || p.id === 'PRICE')
        if (unitPrice?.value?.centUnitAmount && unitPrice.value.centUnitAmount !== price?.value?.centAmount) {
            precioKg = unitPrice.value.centUnitAmount
        }
        // Si no hay unit price separado y tenemos unitPriceUnitType, usar precioActual como precioKg
        if (!precioKg && pd.unitPriceUnitType) {
            precioKg = precioActual
        }
    }

    const url = d.url?.startsWith('http') ? d.url : undefined
    const imagen = d.imageURL?.startsWith('http') ? d.imageURL : undefined
    const marca = d.brand?.name || 'Consum'
    const disponible = d.availability !== '0'

    // Extraer cantidad de la descripción (ej: "Arroz Largo 1 Kg")
    let cantidad = d.description || ''
    // Si no hay descripción, intentar del unitPriceUnitType
    if (!cantidad && pd?.unitPriceUnitType) {
        cantidad = pd.unitPriceUnitType
    }

    return {
        nombre: d.name || '',
        precio_actual: precioActual,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: url || '',
        imagen_url: imagen,
        marca,
        cantidad,
        disponible,
        categoria,
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
        console.log('[Consum] Obteniendo árbol de categorías...')
        const catsRaw = await fetchJSON<ConsumCategory[]>(
            `${configConsum.url_base}${configConsum.categorias_endpoint}`,
            configConsum.timeout_ms
        )
        const categorias = Array.isArray(catsRaw) ? catsRaw : []
        console.log(`[Consum] ${categorias.length} categorías principales`)

        // Extraer categorías hoja (sin subcategorías)
        const leafCats: { id: number; name: string }[] = []
        const extractLeaves = (cats: ConsumCategory[]) => {
            for (const c of cats) {
                if (c.subcategories && c.subcategories.length > 0) {
                    extractLeaves(c.subcategories)
                } else {
                    leafCats.push({ id: c.id, name: c.name })
                }
            }
        }
        extractLeaves(categorias)
        console.log(`[Consum] ${leafCats.length} categorías hoja`)

        // Procesar cada categoría hoja
        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await new Promise(r => setTimeout(r, configConsum.rate_limit_ms))

            try {
                const result = await fetchJSON<ConsumProductResponse>(
                    `${configConsum.url_base}/api/rest/V1.0/catalog/product?limit=100&orderById=7&categories=${cat.id}`,
                    configConsum.timeout_ms
                )
                const prods = result.products || []
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Consum] ${i}/${leafCats.length} categorías — ${productos.length} productos`)
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

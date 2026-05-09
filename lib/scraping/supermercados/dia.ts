/**
 * dia.ts — Scraper para Día España
 *
 * Día tiene API REST pública accesible desde web.
 * También usamos Playwright como fallback para productos dinámicos.
 *
 * API: https://www.dia.es/api/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

export const configDia: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Día',
        slug: 'dia',
    },
    metodo: 'api_http',
    url_base: 'https://www.dia.es',
    categorias_endpoint: '/api/categories/v1/',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    rate_limit_ms: 500,
    timeout_ms: 15000,
}

/* ─── Interfaces ─── */

interface DiaCategory {
    id: string
    name: string
    children?: DiaCategory[]
}

interface DiaProduct {
    id: string
    name: string
    price: number
    previousPrice?: number
    pricePerKg?: string
    image: string
    url: string
    brand?: string
    packaging?: string
    available: boolean
}

interface DiaResponse<T> {
    items: T[]
    total: number
}

/* ─── Fetch helper ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: configDia.headers,
    })
    if (!res.ok) {
        throw new Error(`Día HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: DiaProduct): ProductoRaw {
    let precioKg: number | undefined
    if (p.pricePerKg) {
        const match = p.pricePerKg.match(/([\d,]+)/)
        if (match) {
            precioKg = parseFloat(match[1].replace(',', '.'))
        }
    }

    return {
        nombre: p.name,
        precio_actual: p.price,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: p.url.startsWith('http') ? p.url : `https://www.dia.es${p.url}`,
        imagen_url: p.image?.startsWith('http') ? p.image : undefined,
        marca: p.brand || 'Día',
        cantidad: p.packaging,
        disponible: p.available,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearDia(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        // 1. Obtener categorías
        console.log('[Día] Obteniendo categorías...')
        const catsRaw = await fetchJSON<DiaResponse<DiaCategory>>(
            `${configDia.url_base}${configDia.categorias_endpoint}`,
            configDia.timeout_ms
        )
        const categorias = catsRaw.items || []

        // 2. Extraer subcategorías con productos
        const leafCats: { id: string; name: string }[] = []
        const extractSubs = (cats: DiaCategory[]) => {
            for (const c of cats) {
                if (c.children && c.children.length > 0) {
                    extractSubs(c.children)
                } else {
                    leafCats.push({ id: c.id, name: c.name })
                }
            }
        }
        extractSubs(categorias)
        console.log(`[Día] ${leafCats.length} categorías hoja`)

        // 3. Fetch productos
        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await new Promise(r => setTimeout(r, configDia.rate_limit_ms))

            try {
                const prodsRaw = await fetchJSON<DiaResponse<DiaProduct>>(
                    `${configDia.url_base}/api/products/v1/category/${cat.id}?pageSize=50`,
                    configDia.timeout_ms
                )
                const prods = prodsRaw.items || []
                for (const p of prods) {
                    productos.push(mapearProducto(p))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Día] ${i}/${leafCats.length} — ${productos.length} productos`)
            }
        }

        console.log(`[Día] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Día] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'

/**
 * Configuración de scraping para Mercadona.
 * 
 * Mercadona tiene una API REST pública:
 * - Catálogo: GET https://tienda.mercadona.es/api/categories/
 * - Subcategoría: GET https://tienda.mercadona.es/api/categories/{id}
 *   (sin extensión .json — ya no funciona)
 */
export const configMercadona: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Mercadona',
        slug: 'mercadona',
    },
    metodo: 'api_http',
    url_base: 'https://tienda.mercadona.es/api',
    categorias_endpoint: '/categories/',
    headers: {
        Accept: 'application/json',
    },
    rate_limit_ms: 200,
    timeout_ms: 10000,
}

/* ─── Interfaces de la API real de Mercadona ─── */

interface CategoriaPadre {
    id: number
    name: string
    categories: SubcategoriaResumida[]
}

interface SubcategoriaResumida {
    id: number
    name: string
    published: boolean
}

interface SubcategoriaDetalle {
    id: number
    name: string
    categories: SubSubcategoria[]
}

interface SubSubcategoria {
    id: number
    name: string
    products: ProductoMercadona[]
}

interface ProductoMercadona {
    id: string
    slug: string
    display_name: string
    price_instructions: {
        unit_price: string
        reference_price?: string
        reference_format?: string
        bulk_price?: string
    }
    share_url: string
    thumbnail: string
    brand?: string
    packaging?: string
    categories?: { id: number; name: string }[]
}

/* ─── Fetch helpers ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/json',
        },
    })
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: ProductoMercadona, categoria?: string): ProductoRaw {
    const price = p.price_instructions || {}

    // Extraer precio por kg/unidad from reference_price (ej: "3.900")
    let precioPorKg: number | undefined
    if (price.reference_price) {
        const val = parseFloat(String(price.reference_price).replace(',', '.'))
        if (!isNaN(val)) precioPorKg = val
    }

    const precioUnitario = parseFloat(String(price.unit_price || '0').replace(',', '.'))
    if (!precioPorKg && precioUnitario) {
        precioPorKg = precioUnitario
    }

    return {
        nombre: p.display_name || p.slug || '',
        precio_actual: precioUnitario,
        precio_por_kg: precioPorKg,
        unidad: price.reference_format || 'kg',
        url_producto: p.share_url || '',
        imagen_url: p.thumbnail || '',
        marca: p.brand || 'Hacendado',
        cantidad: p.packaging || '',
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal ─── */

/**
 * Scraper de Mercadona.
 * 
 * Árbol de la API:
 *   /api/categories/  → 26 categorías padre
 *     └── .categories[]  → subcategorías (id, name)
 *          └── /api/categories/{subId}  → sub-subcategorías
 *               └── .categories[].products[]  → productos reales
 */
export async function scrapearMercadona(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []

    try {
        // 1. Obtener categorías padre (respuesta paginada: { count, next, previous, results })
        console.log('[Mercadona] Obteniendo categorías padre...')
        const raw = await fetchJSON<{ results: CategoriaPadre[] }>(
            `${configMercadona.url_base}${configMercadona.categorias_endpoint}`,
            configMercadona.timeout_ms
        )
        const padres: CategoriaPadre[] = raw.results || []
        console.log(`[Mercadona] ${padres.length} categorías padre`)

        // 2. Extraer IDs de subcategorías publicadas
        const subIds = padres.flatMap(p =>
            (p.categories || [])
                .filter(c => c.published !== false)
                .map(c => c.id)
        )
        console.log(`[Mercadona] ${subIds.length} subcategorías para procesar`)

        // 3. Fetch cada subcategoría para obtener sub-subcategorías con productos
        for (let i = 0; i < subIds.length; i++) {
            const subId = subIds[i]
            await new Promise(r => setTimeout(r, configMercadona.rate_limit_ms))

            try {
                const detalle = await fetchJSON<SubcategoriaDetalle>(
                    `${configMercadona.url_base}/categories/${subId}`,
                    configMercadona.timeout_ms
                )

                const subSubs = detalle.categories || []
                for (const subSub of subSubs) {
                    const prods = subSub.products || []
                    for (const prod of prods) {
                        productos.push(mapearProducto(prod, subSub.name))
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en subcategoría ${subId}: ${msg}`)
                console.warn(`[Mercadona] Subcategoría ${subId}: ${msg}`)
            }

            // Progreso cada 5 subcategorías
            if (i > 0 && i % 5 === 0) {
                console.log(`[Mercadona] ${i}/${subIds.length} subcategorías — ${productos.length} productos`)
            }
        }

        console.log(`[Mercadona] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Mercadona] Error:', msg)
    }

    return {
        productos,
        errores,
        duracion_ms: Date.now() - inicio,
    }
}

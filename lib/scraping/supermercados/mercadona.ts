import type { ScrapingConfig } from '../types'
import { scrapearHTTP } from '../motores/motor-http'
import type { ProductoRaw } from '../types'

/**
 * Configuración de scraping para Mercadona.
 * 
 * Mercadona tiene una API REST pública bastante completa:
 * - Catálogo: https://tienda.mercadona.es/api/categories/
 * - Productos por categoría: /api/categories/{id}.json
 * 
 * No requiere autenticación para consultas de catálogo.
 */
export const configMercadona: ScrapingConfig = {
    supermercado: {
        id: '',  // Se rellena dinámicamente al iniciar scraping
        nombre: 'Mercadona',
        slug: 'mercadona',
    },
    metodo: 'api_http',
    url_base: 'https://tienda.mercadona.es/api',
    categorias_endpoint: '/categories/',
    headers: {
        Accept: 'application/json',
    },
    rate_limit_ms: 300,    // 3 peticiones por segundo
    timeout_ms: 10000,     // 10 segundos por petición
}

/** Estructura de categoría de Mercadona */
interface CategoriaMercadona {
    id: string
    name: string
    slug: string
    subcategories?: CategoriaMercadona[]
    products?: ProductoMercadona[]
}

/** Estructura de producto de Mercadona */
interface ProductoMercadona {
    id: string
    slug: string
    display_name: string
    price_instructions: {
        unit_price: string
        reference_price?: string
        reference_format?: string
        bulk_price?: string
        price_per_unit?: string
    }
    share_url: string
    thumbnail: string
    brand?: string
    packaging?: string
    limit?: number
    categories?: {
        id: number
        name: string
    }[]
}

/**
 * Obtiene el árbol de categorías de Mercadona.
 */
async function obtenerCategorias(config: ScrapingConfig): Promise<CategoriaMercadona[]> {
    const url = `${config.url_base}${config.categorias_endpoint}`
    const res = await fetch(url, {
        signal: AbortSignal.timeout(config.timeout_ms),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/json',
        },
    })

    if (!res.ok) {
        throw new Error(`Error al obtener categorías: HTTP ${res.status}`)
    }

    const data = await res.json()
    return data.results || data.categories || data.groups || []
}

/**
 * Obtiene los productos de una categoría específica de Mercadona.
 */
async function obtenerProductosCategoria(
    categoriaId: string | number,
    config: ScrapingConfig
): Promise<ProductoMercadona[]> {
    const url = `${config.url_base}/categories/${categoriaId}.json`
    const res = await fetch(url, {
        signal: AbortSignal.timeout(config.timeout_ms),
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'application/json',
        },
    })

    if (!res.ok) {
        throw new Error(`Error en categoría ${categoriaId}: HTTP ${res.status}`)
    }

    const data = await res.json()
    return data.products || data.results || []
}

/**
 * Recorre recursivamente las categorías y extrae productos.
 */
async function recorrerCategorias(
    categorias: CategoriaMercadona[],
    config: ScrapingConfig
): Promise<ProductoRaw[]> {
    const productos: ProductoRaw[] = []

    for (const cat of categorias) {
        // Si tiene subcategorías, recorrerlas
        if (cat.subcategories && cat.subcategories.length > 0) {
            const subProductos = await recorrerCategorias(cat.subcategories, config)
            productos.push(...subProductos)
        }

        // Si tiene productos directos o podemos obtenerlos por ID
        if (cat.products && cat.products.length > 0) {
            productos.push(...cat.products.map(mapearProductoMercadona))
        } else if (cat.id) {
            // Esperar rate limit
            await new Promise(r => setTimeout(r, config.rate_limit_ms))
            try {
                const prods = await obtenerProductosCategoria(cat.id, config)
                productos.push(...prods.map(mapearProductoMercadona))
            } catch (err) {
                console.warn(`[Mercadona] Error en categoría ${cat.name}:`, err)
            }
        }
    }

    return productos
}

/**
 * Convierte un producto de Mercadona a formato genérico ProductoRaw.
 */
function mapearProductoMercadona(p: ProductoMercadona): ProductoRaw {
    const price = p.price_instructions || {}

    // Extraer precio por kg del campo reference_price (ej: "5,99 €/kg")
    let precioPorKg: number | undefined
    if (price.reference_price) {
        const match = String(price.reference_price).match(/([\d,]+)/)
        if (match) {
            precioPorKg = parseFloat(match[1].replace(',', '.'))
        }
    }

    // Si no hay reference_price, calcular desde unit_price
    const precioUnitario = parseFloat(String(price.unit_price || '0').replace(',', '.'))
    if (!precioPorKg && precioUnitario) {
        precioPorKg = precioUnitario
    }

    return {
        nombre: p.display_name || p.slug || '',
        precio_actual: precioUnitario,
        precio_por_kg: precioPorKg,
        unidad: price.reference_format || price.reference_format || 'kg',
        url_producto: p.share_url || '',
        imagen_url: p.thumbnail || '',
        marca: p.brand || 'Hacendado',
        cantidad: p.packaging || '',
        disponible: true,
    }
}

/**
 * Scraper principal de Mercadona.
 * Obtiene el árbol de categorías y extrae todos los productos.
 */
export async function scrapearMercadona(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    let productos: ProductoRaw[] = []

    try {
        console.log('[Mercadona] Obteniendo categorías...')
        const categorias = await obtenerCategorias(configMercadona)
        console.log(`[Mercadona] ${categorias.length} categorías encontradas`)

        productos = await recorrerCategorias(categorias, configMercadona)
        console.log(`[Mercadona] ${productos.length} productos extraídos`)
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

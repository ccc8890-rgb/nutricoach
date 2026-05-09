/**
 * carrefour.ts — Scraper para Carrefour España
 *
 * API pública de Carrefour:
 * - Búsqueda: GET https://www.carrefour.es/api/search/v1/?q={query}
 * - Categorías: GET https://www.carrefour.es/api/categories/v1/
 * - Productos por categoría: GET https://www.carrefour.es/api/products/v1/category/{id}
 *
 * Carrefour tiene rate limiting agresivo; se usan delays generosos.
 *
 * Referencia: https://www.carrefour.es/api/search
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
    search_endpoint: '/api/search/v1/',
    categorias_endpoint: '/api/categories/v1/',
    headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
    },
    rate_limit_ms: 500,     // Carrefour es más restrictivo
    timeout_ms: 15000,
}

/* ─── Interfaces de la API real de Carrefour ─── */

interface CarrefourCategoryResponse {
    data: CarrefourCategory[]
    total?: number
}

interface CarrefourCategory {
    id: string
    name: string
    subcategories?: CarrefourSubCategory[]
}

interface CarrefourSubCategory {
    id: string
    name: string
    productCount?: number
}

interface CarrefourProductResponse {
    data: CarrefourProduct[]
    total?: number
    page?: number
    pageSize?: number
}

interface CarrefourProduct {
    id: string
    name: string
    displayName?: string
    price: number
    /** Precio por kg (p.ej. 3.99) */
    pricePerKg?: number
    /** Precio de referencia formateado (p.ej. "3,99 €/kg") */
    referencePrice?: string
    url: string
    image: string
    brand?: string
    packaging?: string
    available: boolean
    /** Categorías del producto */
    categories?: { id: string; name: string }[]
}

/* ─── Fetch helpers ─── */

async function fetchJSON<T>(url: string, timeoutMs: number): Promise<T> {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
            ...configCarrefour.headers,
            Accept: 'application/json',
        },
    })
    if (!res.ok) {
        throw new Error(`Carrefour HTTP ${res.status} en ${url}`)
    }
    return res.json()
}

/* ─── Mapeo ─── */

function mapearProducto(p: CarrefourProduct, categoria?: string): ProductoRaw {
    let precioPorKg: number | undefined

    if (p.pricePerKg) {
        precioPorKg = p.pricePerKg
    } else if (p.referencePrice) {
        // Extraer número de string como "3,99 €/kg"
        const match = String(p.referencePrice).match(/(\d+[.,]\d+)/)
        if (match) {
            const val = parseFloat(match[1].replace(',', '.'))
            if (!isNaN(val)) precioPorKg = val
        }
    }

    const url = p.url?.startsWith('http')
        ? p.url
        : `https://www.carrefour.es${p.url || ''}`

    const imagen = p.image?.startsWith('http') ? p.image : undefined

    return {
        nombre: p.displayName || p.name || '',
        precio_actual: p.price || 0,
        precio_por_kg: precioPorKg,
        unidad: 'kg',
        url_producto: url,
        imagen_url: imagen,
        marca: p.brand || 'Carrefour',
        cantidad: p.packaging || '',
        disponible: p.available !== false,
        categoria,
    }
}

/* ─── Lógica principal ─── */

/**
 * Scraper de Carrefour.
 *
 * Estrategia:
 * 1. Obtener categorías de la API de categorías
 * 2. Por cada subcategoría con productos, obtener productos via
 *    /api/products/v1/category/{id}
 * 3. Si falla la API de categorías, intentar búsquedas por
 *    categorías conocidas via /api/search/v1/?q={categoria}
 */
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
        let categorias: CarrefourCategory[] = []

        try {
            const raw = await fetchJSON<CarrefourCategoryResponse>(
                `${configCarrefour.url_base}${configCarrefour.categorias_endpoint}`,
                configCarrefour.timeout_ms
            )
            categorias = raw.data || []
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error al obtener categorías: ${msg}`)
            console.warn('[Carrefour] No se pudieron obtener categorías, usando búsqueda por defecto')
        }

        if (categorias.length === 0) {
            // Fallback: buscar productos mediante search API
            console.log('[Carrefour] Usando búsqueda por categorías predefinidas...')
            await buscarPorCategoriasPredefinidas(productos, errores)
        } else {
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
                    const prodsRaw = await fetchJSON<CarrefourProductResponse>(
                        `${configCarrefour.url_base}/api/products/v1/category/${sub.id}?pageSize=100`,
                        configCarrefour.timeout_ms
                    )
                    const prods = prodsRaw.data || []
                    for (const p of prods) {
                        productos.push(mapearProducto(p, sub.name))
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    errores.push(`Error en categoría ${sub.name} (${sub.id}): ${msg}`)
                    console.warn(`[Carrefour] Categoría ${sub.name}: ${msg}`)
                }

                if (i > 0 && i % 5 === 0) {
                    console.log(`[Carrefour] ${i}/${subCategorias.length} categorías — ${productos.length} productos`)
                }
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

/**
 * Fallback: busca productos usando la search API con categorías conocidas.
 * Se usa cuando la API de categorías no está disponible.
 */
async function buscarPorCategoriasPredefinidas(
    productos: ProductoRaw[],
    errores: string[]
): Promise<void> {
    const CATEGORIAS_BUSQUEDA = [
        'leche', 'huevos', 'pan', 'arroz', 'pasta', 'aceite oliva',
        'legumbres', 'lentejas', 'garbanzos', 'judías',
        'arroz integral', 'quinoa', 'cuscús',
        'atún', 'salmón', 'merluza', 'pollo', 'ternera', 'cerdo', 'cordero',
        'jamón serrano', 'jamón ibérico', 'lomo embutido', 'chorizo', 'salchichón',
        'queso', 'yogurt', 'mantequilla', 'nata', 'requesón',
        'tomate frito', 'salsa', 'mayonesa', 'mostaza', 'ketchup',
        'fruta fresca', 'manzana', 'plátano', 'naranja', 'pera', 'uva', 'fresa',
        'verdura', 'lechuga', 'tomate', 'cebolla', 'ajo', 'patata', 'zanahoria', 'pimiento',
        'brócoli', 'coliflor', 'calabacín', 'berenjena', 'espinacas', 'acelgas',
        'agua mineral', 'refresco', 'zumo', 'cerveza', 'vino',
        'café', 'té', 'infusiones', 'cacao', 'colacao',
        'galletas', 'cereales', 'muesli', 'avena', 'barrita',
        'miel', 'mermelada', 'crema cacao', 'dulce',
        'frutos secos', 'almendras', 'nueces', 'avellanas', 'cacahuetes', 'pipas',
        'pasas', 'ciruelas pasas', 'orejones',
        'chocolate', 'tableta chocolate', 'caramelos', 'gominolas',
        'harina', 'azúcar', 'sal', 'vinagre', 'especia', 'levadura',
        'caldo', 'sopa', 'puré patatas',
        'conserva', 'espárragos', 'alcachofas', 'maíz', 'pimiento piquillo',
        'aceituna', 'encurtido', 'alcaparra',
        'congelados verdura', 'congelados pescado', 'congelados pizza', 'congelados helado',
        'pan molde', 'pan tostado', 'pan rallado', 'pan de molde integral',
        'huevo', 'leche entera', 'leche semidesnatada', 'leche desnatada',
        'fiambre pavo', 'fiambre pollo', 'mortadela', 'salchicha frankfurt',
    ]

    for (let i = 0; i < CATEGORIAS_BUSQUEDA.length; i++) {
        const q = CATEGORIAS_BUSQUEDA[i]
        await new Promise(r => setTimeout(r, configCarrefour.rate_limit_ms))

        try {
            const searchRaw = await fetchJSON<{ data: CarrefourProduct[] }>(
                `${configCarrefour.url_base}${configCarrefour.search_endpoint}?q=${encodeURIComponent(q)}&pageSize=50`,
                configCarrefour.timeout_ms
            )
            const prods = searchRaw.data || []
            for (const p of prods) {
                productos.push(mapearProducto(p, q))
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error en búsqueda "${q}": ${msg}`)
        }

        if (i > 0 && i % 10 === 0) {
            console.log(`[Carrefour] Búsqueda ${i}/${CATEGORIAS_BUSQUEDA.length} — ${productos.length} productos`)
        }
    }
}

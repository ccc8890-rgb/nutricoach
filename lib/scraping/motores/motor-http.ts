import type { ScrapingConfig, ProductoRaw, ScrapingResult } from '../types'

/**
 * Motor de scraping HTTP.
 * Usa fetch para obtener HTML/JSON y extrae productos.
 * Sirve para supermercados con API REST pública o HTML semántico.
 */
export async function scrapearHTTP(
    config: ScrapingConfig,
    urls: string[]
): Promise<ScrapingResult> {
    const inicio = Date.now()
    const productos: ProductoRaw[] = []
    const errores: string[] = []

    for (const url of urls) {
        try {
            await delay(config.rate_limit_ms)

            const res = await fetch(url, {
                signal: AbortSignal.timeout(config.timeout_ms),
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'application/json, text/html, */*',
                    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                    ...config.headers,
                },
            })

            if (!res.ok) {
                errores.push(`HTTP ${res.status} en ${url}`)
                continue
            }

            const contentType = res.headers.get('content-type') || ''

            if (contentType.includes('application/json')) {
                const json = await res.json()
                productos.push(...extraerDesdeJSON(json, config))
            } else {
                const html = await res.text()
                productos.push(...extraerDesdeHTML(html, config))
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error en ${url}: ${msg}`)
        }
    }

    return {
        productos,
        errores,
        duracion_ms: Date.now() - inicio,
    }
}

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

/**
 * Extrae productos de una respuesta JSON.
 * Cada supermercado tiene su propia estructura; se delega al config.
 */
function extraerDesdeJSON(_json: unknown, _config: ScrapingConfig): ProductoRaw[] {
    // La extracción específica se hace en cada supermercado (/supermercados/*.ts)
    // Este método genérico intenta detectar arrays de productos en estructuras comunes
    const productos: ProductoRaw[] = []

    if (Array.isArray(_json)) {
        for (const item of _json) {
            const p = mapearProductoGenerico(item)
            if (p) productos.push(p)
        }
    } else if (_json && typeof _json === 'object') {
        // Buscar arrays anidados
        buscarArrays(_json as Record<string, unknown>, productos)
    }

    return productos
}

function buscarArrays(obj: Record<string, unknown>, productos: ProductoRaw[]): void {
    for (const val of Object.values(obj)) {
        if (Array.isArray(val)) {
            for (const item of val) {
                if (item && typeof item === 'object' && 'nombre' in (item as object) && 'precio' in (item as object)) {
                    const p = mapearProductoGenerico(item as Record<string, unknown>)
                    if (p) productos.push(p)
                }
            }
        } else if (val && typeof val === 'object') {
            buscarArrays(val as Record<string, unknown>, productos)
        }
    }
}

function mapearProductoGenerico(item: Record<string, unknown>): ProductoRaw | null {
    const nombre = (item.nombre || item.name || item.title || item.display_name || '') as string
    const precio = parseFloat(String(item.precio || item.price || item.precio_actual || item.current_price || 0))
    if (!nombre || !precio) return null

    return {
        nombre: String(nombre).trim(),
        precio_actual: precio,
        precio_por_kg: item.precio_por_kg ? parseFloat(String(item.precio_por_kg)) : undefined,
        unidad: (item.unidad as string) || 'kg',
        url_producto: (item.url || item.url_producto || item.link || '') as string,
        imagen_url: (item.imagen || item.image || item.img || item.thumbnail || '') as string,
        marca: (item.marca || item.brand || item.marca_producto || '') as string,
        cantidad: (item.cantidad || item.quantity || item.peso || '') as string,
        disponible: item.disponible !== false && item.stock !== false,
    }
}

/**
 * Extrae productos de HTML mediante regex.
 * Para supermercados sin API que sirven HTML directamente.
 */
function extraerDesdeHTML(_html: string, _config: ScrapingConfig): ProductoRaw[] {
    // La extracción HTML específica se implementa por supermercado
    // Algunos productos pueden tener datos en JSON-LD (structured data)
    const productos: ProductoRaw[] = []

    // Intentar extraer JSON-LD (datos estructurados)
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
    let match
    while ((match = jsonLdRegex.exec(_html)) !== null) {
        try {
            const data = JSON.parse(match[1])
            if (data['@type'] === 'Product' || data['@type'] === 'ItemList') {
                const items = data['@type'] === 'ItemList' ? (data.itemListElement || []) : [data]
                for (const item of items) {
                    const product = item.product || item
                    const p = mapearProductoGenerico({
                        nombre: product.name,
                        precio: product.offers?.price || product.price,
                        url: product.url,
                        imagen: product.image,
                    })
                    if (p) productos.push(p)
                }
            }
        } catch {
            // Ignorar JSON-LD malformados
        }
    }

    return productos
}

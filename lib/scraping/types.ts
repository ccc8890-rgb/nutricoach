import type { Supermercado } from '@/types'

/** Configuración de scraping para un supermercado */
export interface ScrapingConfig {
    supermercado: Pick<Supermercado, 'id' | 'nombre' | 'slug'>
    metodo: 'api_http' | 'playwright' | 'apify'
    url_base: string
    /** Endpoint de búsqueda de productos */
    search_endpoint?: string
    /** Endpoint de categorías (si tiene API de catálogo) */
    categorias_endpoint?: string
    /** Headers HTTP adicionales */
    headers?: Record<string, string>
    /** Selectores CSS para scraping vía Playwright */
    selectores?: {
        producto?: string
        nombre?: string
        precio?: string
        precio_kg?: string
        url?: string
        imagen?: string
        cantidad?: string
    }
    /** Config de rate limiting (ms entre peticiones) */
    rate_limit_ms: number
    /** Timeout por petición (ms) */
    timeout_ms: number
}

/** Producto en bruto extraído de un supermercado (antes de normalizar) */
export interface ProductoRaw {
    nombre: string
    precio_actual: number
    precio_por_kg?: number
    unidad?: string
    url_producto: string
    imagen_url?: string
    marca?: string
    cantidad?: string
    disponible: boolean
}

/** Resultado de una petición de scraping */
export interface ScrapingResult {
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}

/** Estadísticas de una sesión de scraping */
export interface ScrapingStats {
    supermercado_id: string
    supermercado_nombre: string
    total_productos: number
    nuevos: number
    actualizados: number
    no_encontrados: number
    errores: string[]
    duracion_ms: number
    fecha: string
}

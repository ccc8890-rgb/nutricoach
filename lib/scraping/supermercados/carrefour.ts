/**
 * carrefour.ts — Scraper para Carrefour España
 *
 * Carrefour usa Cloudflare que bloquea cualquier fetch HTTP directo.
 * Estrategia: Playwright con navegador real para evitar Cloudflare,
 * e interceptar las peticiones API que hace el SPA.
 *
 * APIs internas detectadas (via cloud-api):
 * - Categorías: cloud-api/v1/categories/taxonomy/cat000000
 * - Productos: cloud-api/v1/categories/{id}/products
 * - Búsqueda: cloud-api/v1/search
 *
 * Web: https://www.carrefour.es/supermercado/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configCarrefour: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Carrefour',
        slug: 'carrefour',
    },
    metodo: 'playwright',
    url_base: 'https://www.carrefour.es',
    rate_limit_ms: 1500,   // Carrefour es muy restrictivo, delays largos
    timeout_ms: 45000,      // Cloudflare a veces tarda en resolver
}

/* ─── Interfaces de respuesta detectadas ─── */

interface CarrefourTaxonomyCategory {
    id: string
    name: string
    children?: CarrefourTaxonomyCategory[]
    productCount?: number
    url?: string
}

interface CarrefourProduct {
    id: string
    name: string
    displayName?: string
    price: number
    pricePerKg?: number
    referencePrice?: string
    url: string
    image: string
    brand?: string
    packaging?: string
    available: boolean
}

/* ─── Mapeo ─── */

function mapearProducto(p: CarrefourProduct, categoria?: string): ProductoRaw {
    let precioPorKg: number | undefined

    if (p.pricePerKg) {
        precioPorKg = p.pricePerKg
    } else if (p.referencePrice) {
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

/* ─── Lógica principal con Playwright ─── */

/**
 * Scraper de Carrefour usando Playwright.
 *
 * Estrategia:
 * 1. Lanzar navegador headless (necesario para pasar Cloudflare)
 * 2. Navegar a supermercado y extraer categorías del DOM
 * 3. Para cada categoría, navegar y extraer productos con selectores
 * 4. Fallback: interceptar llamadas a cloud-api si están disponibles
 */
export async function scrapearCarrefour(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Carrefour] Lanzando navegador Playwright...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
            extraHTTPHeaders: {
                'Accept-Language': 'es-ES,es;q=0.9',
            },
        })

        const page = await context.newPage()

        // ── 1. Navegar a supermercado ──
        console.log('[Carrefour] Navegando a supermercado...')
        try {
            await page.goto('https://www.carrefour.es/supermercado/c/alimentacion', {
                waitUntil: 'networkidle',
                timeout: configCarrefour.timeout_ms,
            })
            console.log('[Carrefour] Página cargada:', await page.title())
        } catch (err) {
            // Cloudflare timeout no es fatal, a veces la página carga igual
            console.warn('[Carrefour] Timeout en carga inicial, continuando...')
        }

        await page.waitForTimeout(3000)

        // ── 2. Intentar extraer categorías del DOM ──
        console.log('[Carrefour] Extrayendo categorías del DOM...')
        let categorias: { url: string; name: string }[] = []

        try {
            categorias = await page.evaluate(() => {
                // Intentar varios patrones comunes de Carrefour
                const links: { url: string; name: string }[] = []

                // Buscar enlaces de categorías en el menú de navegación
                const anchors = document.querySelectorAll<HTMLAnchorElement>(
                    'a[href*="/supermercado/c/"], ' +
                    'a[href*="/category/"], ' +
                    '.nav-link[href*="alimentacion"], ' +
                    '.menu-item a[href*="/c/"], ' +
                    'nav a[href*="/supermercado"]'
                )

                const seen = new Set<string>()
                anchors.forEach(a => {
                    const href = a.href?.trim()
                    const text = a.textContent?.trim()
                    if (href && text && !seen.has(href) && !href.includes('#') && text.length > 2) {
                        seen.add(href)
                        links.push({ url: href, name: text })
                    }
                })

                return links
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.warn('[Carrefour] Error extrayendo categorías:', msg)
        }

        console.log(`[Carrefour] ${categorias.length} categorías encontradas en DOM`)

        // ── 3. Si no hay categorías, usar categorías predefinidas ──
        if (categorias.length === 0) {
            console.log('[Carrefour] Usando categorías predefinidas para búsqueda...')
            const CATS_PREDEFINIDAS = [
                'https://www.carrefour.es/supermercado/c/alimentacion',
                'https://www.carrefour.es/supermercado/c/bebidas',
                'https://www.carrefour.es/supermercado/c/frescos/carnicos',
                'https://www.carrefour.es/supermercado/c/frescos/pescados-marisco',
                'https://www.carrefour.es/supermercado/c/frescos/frutas-verduras',
                'https://www.carrefour.es/supermercado/c/lacteos-huevos',
                'https://www.carrefour.es/supermercado/c/panaderia-pasteleria',
                'https://www.carrefour.es/supermercado/c/congelados',
                'https://www.carrefour.es/supermercado/c/despensa',
                'https://www.carrefour.es/supermercado/c/aceite-especias-salsas',
                'https://www.carrefour.es/supermercado/c/conservas',
                'https://www.carrefour.es/supermercado/c/legumbres',
                'https://www.carrefour.es/supermercado/c/arroz-pasta',
            ]
            categorias = CATS_PREDEFINIDAS.map(url => ({ url, name: url.split('/c/').pop()?.replace(/-/g, ' ') || url }))
        }

        // ── 4. Scrapear productos de cada categoría ──
        const maxCats = Math.min(categorias.length, 20) // Limitar para no saturar

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Carrefour] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configCarrefour.rate_limit_ms))

            try {
                const prods = await scrapearProductosCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(p)
                }
                console.log(`[Carrefour]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Carrefour]   ❌ ${msg}`)
            }
        }

        console.log(`[Carrefour] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Carrefour] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Scrapea productos de una categoría de Carrefour.
 * Navega a la URL y extrae productos del DOM renderizado.
 */
async function scrapearProductosCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<ProductoRaw[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configCarrefour.timeout_ms,
    }).catch(() => {
        // Timeout no fatal
    })

    await page.waitForTimeout(3000)

    // Scroll para trigger lazy loading
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        const scrollStep = 500
        let totalScroll = 0
        while (totalScroll < document.body.scrollHeight) {
            window.scrollTo(0, totalScroll)
            await delay(500)
            totalScroll += scrollStep
        }
    })

    await page.waitForTimeout(1000)

    // Extraer productos del DOM
    const prods = await page.evaluate(() => {
        const items: ProductoRaw[] = []

        // Intentar diferentes selectores comunes de Carrefour
        const productCards = document.querySelectorAll<HTMLElement>(
            'article[data-product], ' +
            '.product-card, ' +
            '.product-item, ' +
            '[data-testid*="product"], ' +
            '.grid-item, ' +
            'li[class*="product"]'
        )

        productCards.forEach(card => {
            const nombreEl = card.querySelector<HTMLElement>(
                '[data-product-name], ' +
                '.product-card__title, ' +
                '.product-name, ' +
                'h3, h2, [class*="title"], [class*="name"]'
            )
            const precioEl = card.querySelector<HTMLElement>(
                '[data-product-price], ' +
                '.product-card__price, ' +
                '.price, [class*="price"], ' +
                '.current-price, .offer-price'
            )
            const precioKgEl = card.querySelector<HTMLElement>(
                '.product-card__unit-price, ' +
                '.unit-price, [class*="unit"], ' +
                '.price-per-unit, .reference-price'
            )
            const urlEl = card.querySelector<HTMLAnchorElement>('a[href]')
            const imgEl = card.querySelector<HTMLImageElement>('img')
            const marcaEl = card.querySelector<HTMLElement>(
                '[data-brand], .brand, .product-brand, [class*="brand"]'
            )
            const cantidadEl = card.querySelector<HTMLElement>(
                '[data-quantity], .quantity, .packaging, [class*="quantity"], [class*="weight"]'
            )

            const nombre = nombreEl?.textContent?.trim() || ''
            const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
            const precio = parseFloat(precioTexto) || 0
            const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
            const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

            let href = urlEl?.href || ''
            if (href && !href.startsWith('http')) {
                href = `https://www.carrefour.es${href}`
            }

            if (nombre && precio > 0) {
                items.push({
                    nombre,
                    precio_actual: precio,
                    precio_por_kg: precioKg,
                    unidad: 'kg' as const,
                    url_producto: href || '',
                    imagen_url: imgEl?.src || '',
                    marca: marcaEl?.textContent?.trim() || 'Carrefour',
                    cantidad: cantidadEl?.textContent?.trim() || '',
                    disponible: true,
                    categoria,
                })
            }
        })

        return items
    })

    return prods
}

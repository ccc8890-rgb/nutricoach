/**
 * lidl.ts — Scraper para Lidl España
 *
 * Lidl no tiene API REST pública.
 * Usamos Playwright para navegar y extraer productos del DOM.
 *
 * Web: https://www.lidl.es/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configLidl: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Lidl',
        slug: 'lidl',
    },
    metodo: 'playwright',
    url_base: 'https://www.lidl.es',
    rate_limit_ms: 1500,
    timeout_ms: 30000,
}

/* ─── Interfaces ─── */

interface LidlProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: LidlProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: 'Lidl',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal ─── */

export async function scrapearLidl(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Lidl] Lanzando navegador...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        const page = await context.newPage()

        // ── 1. Obtener categorías de alimentación ──
        console.log('[Lidl] Obteniendo categorías de alimentación...')
        const categorias = await obtenerCategoriasAlimentacion(page)
        console.log(`[Lidl] ${categorias.length} categorías encontradas`)

        if (categorias.length === 0) {
            console.log('[Lidl] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                'https://www.lidl.es/c/alimentacion',
                'https://www.lidl.es/c/frutas-y-verduras',
                'https://www.lidl.es/c/carnes-y-aves',
                'https://www.lidl.es/c/pescados-y-mariscos',
                'https://www.lidl.es/c/lacteos-y-huevos',
                'https://www.lidl.es/c/panaderia-y-pasteleria',
                'https://www.lidl.es/c/despensa',
                'https://www.lidl.es/c/congelados',
                'https://www.lidl.es/c/bebidas',
            ]
            for (const url of CATS_PREDEFINIDAS) {
                categorias.push({ url, name: url.split('/c/').pop()?.replace(/-/g, ' ') || url })
            }
        }

        // ── 2. Scrapear cada categoría ──
        const maxCats = Math.min(categorias.length, 10)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Lidl] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configLidl.rate_limit_ms))

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[Lidl]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Lidl]   ❌ ${msg}`)
            }
        }

        console.log(`[Lidl] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Lidl] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Obtiene categorías desde la página principal de Lidl.
 */
async function obtenerCategoriasAlimentacion(
    page: import('playwright').Page
): Promise<{ url: string; name: string }[]> {
    try {
        await page.goto('https://www.lidl.es/c/alimentacion', {
            waitUntil: 'networkidle',
            timeout: configLidl.timeout_ms,
        }).catch(() => { })

        await page.waitForTimeout(3000)

        const cats = await page.evaluate(() => {
            const links: { url: string; name: string }[] = []
            const seen = new Set<string>()

            const anchors = document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/c/"], ' +
                'a[data-category], ' +
                'nav a[href*="categoria"], ' +
                '[class*="category"] a[href], ' +
                '.nav-item a[href*="/c/"]'
            )

            anchors.forEach(a => {
                const href = a.href?.trim()
                const text = a.textContent?.trim()
                if (href && text && !seen.has(href) && text.length > 3 && href.includes('/c/') && !href.includes('#')) {
                    seen.add(href)
                    links.push({ url: href, name: text })
                }
            })

            return links
        })

        return cats
    } catch (err) {
        return []
    }
}

/**
 * Scrapea productos de una categoría de Lidl.
 */
async function scrapearCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<LidlProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configLidl.timeout_ms,
    }).catch(() => { })

    await page.waitForTimeout(3000)

    // Scroll para lazy loading
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        for (let i = 0; i < document.body.scrollHeight; i += 500) {
            window.scrollTo(0, i)
            await delay(500)
        }
    })

    await page.waitForTimeout(1000)

    // Extraer productos del DOM
    const prods = await page.evaluate(() => {
        const items: LidlProductExtraido[] = []

        const cards = document.querySelectorAll<HTMLElement>(
            'article[data-product], ' +
            '[class*="product-card"], ' +
            '[class*="product-item"], ' +
            '[class*="product"], ' +
            '[data-testid*="product"], ' +
            '.grid-item, ' +
            'li[class*="product"]'
        )

        cards.forEach(card => {
            const nombreEl = card.querySelector<HTMLElement>(
                '[data-product-name], ' +
                '[class*="product-name"], ' +
                '[class*="product-title"], ' +
                '[class*="name"], ' +
                'h3, h2, [class*="title"]'
            )
            const precioEl = card.querySelector<HTMLElement>(
                '[data-product-price], ' +
                '[class*="price"], ' +
                '.current-price, [class*="precio"], ' +
                '.price'
            )
            const precioKgEl = card.querySelector<HTMLElement>(
                '[class*="base-price"], ' +
                '[class*="unit-price"], ' +
                '[class*="price-per"], ' +
                '[class*="reference"]'
            )
            const urlEl = card.querySelector<HTMLAnchorElement>('a[href]')
            const imgEl = card.querySelector<HTMLImageElement>('img')
            const cantidadEl = card.querySelector<HTMLElement>(
                '[class*="quantity"], [class*="weight"], [class*="packaging"], ' +
                '[data-quantity], [class*="amount"]'
            )

            const nombre = nombreEl?.textContent?.trim() || ''
            const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
            const precio = parseFloat(precioTexto) || 0
            const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
            const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

            let href = urlEl?.href || ''
            if (href && !href.startsWith('http')) {
                href = `https://www.lidl.es${href}`
            }

            if (nombre && precio > 0) {
                items.push({
                    nombre,
                    precio,
                    precioPorKg: precioKg,
                    url: href,
                    imagen: imgEl?.src || '',
                    cantidad: cantidadEl?.textContent?.trim() || undefined,
                })
            }
        })

        return items
    })

    return prods
}

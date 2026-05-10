/**
 * eroski.ts — Scraper para Eroski España
 *
 * Eroski usa Apache Tapestry (framework Java), no tiene API REST pública.
 * Estrategia: Playwright para navegar por categorías y extraer productos del HTML.
 *
 * Web: https://supermercado.eroski.es/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configEroski: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'Eroski',
        slug: 'eroski',
    },
    metodo: 'playwright',
    url_base: 'https://supermercado.eroski.es',
    rate_limit_ms: 800,
    timeout_ms: 30000,
}

/* ─── Interfaces ─── */

interface EroskiProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    marca?: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: EroskiProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: p.marca || 'Eroski',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal con Playwright ─── */

export async function scrapearEroski(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[Eroski] Lanzando navegador Playwright...')
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
        console.log('[Eroski] Obteniendo categorías...')
        let categorias = await obtenerCategoriasAlimentacion(page)
        console.log(`[Eroski] ${categorias.length} categorías encontradas`)

        // Fallback si no se encuentran categorías
        if (categorias.length === 0) {
            console.log('[Eroski] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                'https://supermercado.eroski.es/es/c/Alimentacion-y-bebidas/',
                'https://supermercado.eroski.es/es/c/Carniceria/',
                'https://supermercado.eroski.es/es/c/Pescaderia/',
                'https://supermercado.eroski.es/es/c/Frutas-y-verduras/',
                'https://supermercado.eroski.es/es/c/Lacteos-y-huevos/',
                'https://supermercado.eroski.es/es/c/Congelados/',
                'https://supermercado.eroski.es/es/c/Panaderia/',
                'https://supermercado.eroski.es/es/c/Despensa/',
                'https://supermercado.eroski.es/es/c/Bebidas/',
            ]
            for (const url of CATS_PREDEFINIDAS) {
                categorias.push({ url, name: url.split('/c/').pop()?.replace(/-/g, ' ')?.replace(/\//g, '') || url })
            }
        }

        // ── 2. Scrapear cada categoría ──
        const maxCats = Math.min(categorias.length, 12)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Eroski] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configEroski.rate_limit_ms))

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[Eroski]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Eroski]   ❌ ${msg}`)
            }
        }

        console.log(`[Eroski] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Eroski] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Obtiene categorías desde la página principal de Eroski.
 */
async function obtenerCategoriasAlimentacion(
    page: import('playwright').Page
): Promise<{ url: string; name: string }[]> {
    try {
        await page.goto('https://supermercado.eroski.es/es/', {
            waitUntil: 'networkidle',
            timeout: configEroski.timeout_ms,
        }).catch(() => { })

        await page.waitForTimeout(3000)

        const cats = await page.evaluate(() => {
            const links: { url: string; name: string }[] = []
            const seen = new Set<string>()

            const anchors = document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/es/c/"], ' +
                'nav a[href*="/categoria"], ' +
                '.menu-item a[href*="/c/"], ' +
                '[class*="category"] a[href], ' +
                'a[href*="Alimentacion"], a[href*="alimentacion"]'
            )

            anchors.forEach(a => {
                const href = a.href?.trim()
                const text = a.textContent?.trim()
                if (href && text && !seen.has(href) && text.length > 3 && !href.includes('#')) {
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
 * Scrapea productos de una categoría de Eroski.
 */
async function scrapearCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<EroskiProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configEroski.timeout_ms,
    }).catch(() => { })

    await page.waitForTimeout(3000)

    // Scroll para lazy loading
    await page.evaluate(async () => {
        const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
        for (let i = 0; i < document.body.scrollHeight; i += 500) {
            window.scrollTo(0, i)
            await delay(400)
        }
    })

    await page.waitForTimeout(1000)

    // Extraer productos del DOM
    const prods = await page.evaluate(() => {
        const items: EroskiProductExtraido[] = []

        const cards = document.querySelectorAll<HTMLElement>(
            '[class*="product-card"], ' +
            '[class*="product-item"], ' +
            '[class*="product"], ' +
            'li[class*="product"], ' +
            '.grid-item, ' +
            'article'
        )

        cards.forEach(card => {
            const nombreEl = card.querySelector<HTMLElement>(
                '[class*="product-name"], ' +
                '[class*="product-title"], ' +
                '[class*="name"], ' +
                'h3, h2, [class*="title"]'
            )
            const precioEl = card.querySelector<HTMLElement>(
                '[class*="price"], ' +
                '.current-price, [class*="precio"], ' +
                '[data-price], [class*="offer"]'
            )
            const precioKgEl = card.querySelector<HTMLElement>(
                '[class*="unit-price"], ' +
                '[class*="price-per"], ' +
                '[class*="base-price"], ' +
                '[class*="reference"]'
            )
            const urlEl = card.querySelector<HTMLAnchorElement>('a[href]')
            const imgEl = card.querySelector<HTMLImageElement>('img')
            const marcaEl = card.querySelector<HTMLElement>(
                '[class*="brand"], [data-brand], [class*="marca"]'
            )
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
                href = `https://supermercado.eroski.es${href}`
            }

            if (nombre && precio > 0) {
                items.push({
                    nombre,
                    precio,
                    precioPorKg: precioKg,
                    url: href,
                    imagen: imgEl?.src || '',
                    marca: marcaEl?.textContent?.trim() || undefined,
                    cantidad: cantidadEl?.textContent?.trim() || undefined,
                })
            }
        })

        return items
    })

    return prods
}

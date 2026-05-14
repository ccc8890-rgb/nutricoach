/**
 * el-corte-ingles.ts — Scraper para El Corte Inglés España
 *
 * El Corte Inglés usa Akamai (protección anti-bot).
 * Estrategia: Playwright con navegador real para evitar bloqueos,
 * navegando por categorías de supermercado y extrayendo productos del DOM.
 *
 * Web: https://www.elcorteingles.es/supermercado/
 */

import type { ScrapingConfig } from '../types'
import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

export const configElCorteIngles: ScrapingConfig = {
    supermercado: {
        id: '',
        nombre: 'El Corte Inglés',
        slug: 'el-corte-ingles',
    },
    metodo: 'playwright',
    url_base: 'https://www.elcorteingles.es/supermercado',
    rate_limit_ms: 1500,
    timeout_ms: 45000,
}

/* ─── Interfaces ─── */

interface ECIProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    marca?: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: ECIProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: p.marca || 'El Corte Inglés',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Lógica principal con Playwright ─── */

export async function scrapearElCorteIngles(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser

    try {
        console.log('[El Corte Inglés] Lanzando navegador Playwright...')
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

        // ── 1. Obtener categorías de supermercado ──
        console.log('[El Corte Inglés] Obteniendo categorías de supermercado...')
        const categorias = await obtenerCategoriasAlimentacion(page)
        console.log(`[El Corte Inglés] ${categorias.length} categorías encontradas`)

        // Fallback: categorías predefinidas si no se detectan del DOM
        if (categorias.length === 0) {
            console.log('[El Corte Inglés] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                'https://www.elcorteingles.es/supermercado/carniceria/',
                'https://www.elcorteingles.es/supermercado/pescaderia/',
                'https://www.elcorteingles.es/supermercado/frutas-verduras/',
                'https://www.elcorteingles.es/supermercado/lacteos-huevos/',
                'https://www.elcorteingles.es/supermercado/pan-pasteleria/',
                'https://www.elcorteingles.es/supermercado/congelados/',
                'https://www.elcorteingles.es/supermercado/despensa/',
                'https://www.elcorteingles.es/supermercado/bebidas/',
                'https://www.elcorteingles.es/supermercado/aceite-especias-salsas/',
                'https://www.elcorteingles.es/supermercado/conservas/',
                'https://www.elcorteingles.es/supermercado/arroz-pasta-legumbres/',
            ]
            for (const url of CATS_PREDEFINIDAS) {
                const name = url.split('/supermercado/').pop()?.replace(/-/g, ' ')?.replace(/\//g, '') || url
                categorias.push({ url, name })
            }
        }

        // ── 2. Scrapear cada categoría ──
        const maxCats = Math.min(categorias.length, 15)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[El Corte Inglés] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            await new Promise(r => setTimeout(r, configElCorteIngles.rate_limit_ms))

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[El Corte Inglés]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[El Corte Inglés]   ❌ ${msg}`)
            }
        }

        console.log(`[El Corte Inglés] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[El Corte Inglés] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Obtiene categorías de alimentación desde la página de supermercado.
 */
async function obtenerCategoriasAlimentacion(
    page: import('playwright').Page
): Promise<{ url: string; name: string }[]> {
    try {
        await page.goto('https://www.elcorteingles.es/supermercado/', {
            waitUntil: 'networkidle',
            timeout: configElCorteIngles.timeout_ms,
        }).catch(() => { })

        await page.waitForTimeout(4000)

        const cats = await page.evaluate(() => {
            const links: { url: string; name: string }[] = []
            const seen = new Set<string>()

            const anchors = document.querySelectorAll<HTMLAnchorElement>(
                'a[href*="/supermercado/"]:not([href*="login"]):not([href*="carrito"]):not([href*="ayuda"])'
            )

            anchors.forEach(a => {
                const href = a.href?.trim()
                const text = a.textContent?.trim()
                if (href && text && !seen.has(href) && text.length > 2 && !href.includes('#')) {
                    seen.add(href)
                    links.push({ url: href, name: text })
                }
            })

            return links
        })

        // Filtrar solo categorías de supermercado (no páginas auxiliares)
        return cats.filter(c => {
            const path = new URL(c.url).pathname
            // Nos quedamos con rutas de categoría: /supermercado/xxx/
            const parts = path.split('/').filter(Boolean)
            return parts.length >= 2 && parts[0] === 'supermercado' && !c.name.toLowerCase().includes('ofert')
        })
    } catch (err) {
        return []
    }
}

/**
 * Scrapea productos de una categoría de El Corte Inglés.
 */
async function scrapearCategoria(
    page: import('playwright').Page,
    url: string,
    categoria: string
): Promise<ECIProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: configElCorteIngles.timeout_ms,
    }).catch(() => { })

    await page.waitForTimeout(4000)

    // Scroll para trigger lazy loading
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
        const items: ECIProductExtraido[] = []

        const cards = document.querySelectorAll<HTMLElement>(
            'article[data-product], ' +
            '[class*="product-card"], ' +
            '[class*="product-item"], ' +
            'li[class*="product"], ' +
            '[data-testid*="product"], ' +
            '.grid-item, ' +
            '[class*="ProductCard"], ' +
            '[class*="productContainer"]'
        )

        cards.forEach(card => {
            const nombreEl = card.querySelector<HTMLElement>(
                '[class*="product-name"], ' +
                '[class*="product-title"], ' +
                '[class*="name"], ' +
                'h3, h2, [class*="title"], ' +
                '[data-product-name]'
            )
            const precioEl = card.querySelector<HTMLElement>(
                '[class*="price"], ' +
                '.current-price, [class*="precio"], ' +
                '[data-price], [class*="offer-price"], ' +
                '[class*="Price"]'
            )
            const precioKgEl = card.querySelector<HTMLElement>(
                '[class*="unit-price"], ' +
                '[class*="price-per-kg"], ' +
                '[class*="base-price"], ' +
                '[class*="reference-price"], ' +
                '[class*="UnitPrice"]'
            )
            const urlEl = card.querySelector<HTMLAnchorElement>('a[href]')
            const imgEl = card.querySelector<HTMLImageElement>('img')
            const marcaEl = card.querySelector<HTMLElement>(
                '[class*="brand"], [data-brand], [class*="marca"], [class*="Brand"]'
            )
            const cantidadEl = card.querySelector<HTMLElement>(
                '[class*="quantity"], [class*="weight"], [class*="packaging"], ' +
                '[data-quantity], [class*="amount"], [class*="Size"]'
            )

            const nombre = nombreEl?.textContent?.trim() || ''
            const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
            const precio = parseFloat(precioTexto) || 0
            const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
            const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

            let href = urlEl?.href || ''
            if (href && !href.startsWith('http')) {
                href = `https://www.elcorteingles.es${href}`
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

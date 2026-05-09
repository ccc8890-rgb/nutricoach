/**
 * lidl.ts — Scraper para Lidl España
 *
 * Lidl no tiene API REST pública.
 * Usamos Playwright para navegar y extraer productos.
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
    selectores: {
        producto: 'article[data-product]',
        nombre: '[data-product-name], .product__title',
        precio: '[data-product-price], .product__price',
        precio_kg: '.product__base-price',
        url: 'a.product__link',
        imagen: 'img.product__image',
        cantidad: '.product__quantity',
    },
    rate_limit_ms: 1000,
    timeout_ms: 30000,
}

/** Selectores en formato requerido para uso interno */
type SelectoresRequeridos = NonNullable<ScrapingConfig['selectores']>
const _sel = configLidl.selectores as SelectoresRequeridos

/* ─── Lógica principal ─── */

export async function scrapearLidl(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    const sel = _sel

    let browser
    try {
        console.log('[Lidl] Lanzando navegador...')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })
        const page = await context.newPage()

        // 1. Ir a la página principal de alimentación
        console.log('[Lidl] Navegando a sección de alimentación...')
        await page.goto('https://www.lidl.es/c/alimentacion', {
            waitUntil: 'networkidle',
            timeout: configLidl.timeout_ms,
        })

        // 2. Obtener categorías
        const categorias = await page.evaluate(() => {
            const links = document.querySelectorAll('a[data-category]')
            return Array.from(links).map(a => ({
                url: (a as HTMLAnchorElement).href,
                name: a.textContent?.trim() || '',
            }))
        })

        console.log(`[Lidl] ${categorias.length} categorías encontradas`)

        // 3. Si hay categorías, navegar por cada una
        const catsToScrape = categorias.length > 0 ? categorias : [{ url: 'https://www.lidl.es/c/alimentacion', name: 'Alimentación' }]
        const maxCats = Math.min(catsToScrape.length, 10)

        for (let i = 0; i < maxCats; i++) {
            const cat = catsToScrape[i]
            await new Promise(r => setTimeout(r, configLidl.rate_limit_ms))

            try {
                await page.goto(cat.url, { waitUntil: 'networkidle', timeout: configLidl.timeout_ms })

                // Esperar a que carguen los productos
                await page.waitForSelector(sel.producto!, { timeout: 10000 }).catch(() => { })

                const prods = await page.evaluate((selectores: SelectoresRequeridos) => {
                    const items = document.querySelectorAll(selectores.producto!)
                    return Array.from(items).map(item => ({
                        nombre: (item.querySelector(selectores.nombre!) as HTMLElement)?.textContent?.trim() || '',
                        precio: parseFloat(
                            (item.querySelector(selectores.precio!) as HTMLElement)
                                ?.textContent?.replace(/[^\d,]/g, '')?.replace(',', '.') || '0'
                        ),
                        precioPorKg: (() => {
                            const el = item.querySelector(selectores.precio_kg!)
                            if (!el?.textContent) return undefined
                            const match = el.textContent.replace(/[^\d,]/g, '').replace(',', '.')
                            return match ? parseFloat(match) : undefined
                        })(),
                        url: ((item.querySelector(selectores.url!) as HTMLAnchorElement)?.href || ''),
                        imagen: (item.querySelector(selectores.imagen!) as HTMLImageElement)?.src || '',
                        cantidad: (item.querySelector(selectores.cantidad!) as HTMLElement)?.textContent?.trim() || '',
                    }))
                }, sel)

                for (const p of prods) {
                    if (p.nombre && p.precio > 0) {
                        productos.push({
                            nombre: p.nombre,
                            precio_actual: p.precio,
                            precio_por_kg: p.precioPorKg,
                            unidad: 'kg',
                            url_producto: p.url,
                            imagen_url: p.imagen || undefined,
                            marca: 'Lidl',
                            cantidad: p.cantidad || undefined,
                            disponible: true,
                        })
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
            }

            console.log(`[Lidl] ${i + 1}/${maxCats} categorías — ${productos.length} productos`)
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

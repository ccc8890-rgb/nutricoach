import type { ScrapingConfig, ProductoRaw, ScrapingResult } from '../types'
import { chromium } from 'playwright'

/**
 * Motor de scraping con Playwright (headless browser).
 * Útil para supermercados sin API REST que renderizan contenido con JS.
 *
 * Flujo:
 * 1. Lanza navegador headless
 * 2. Navega a cada URL proporcionada
 * 3. Extrae productos usando selectores CSS definidos en la config
 * 4. Cierra navegador
 */
export async function scrapearConPlaywright(
    config: ScrapingConfig,
    urls: string[]
): Promise<ScrapingResult> {
    const inicio = Date.now()
    const productos: ProductoRaw[] = []
    const errores: string[] = []
    let browser

    try {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
        })

        for (const url of urls) {
            try {
                await delay(config.rate_limit_ms)

                const page = await context.newPage()
                await page.goto(url, {
                    waitUntil: 'networkidle',
                    timeout: config.timeout_ms,
                })

                // Esperar un poco más para que cargue el JS dinámico
                await page.waitForTimeout(2000)

                const selectores = config.selectores
                if (!selectores?.producto) {
                    // Sin selectores definidos, extraer texto completo
                    const texto = await page.evaluate(() => document.body.innerText)
                    errores.push(`Sin selectores definidos para ${url} — se extrajo texto plano (${texto.length} chars)`)
                } else {
                    const items = await extraerConSelectores(page, selectores)
                    productos.push(...items)
                }

                await page.close()
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en ${url}: ${msg}`)
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error de navegador: ${msg}`)
    } finally {
        if (browser) await browser.close()
    }

    return {
        productos,
        errores,
        duracion_ms: Date.now() - inicio,
    }
}

/**
 * Extrae productos de una página usando selectores CSS.
 * Los selectores deben estar definidos en la config del supermercado.
 */
async function extraerConSelectores(
    page: import('playwright').Page,
    selectores: NonNullable<ScrapingConfig['selectores']>
): Promise<ProductoRaw[]> {
    return page.evaluate((sel) => {
        const items = document.querySelectorAll(sel.producto!)
        return Array.from(items).map(item => {
            const nombreEl = sel.nombre ? item.querySelector(sel.nombre) as HTMLElement : null
            const precioEl = sel.precio ? item.querySelector(sel.precio) as HTMLElement : null
            const precioKgEl = sel.precio_kg ? item.querySelector(sel.precio_kg) as HTMLElement : null
            const urlEl = sel.url ? item.querySelector(sel.url) as HTMLAnchorElement : null
            const imgEl = sel.imagen ? item.querySelector(sel.imagen) as HTMLImageElement : null
            const cantidadEl = sel.cantidad ? item.querySelector(sel.cantidad) as HTMLElement : null

            const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
            const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''

            return {
                nombre: nombreEl?.textContent?.trim() || '',
                precio_actual: parseFloat(precioTexto) || 0,
                precio_por_kg: precioKgTexto ? parseFloat(precioKgTexto) : undefined,
                unidad: 'kg',
                url_producto: urlEl?.href || '',
                imagen_url: imgEl?.src || undefined,
                marca: '',
                cantidad: cantidadEl?.textContent?.trim() || undefined,
                disponible: true,
            }
        }).filter(p => p.nombre && p.precio_actual > 0)
    }, selectores)
}

function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
}

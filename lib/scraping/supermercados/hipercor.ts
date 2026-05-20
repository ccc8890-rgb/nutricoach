/**
 * hipercor.ts — Scraper para Hipercor España
 *
 * ✅ REPARADO (20-05-2026) — Puppeteer-extra + stealth plugin
 *
 * Hipercor pertenece al grupo El Corte Inglés y usa protección Akamai.
 * Playwright headless normal es bloqueado ("Access Denied"), pero
 * puppeteer-extra con stealth plugin lo evade correctamente.
 *
 * DOM structure descubierta:
 *   - Container: .food-product-preview-responsive
 *   - Nombre: .food-product-preview-responsive__description
 *   - Precio: .food-prices__price (dentro de __footer__price)
 *   - Precio/kg: .food-prices__measurement-unit (texto: "13,86 € / Kg")
 *   - Imagen: .food-product-preview-responsive__image img
 *   - Link: .food-product-preview-responsive__link
 *
 * Estrategia: browser persistente, scroll progresivo, extracción precisa.
 * Browser refresh cada 5 categorías para evitar memory leaks (patrón Lidl).
 *
 * Web: https://www.hipercor.es/supermercado/
 */

import type { ProductoRaw } from '../types'

// Es modules — import dinámico de puppeteer-extra
let puppeteerExtra: any = null
let StealthPlugin: any = null

async function getPuppeteer() {
    if (!puppeteerExtra) {
        puppeteerExtra = (await import('puppeteer-extra')).default
        StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default
        puppeteerExtra.use(StealthPlugin())
    }
    return puppeteerExtra
}

export const configHipercor = {
    supermercado: {
        id: '',
        nombre: 'Hipercor' as const,
        slug: 'hipercor' as const,
    },
    metodo: 'playwright' as const,
    url_base: 'https://www.hipercor.es/supermercado',
    rate_limit_ms: 2000,
    timeout_ms: 45000,
}

/* ─── Interfaces ─── */

interface HipercorProductExtraido {
    nombre: string
    precio: number
    precioPorKg?: number
    url: string
    imagen: string
    marca?: string
    cantidad?: string
}

/* ─── Mapeo ─── */

function mapearProducto(p: HipercorProductExtraido, categoria?: string): ProductoRaw {
    return {
        nombre: p.nombre,
        precio_actual: p.precio,
        precio_por_kg: p.precioPorKg,
        unidad: 'kg',
        url_producto: p.url,
        imagen_url: p.imagen || undefined,
        marca: p.marca || 'Hipercor',
        cantidad: p.cantidad || undefined,
        disponible: true,
        categoria,
    }
}

/* ─── Categorías predefinidas ─── */

const CATEGORIAS: { url: string; name: string }[] = [
    { url: 'https://www.hipercor.es/supermercado/carniceria/', name: 'Carnicería' },
    { url: 'https://www.hipercor.es/supermercado/pescaderia/', name: 'Pescadería' },
    { url: 'https://www.hipercor.es/supermercado/frutas-verduras/', name: 'Frutas y Verduras' },
    { url: 'https://www.hipercor.es/supermercado/lacteos-huevos/', name: 'Lácteos y Huevos' },
    { url: 'https://www.hipercor.es/supermercado/pan-pasteleria/', name: 'Pan y Pastelería' },
    { url: 'https://www.hipercor.es/supermercado/congelados/', name: 'Congelados' },
    { url: 'https://www.hipercor.es/supermercado/despensa/', name: 'Despensa' },
    { url: 'https://www.hipercor.es/supermercado/bebidas/', name: 'Bebidas' },
    { url: 'https://www.hipercor.es/supermercado/aceite-especias-salsas/', name: 'Aceite, Especias y Salsas' },
    { url: 'https://www.hipercor.es/supermercado/conservas/', name: 'Conservas' },
    { url: 'https://www.hipercor.es/supermercado/arroz-pasta-legumbres/', name: 'Arroz, Pasta y Legumbres' },
]

/* ─── Lógica principal ─── */

export async function scrapearHipercor(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const errores: string[] = []
    const productos: ProductoRaw[] = []
    let browser: any = null

    try {
        console.log('[Hipercor] Lanzando navegador Puppeteer-extra + stealth...')
        const puppeteer = await getPuppeteer()
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        })

        const maxCats = Math.min(CATEGORIAS.length, 11)

        for (let i = 0; i < maxCats; i++) {
            const cat = CATEGORIAS[i]
            console.log(`[Hipercor] Categoría ${i + 1}/${maxCats}: ${cat.name}`)

            // Refresh browser cada 5 categorías para evitar memory leak
            if (i > 0 && i % 5 === 0) {
                console.log('[Hipercor] Refreshing browser (memory management)...')
                await browser.close()
                browser = await puppeteer.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
                })
            }

            const page = await browser.newPage()
            await page.setViewport({ width: 1920, height: 1080 })
            await page.setUserAgent(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            )

            try {
                const prods = await scrapearCategoria(page, cat.url, cat.name)
                for (const p of prods) {
                    productos.push(mapearProducto(p, cat.name))
                }
                console.log(`[Hipercor]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Hipercor]   ❌ ${msg}`)
            } finally {
                await page.close().catch(() => { })
            }

            // Rate limiting
            await new Promise(r => setTimeout(r, configHipercor.rate_limit_ms))
        }

        console.log(`[Hipercor] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Hipercor] Error:', msg)
    } finally {
        if (browser) await browser.close().catch(() => { })
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

/**
 * Scrapea productos de una categoría de Hipercor.
 * Usa puppeteer-extra (page.evaluate con arrow functions, OK en Puppeteer v24).
 */
async function scrapearCategoria(
    page: any,
    url: string,
    categoria: string
): Promise<HipercorProductExtraido[]> {
    await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: configHipercor.timeout_ms,
    }).catch(() => { })

    // Esperar a que cargue contenido dinámico
    await new Promise(r => setTimeout(r, 8000))

    // Scroll progresivo para lazy loading
    for (const pct of [0.3, 0.6, 1.0]) {
        await page.evaluate((p: number) => window.scrollTo(0, document.body.scrollHeight * p), pct)
        await new Promise(r => setTimeout(r, 2000))
    }

    // Extraer productos del DOM con selectores precisos
    const prods = await page.evaluate(() => {
        const items: any[] = []
        const containers = document.querySelectorAll('.food-product-preview-responsive')

        containers.forEach(container => {
            const nameEl = container.querySelector('.food-product-preview-responsive__description')
            const priceFooter = container.querySelector('.food-product-preview-responsive__footer__price')
            const imgEl = container.querySelector('.food-product-preview-responsive__image img')
            const linkEl = container.querySelector('.food-product-preview-responsive__link')

            const name = nameEl?.textContent?.trim() || ''

            // Precio actual
            const priceEl = priceFooter?.querySelector('.food-prices__price')
            const priceText = priceEl?.textContent?.trim() || ''
            const priceMatch = priceText.match(/([\d.,]+)/)
            const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0

            // Precio por kg (unitario)
            const unitEl = priceFooter?.querySelector('.food-prices__measurement-unit')
            const unitText = unitEl?.textContent?.trim() || ''
            const kgMatch = unitText.match(/([\d.,]+)\s*€\s*\/\s*(kg|unidad|l|g|100\s*g)/i)
            const priceKg = kgMatch ? parseFloat(kgMatch[1].replace(',', '.')) : undefined

            // Marca (a veces aparece como segundo texto en description)
            const fullText = container.textContent || ''
            const brandMatch = fullText.match(/\b(EL CORTE INGLES|HIPERCOR|PASSION MEAT|SELECTED|MAGNOLIA|WOMBAT|TWIN)\b/i)
            const marca = brandMatch ? brandMatch[1].toUpperCase() : undefined

            const linkAnchor = linkEl as HTMLAnchorElement | null
            const href = linkAnchor?.href || ''
            const fullUrl = href && href.startsWith('http') ? href :
                href ? `https://www.hipercor.es${href.startsWith('/') ? '' : '/'}${href}` : ''

            const imgInstance = imgEl as HTMLImageElement | null

            if (name && price > 0) {
                items.push({
                    nombre: name,
                    precio: price,
                    precioPorKg: priceKg,
                    url: fullUrl,
                    imagen: imgInstance?.src || '',
                    marca,
                })
            }
        })

        return items
    })

    return prods
}

/**
 * bonpreu.ts — Scraper para Bonpreu v5 (definitivo)
 *
 * ✅ REESCRITO 15-05-2026 v5: Playwright + scroll + UUIDs reales
 *
 * CAUSA RAÍZ del bug 864→27 (v3):
 *   v3 usaba GET v5/product-pages que SOLO devuelve productos destacados.
 *   Para obtener TODOS hay que navegar a cada categoría vía Playwright,
 *   hacer scroll para trigger lazy loading, e interceptar PUT v6/products.
 *
 * CAUSA RAÍZ del bug 864→804→... (v4):
 *   Las categorías sin UUID real daban 0 productos. Los UUIDs se extraen
 *   de los enlaces del menú de navegación en la homepage.
 *
 * UUIDs reales obtenidos de la homepage (15-05-2026):
 *   Frescos:   c95cfbf2-501d-433f-bae3-10fcef330b11
 *   Alimentació: c49d1ef2-bf51-44a7-b631-4a35474a21ac (categoría maestra)
 *   Begudes:   3660db45-baa3-4c9f-9bb1-7cba443b3c9f
 *   Congelats: 79a52e84-e446-47fb-b032-dfa044ecb779
 *   Làctics i ous: 8e6bb6f8-67ac-4a57-8260-c861830774f0
 *   Celler:    5aebd367-ae51-4a42-a2f2-74662454e411
 *   Ofertes:   5de4976b-9569-4f39-b265-849da8f25975
 *   Dietes:    85881db4-b23e-4e02-8e2e-9dae38543e40
 *   Productes Km0: a37a22b7-473b-4b45-9bf7-81962153dde0
 *
 * Nota: "Alimentació" es la categoría que contiene subcategorías
 * (carn, peix, fruita, làctics, pa, etc.). Navegando a ella obtenemos
 * todos los productos de alimentación.
 *
 * Web: https://www.compraonline.bonpreuesclat.cat/
 */

import type { ProductoRaw } from '../types'
import { chromium } from 'playwright'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'

// ── Interfaces de la API ──

interface BonpreuApiPrice {
    amount: string
    currency: string
}

interface BonpreuApiUnitPrice {
    price: BonpreuApiPrice
    unit: string
}

interface BonpreuApiImage {
    src: string
    description: string
}

interface BonpreuApiProduct {
    productId: string
    retailerProductId: string
    type: string
    name: string
    brand: string
    packSizeDescription: string
    price: BonpreuApiPrice
    unitPrice: BonpreuApiUnitPrice
    available: boolean
    image?: BonpreuApiImage
    promotions?: Array<{
        promoId: string
        description: string
        type: string
    }>
    promoPrice?: BonpreuApiPrice
}

// ── Mapeo ──

function mapearProducto(api: BonpreuApiProduct, categoria: string): ProductoRaw {
    const precio = parseFloat(api.price.amount)
    const precioKg = api.unitPrice?.price?.amount
        ? parseFloat(api.unitPrice.price.amount)
        : undefined

    return {
        nombre: api.name,
        precio_actual: precio,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: api.productId ? `${URL_BASE}/product/${api.productId}` : '',
        imagen_url: api.image?.src || undefined,
        marca: api.brand || 'Bonpreu',
        cantidad: api.packSizeDescription || undefined,
        disponible: api.available,
        categoria,
    }
}

/* ─── Categorías con UUIDs reales del menú de navegación ─── */

interface CategoriaInfo {
    uuid: string
    name: string
    slug: string
}

const CATEGORIAS: CategoriaInfo[] = [
    { uuid: 'c95cfbf2-501d-433f-bae3-10fcef330b11', name: 'Frescos', slug: 'frescos' },
    { uuid: 'c49d1ef2-bf51-44a7-b631-4a35474a21ac', name: 'Alimentació', slug: 'alimentació' },
    { uuid: '3660db45-baa3-4c9f-9bb1-7cba443b3c9f', name: 'Begudes', slug: 'begudes' },
    { uuid: '79a52e84-e446-47fb-b032-dfa044ecb779', name: 'Congelats', slug: 'congelats' },
    { uuid: '8e6bb6f8-67ac-4a57-8260-c861830774f0', name: 'Làctics i ous', slug: 'làctics-i-ous' },
    { uuid: '5aebd367-ae51-4a42-a2f2-74662454e411', name: 'Celler', slug: 'celler' },
    { uuid: '85881db4-b23e-4e02-8e2e-9dae38543e40', name: 'Dietes i intoleràncies', slug: 'dietes-intoleràncies-i-estils-de-vida' },
    { uuid: 'a37a22b7-473b-4b45-9bf7-81962153dde0', name: 'Productes Km0', slug: 'productes-km0' },
]

// ── Lógica principal ──

export async function scrapearBonpreu(): Promise<{
    productos: ProductoRaw[]
    errores: string[]
    duracion_ms: number
}> {
    const inicio = Date.now()
    const productos: ProductoRaw[] = []
    const errores: string[] = []

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'ca-ES',
            extraHTTPHeaders: { 'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8' },
        })

        const page = await context.newPage()

        // ── Contexto compartido para interceptación (evita fuga de listeners) ──
        let catCtx: { productos: BonpreuApiProduct[]; vistos: Set<string> } = {
            productos: [],
            vistos: new Set(),
        }

        // ÚNICO listener global — usa el contexto mutable
        page.on('response', async (res) => {
            const url = res.url()
            if (url.includes('/api/webproductpagews/v6/products') && res.status() === 200) {
                try {
                    const json = await res.json() as { products?: BonpreuApiProduct[] }
                    if (json.products) {
                        const ctx = catCtx // capturar referencia actual
                        for (const p of json.products) {
                            if (p && p.name && p.price && !ctx.vistos.has(p.productId)) {
                                ctx.vistos.add(p.productId)
                                ctx.productos.push(p)
                            }
                        }
                    }
                } catch { /* ignore parse errors */ }
            }
        })

        // ── 1. Homepage para establecer sesión CloudFront ──
        console.log('[Bonpreu] Estableciendo sesión via homepage...')
        await page.goto(URL_BASE + '/', {
            waitUntil: 'networkidle',
            timeout: 30000,
        }).catch(() => { })
        await page.waitForTimeout(3000)
        console.log('[Bonpreu]   Sesión OK')

        const maxCats = CATEGORIAS.length

        for (let i = 0; i < maxCats; i++) {
            const cat = CATEGORIAS[i]
            console.log(`[Bonpreu] Categoría ${i + 1}/${maxCats}: ${cat.name} (${cat.uuid.slice(0, 8)}...)`)

            try {
                const catUrl = `${URL_BASE}/categories/${cat.slug}/${cat.uuid}`

                // Resetear contexto para esta categoría
                catCtx = { productos: [], vistos: new Set() }

                await page.goto(catUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30000,
                }).catch(() => { })

                // Esperar a que la SPA cargue y dispare primeras peticiones
                await page.waitForTimeout(3000)

                // ── Scroll progresivo para trigger lazy loading ──
                // Hasta 30 scrolls o hasta que no haya más productos nuevos
                let ultimoConteo = 0
                let scrollsSinCambios = 0
                for (let s = 0; s < 30; s++) {
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                    await page.waitForTimeout(1200)

                    const actual = catCtx.productos.length
                    if (actual === ultimoConteo) {
                        scrollsSinCambios++
                        if (scrollsSinCambios >= 3) break // 3 scrolls sin cambios → salir
                    } else {
                        scrollsSinCambios = 0
                        ultimoConteo = actual
                    }
                }

                const mapeados = catCtx.productos.map(p => mapearProducto(p, cat.name))
                productos.push(...mapeados)
                console.log(`[Bonpreu]   → ${mapeados.length} productos`)

                // Pequeña pausa entre categorías
                await page.waitForTimeout(500)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Bonpreu]   ❌ ${msg}`)
            }
        }

        console.log(`[Bonpreu] Total: ${productos.length} productos en ${Date.now() - inicio}ms`)

        // Eliminar duplicados por nombre
        const seen = new Set<string>()
        const unicos: ProductoRaw[] = []
        for (const p of productos) {
            const key = p.nombre.toLowerCase().trim()
            if (!seen.has(key)) {
                seen.add(key)
                unicos.push(p)
            }
        }

        return { productos: unicos, errores, duracion_ms: Date.now() - inicio }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Bonpreu] Error:', msg)
        return { productos: [], errores, duracion_ms: Date.now() - inicio }
    } finally {
        await browser.close().catch(() => { })
    }
}

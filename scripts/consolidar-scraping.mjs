#!/usr/bin/env node
/**
 * consolidar-scraping.mjs
 *
 * Script OPTIMIZADO para descargar el catálogo de TODOS los
 * supermercados en una sola ejecución, con:
 *   - Batch upsert (500 productos por lote)
 *   - Deduplicación por limpiarNombre()
 *   - Límite de ~1.500 productos representativos por supermercado
 *   - Sin histórico (precios de referencia, no diarios)
 *   - Skip si ya existe con mismo precio en últimos 7 días
 *
 * USO:
 *   node scripts/consolidar-scraping.mjs              # Todos
 *   node scripts/consolidar-scraping.mjs --mercadona   # Solo Mercadona
 *   node scripts/consolidar-scraping.mjs --carrefour   # Solo Carrefour
 *
 * Requiere: .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
    delay, fetchJSON, esComestible, limpiarNombre,
} from '../lib/scraping/helpers-scraping.mjs'

// ── Config ────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
})

// ── Global error handlers ─────────────────────────────────────

process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.stack || reason.message : String(reason)
    process.stderr.write(`\n❌ UNHANDLED REJECTION: ${msg}\n`)
    process.exit(1)
})

process.on('uncaughtException', (err) => {
    process.stderr.write(`\n❌ UNCAUGHT EXCEPTION: ${err.stack || err.message}\n`)
    process.exit(1)
})

// ═══════════════════════════════════════════════════════════════
//  SCRAPERS
// ═══════════════════════════════════════════════════════════════

// ── MERCADONA ──────────────────────────────────────────────────

const MERCADONA_API = 'https://tienda.mercadona.es/api'

async function scrapearMercadona() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    console.log('[Mercadona] ⏳ Obteniendo categorías padre...')
    const raw = await fetchJSON(`${MERCADONA_API}/categories/`)
    const padres = raw.results || []
    console.log(`[Mercadona] ✅ ${padres.length} categorías padre`)

    const subIds = padres.flatMap(p =>
        (p.categories || []).filter(c => c.published !== false).map(c => c.id)
    )
    console.log(`[Mercadona] 🔍 ${subIds.length} subcategorías\n`)

    for (let i = 0; i < subIds.length; i++) {
        await delay(200)
        try {
            const detalle = await fetchJSON(`${MERCADONA_API}/categories/${subIds[i]}`)
            const subSubs = detalle.categories || []
            for (const subSub of subSubs) {
                const prods = subSub.products || []
                for (const prod of prods) {
                    const price = prod.price_instructions || {}
                    let precioPorKg
                    if (price.reference_price) {
                        const val = parseFloat(String(price.reference_price).replace(',', '.'))
                        if (!isNaN(val)) precioPorKg = val
                    }
                    const precioUnitario = parseFloat(String(price.unit_price || '0').replace(',', '.'))
                    if (!precioPorKg && precioUnitario) precioPorKg = precioUnitario
                    productos.push({
                        nombre: prod.display_name || prod.slug || '',
                        precio_actual: precioUnitario,
                        precio_por_kg: precioPorKg,
                        unidad: price.reference_format || 'kg',
                        url_producto: prod.share_url || '',
                        imagen_url: prod.thumbnail || '',
                        marca: prod.brand || 'Hacendado',
                        cantidad: prod.packaging || '',
                        disponible: true,
                        categoria: subSub.name || '',
                    })
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            errores.push(`Error subcat ${subIds[i]}: ${msg}`)
        }
        if (i > 0 && i % 5 === 0) console.log(`  📊 ${i}/${subIds.length} subcats · ${productos.length} prods`)
    }
    console.log(`\n[Mercadona] 📦 ${productos.length} productos`)
    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── CARREFOUR (Playwright) ─────────────────────────────────────

async function scrapearCarrefour() {
    const inicio = Date.now()
    const errores = []
    const productos = []
    let browser

    try {
        console.log('[Carrefour] Lanzando navegador Playwright...')
        const { chromium } = await import('playwright')
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
            extraHTTPHeaders: { 'Accept-Language': 'es-ES,es;q=0.9' },
        })

        const page = await context.newPage()

        console.log('[Carrefour] Navegando a supermercado...')
        try {
            await page.goto('https://www.carrefour.es/supermercado/c/alimentacion', {
                waitUntil: 'networkidle',
                timeout: 45000,
            })
            console.log('[Carrefour] Página cargada:', await page.title())
        } catch {
            console.warn('[Carrefour] Timeout en carga inicial, continuando...')
        }
        await page.waitForTimeout(3000)

        console.log('[Carrefour] Extrayendo categorías del DOM...')
        let categorias = []

        try {
            categorias = await page.evaluate(() => {
                const links = []
                const seen = new Set()
                const anchors = document.querySelectorAll(
                    'a[href*="/supermercado/c/"], a[href*="/category/"], .nav-link[href*="alimentacion"], .menu-item a[href*="/c/"], nav a[href*="/supermercado"]'
                )
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
            console.warn('[Carrefour] Error extrayendo categorías:', err.message)
        }

        console.log(`[Carrefour] ${categorias.length} categorías encontradas en DOM`)

        if (categorias.length === 0) {
            console.log('[Carrefour] Usando categorías predefinidas...')
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

        const maxCats = Math.min(categorias.length, 20)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Carrefour] Categoría ${i + 1}/${maxCats}: ${cat.name}`)
            await delay(1500)

            try {
                await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => { })
                await page.waitForTimeout(3000)

                await page.evaluate(async () => {
                    for (let s = 0; s < document.body.scrollHeight; s += 500) {
                        window.scrollTo(0, s)
                        await new Promise(r => setTimeout(r, 500))
                    }
                })
                await page.waitForTimeout(1000)

                const prods = await page.evaluate((catName) => {
                    const items = []
                    const cards = document.querySelectorAll(
                        'article[data-product], .product-card, .product-item, [data-testid*="product"], .grid-item, li[class*="product"]'
                    )
                    cards.forEach(card => {
                        const nombreEl = card.querySelector(
                            '[data-product-name], .product-card__title, .product-name, h3, h2, [class*="title"], [class*="name"]'
                        )
                        const precioEl = card.querySelector(
                            '[data-product-price], .product-card__price, .price, [class*="price"], .current-price, .offer-price'
                        )
                        const precioKgEl = card.querySelector(
                            '.product-card__unit-price, .unit-price, [class*="unit"], .price-per-unit, .reference-price'
                        )
                        const urlEl = card.querySelector('a[href]')
                        const imgEl = card.querySelector('img')
                        const marcaEl = card.querySelector('[data-brand], .brand, .product-brand, [class*="brand"]')
                        const cantidadEl = card.querySelector('[data-quantity], .quantity, .packaging, [class*="quantity"], [class*="weight"]')

                        const nombre = nombreEl?.textContent?.trim() || ''
                        const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
                        const precio = parseFloat(precioTexto) || 0
                        const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
                        const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

                        let href = urlEl?.href || ''
                        if (href && !href.startsWith('http')) href = `https://www.carrefour.es${href}`

                        if (nombre && precio > 0) {
                            items.push({
                                nombre, precio_actual: precio, precio_por_kg: precioKg,
                                unidad: 'kg', url_producto: href || '', imagen_url: imgEl?.src || '',
                                marca: marcaEl?.textContent?.trim() || 'Carrefour',
                                cantidad: cantidadEl?.textContent?.trim() || '', disponible: true, categoria: catName,
                            })
                        }
                    })
                    return items
                }, cat.name)

                for (const p of prods) productos.push(p)
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

// ── DÍA (Playwright) ───────────────────────────────────────────

async function scrapearDia() {
    const inicio = Date.now()
    const errores = []
    const productos = []
    let browser

    try {
        console.log('[Día] Lanzando navegador Playwright...')
        const { chromium } = await import('playwright')
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

        console.log('[Día] Obteniendo categorías...')
        let categorias = []

        try {
            await page.goto('https://www.dia.es/compra-online/', {
                waitUntil: 'networkidle',
                timeout: 30000,
            }).catch(() => { })
            await page.waitForTimeout(3000)

            categorias = await page.evaluate(() => {
                const links = []
                const seen = new Set()
                const anchors = document.querySelectorAll('a[href*="/compra-online/"]:not([href*="login"]):not([href*="carrito"])')
                anchors.forEach(a => {
                    const href = a.href?.trim()
                    const text = a.textContent?.trim()
                    if (href && text && !seen.has(href) && text.length > 3 && href.includes('/c/')) {
                        seen.add(href)
                        links.push({ url: href, name: text })
                    }
                })
                return links
            })
        } catch { }

        console.log(`[Día] ${categorias.length} categorías encontradas`)

        if (categorias.length === 0) {
            console.log('[Día] Usando categorías predefinidas...')
            const CATS_PREDEFINIDAS = [
                'https://www.dia.es/compra-online/alimentacion/c/AL00',
                'https://www.dia.es/compra-online/leches-y-postres/c/AL01',
                'https://www.dia.es/compra-online/huevos/c/AL02',
                'https://www.dia.es/compra-online/aceite/c/AL03',
                'https://www.dia.es/compra-online/arroz-pasta-legumbres/c/AL04',
                'https://www.dia.es/compra-online/pan-panaderia/c/AL05',
                'https://www.dia.es/compra-online/cereales-y-galletas/c/AL06',
                'https://www.dia.es/compra-online/chocolates-y-dulces/c/AL07',
                'https://www.dia.es/compra-online/conservas/c/AL08',
                'https://www.dia.es/compra-online/congelados/c/AL09',
                'https://www.dia.es/compra-online/bebidas/c/AL10',
                'https://www.dia.es/compra-online/salsas-especias/c/AL11',
                'https://www.dia.es/compra-online/frutos-secos/c/AL12',
            ]
            for (const url of CATS_PREDEFINIDAS) {
                categorias.push({ url, name: url.split('/c/').pop()?.replace(/-/g, ' ') || url })
            }
        }

        const maxCats = Math.min(categorias.length, 15)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Día] Categoría ${i + 1}/${maxCats}: ${cat.name}`)
            await delay(1000)

            try {
                await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
                await page.waitForTimeout(3000)

                await page.evaluate(async () => {
                    for (let s = 0; s < document.body.scrollHeight; s += 500) {
                        window.scrollTo(0, s)
                        await new Promise(r => setTimeout(r, 400))
                    }
                })
                await page.waitForTimeout(1000)

                const prods = await page.evaluate((catName) => {
                    const items = []
                    const cards = document.querySelectorAll(
                        'article[data-product], [class*="product-card"], [class*="product-item"], li[class*="product"], [data-testid*="product"], .product-grid [class*="item"]'
                    )
                    cards.forEach(card => {
                        const nombreEl = card.querySelector(
                            '[class*="product-name"], [class*="product-title"], [class*="name"], h3, h2, [class*="brand"] + [class*="name"]'
                        )
                        const precioEl = card.querySelector(
                            '[class*="price"], .current-price, .offer-price, [data-price], [class*="precio"]'
                        )
                        const precioKgEl = card.querySelector(
                            '[class*="unit-price"], [class*="price-per-kg"], [class*="base-price"], [class*="reference"]'
                        )
                        const urlEl = card.querySelector('a[href]')
                        const imgEl = card.querySelector('img')
                        const marcaEl = card.querySelector('[class*="brand"], [data-brand], [class*="marca"]')
                        const cantidadEl = card.querySelector(
                            '[class*="quantity"], [class*="weight"], [class*="amount"], [data-quantity], [class*="packaging"]'
                        )

                        const nombre = nombreEl?.textContent?.trim() || ''
                        const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
                        const precio = parseFloat(precioTexto) || 0
                        const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
                        const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

                        let href = urlEl?.href || ''
                        if (href && !href.startsWith('http')) href = `https://www.dia.es${href}`

                        if (nombre && precio > 0) {
                            items.push({
                                nombre, precio_actual: precio, precio_por_kg: precioKg,
                                unidad: 'kg', url_producto: href, imagen_url: imgEl?.src || '',
                                marca: marcaEl?.textContent?.trim() || 'Día',
                                cantidad: cantidadEl?.textContent?.trim() || undefined, disponible: true, categoria: catName,
                            })
                        }
                    })
                    return items
                }, cat.name)

                for (const p of prods) productos.push(p)
                console.log(`[Día]   → ${prods.length} productos`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error en categoría ${cat.name}: ${msg}`)
                console.warn(`[Día]   ❌ ${msg}`)
            }
        }

        console.log(`[Día] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Día] Error:', msg)
    } finally {
        if (browser) await browser.close()
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── AL CAMPO (API compraonline.alcampo.es) ─────────────────────

const ALCAMPO_BASE = 'https://www.compraonline.alcampo.es'
const ALCAMPO_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
}

async function fetchAlcampoJSON(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: ALCAMPO_HEADERS,
    })
    if (!res.ok) throw new Error(`Alcampo HTTP ${res.status} en ${url}`)
    return res.json()
}

const CATEGORIAS_ALCAMPO = [
    'leche', 'huevos', 'pan', 'arroz', 'pasta', 'aceite oliva',
    'legumbres', 'lentejas', 'garbanzos', 'judías',
    'arroz integral', 'quinoa',
    'atún', 'salmón', 'merluza', 'pollo', 'ternera', 'cerdo',
    'jamón serrano', 'jamón ibérico', 'lomo embutido', 'chorizo',
    'queso', 'yogur', 'mantequilla', 'nata',
    'tomate frito', 'salsa',
    'fruta fresca', 'manzana', 'plátano', 'naranja',
    'verdura', 'lechuga', 'tomate', 'cebolla', 'ajo', 'patata',
    'brócoli', 'coliflor', 'espinacas',
    'agua mineral', 'refresco', 'zumo', 'cerveza', 'vino',
    'café', 'té', 'infusiones', 'cacao',
    'galletas', 'cereales', 'avena', 'muesli',
    'miel', 'mermelada',
    'frutos secos', 'almendras', 'nueces',
    'chocolate', 'harina', 'azúcar', 'sal', 'vinagre', 'especia',
    'caldo', 'sopa', 'conserva', 'aceituna',
    'congelados', 'pan molde', 'pan tostado',
    'fiambre pavo', 'fiambre pollo',
]

async function scrapearAlcampo() {
    const inicio = Date.now()
    const errores = []
    const productos = []
    const vistos = new Set()

    try {
        console.log('[Alcampo] Obteniendo página principal...')
        const homeRes = await fetch(ALCAMPO_BASE, {
            signal: AbortSignal.timeout(15000),
            headers: ALCAMPO_HEADERS,
        })
        const homeHtml = await homeRes.text()
        const regionMatch = homeHtml.match(/regionId[=:]["']?([a-f0-9-]{36})/i)
        const regionId = regionMatch?.[1] || 'ac90d761-9d58-4918-a37d-dd14e1ce384a'
        console.log(`[Alcampo] Region ID: ${regionId}`)

        console.log('[Alcampo] Obteniendo sugerencias de búsqueda...')
        let sugerencias = []
        try {
            sugerencias = await fetchAlcampoJSON(
                `${ALCAMPO_BASE}/api/search/v1/suggestions/primary?searchTerm=&limit=50&regionId=${regionId}`
            )
        } catch { }
        console.log(`[Alcampo] ${sugerencias.length || 0} sugerencias`)

        const terminos = [...new Set([...CATEGORIAS_ALCAMPO, ...(Array.isArray(sugerencias) ? sugerencias : [])])]
        console.log(`[Alcampo] Buscando en ${terminos.length} términos...`)

        for (let i = 0; i < terminos.length; i++) {
            const term = terminos[i]
            await delay(500)

            try {
                const result = await fetchAlcampoJSON(
                    `${ALCAMPO_BASE}/api/webproductpagews/v5/product-pages?decoratedOnly=true&limit=50&searchTerm=${encodeURIComponent(term)}&tag=web`
                )
                const groups = result.productGroups || []
                for (const group of groups) {
                    const prods = group.products || []
                    for (const page of prods) {
                        const p = page.product
                        if (!p?.name) continue
                        const key = p.productId || p.name
                        if (vistos.has(key)) continue
                        vistos.add(key)
                        productos.push({
                            nombre: p.name || '',
                            precio_actual: p.price || 0,
                            precio_por_kg: p.pricePerKg,
                            unidad: p.unit || 'kg',
                            url_producto: p.url || '',
                            imagen_url: p.imageUrl || undefined,
                            marca: p.brand || 'Alcampo',
                            cantidad: p.packaging || undefined,
                            disponible: p.available !== false,
                            categoria: term,
                        })
                    }
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error búsqueda "${term}": ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Alcampo] ${i}/${terminos.length} búsquedas — ${productos.length} productos`)
            }
        }

        console.log(`[Alcampo] ${productos.length} productos totales (${vistos.size} únicos)`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Alcampo] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── CONSUM (API V1.0 corregida) ────────────────────────────────

const CONSUM_BASE = 'https://tienda.consum.es'
const CONSUM_HEADERS = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9',
}

async function fetchConsumJSON(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: { ...CONSUM_HEADERS, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Consum HTTP ${res.status} en ${url}`)
    return res.json()
}

function mapearProductoConsum(p, categoria) {
    const d = p.productData || {}
    const pd = p.priceData
    let precioActual = 0
    let precioKg

    if (pd?.prices?.length) {
        const price = pd.prices.find(p2 => p2.id === 'PRICE')
        if (price?.value?.centAmount) {
            precioActual = price.value.centAmount  // YA en euros, NO dividir entre 100
        }
        const unitPrice = pd.prices.find(p2 => p2.id === 'UNIT_PRICE' || p2.id === 'PRICE')
        if (unitPrice?.value?.centUnitAmount && unitPrice.value.centUnitAmount !== price?.value?.centAmount) {
            precioKg = unitPrice.value.centUnitAmount  // YA en euros, NO dividir entre 100
        }
        if (!precioKg && pd.unitPriceUnitType) {
            precioKg = precioActual
        }
    }

    const url = d.url?.startsWith('http') ? d.url : undefined
    const imagen = d.imageURL?.startsWith('http') ? d.imageURL : undefined
    let cantidad = d.description || ''
    if (!cantidad && pd?.unitPriceUnitType) cantidad = pd.unitPriceUnitType

    return {
        nombre: d.name || '',
        precio_actual: precioActual,
        precio_por_kg: precioKg,
        unidad: 'kg',
        url_producto: url || '',
        imagen_url: imagen,
        marca: d.brand?.name || 'Consum',
        cantidad,
        disponible: d.availability !== '0',
        categoria,
    }
}

async function scrapearConsum() {
    const inicio = Date.now()
    const errores = []
    const productos = []

    try {
        console.log('[Consum] Obteniendo árbol de categorías...')
        const catsRaw = await fetchConsumJSON(`${CONSUM_BASE}/api/rest/V1.0/shopping/category/menu`)
        const categorias = Array.isArray(catsRaw) ? catsRaw : []
        console.log(`[Consum] ${categorias.length} categorías principales`)

        const leafCats = []
        const extractLeaves = (cats) => {
            for (const c of cats) {
                if (c.subcategories && c.subcategories.length > 0) extractLeaves(c.subcategories)
                else leafCats.push({ id: c.id, name: c.name || c.nombre })
            }
        }
        extractLeaves(categorias)
        console.log(`[Consum] ${leafCats.length} categorías hoja`)

        for (let i = 0; i < leafCats.length; i++) {
            const cat = leafCats[i]
            await delay(300)

            try {
                const result = await fetchConsumJSON(
                    `${CONSUM_BASE}/api/rest/V1.0/catalog/product?limit=100&orderById=7&categories=${cat.id}`
                )
                const prods = result.products || []
                for (const p of prods) {
                    productos.push(mapearProductoConsum(p, cat.name))
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                errores.push(`Error categoría ${cat.name}: ${msg}`)
            }

            if (i > 0 && i % 10 === 0) {
                console.log(`[Consum] ${i}/${leafCats.length} categorías — ${productos.length} productos`)
            }
        }

        console.log(`[Consum] ${productos.length} productos totales`)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Error general: ${msg}`)
        console.error('[Consum] Error:', msg)
    }

    return { productos, errores, duracion_ms: Date.now() - inicio }
}

// ── EROSKI (Playwright) ────────────────────────────────────────

async function scrapearEroski() {
    const inicio = Date.now()
    const errores = []
    const productos = []
    let browser

    try {
        console.log('[Eroski] Lanzando navegador Playwright...')
        const { chromium } = await import('playwright')
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

        console.log('[Eroski] Obteniendo categorías...')
        let categorias = []

        try {
            await page.goto('https://supermercado.eroski.es/es/', {
                waitUntil: 'networkidle',
                timeout: 30000,
            }).catch(() => { })
            await page.waitForTimeout(3000)

            categorias = await page.evaluate(() => {
                const links = []
                const seen = new Set()
                const anchors = document.querySelectorAll(
                    'a[href*="/es/c/"], nav a[href*="/categoria"], .menu-item a[href*="/c/"], [class*="category"] a[href], a[href*="Alimentacion"], a[href*="alimentacion"]'
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
        } catch { }

        console.log(`[Eroski] ${categorias.length} categorías encontradas`)

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

        const maxCats = Math.min(categorias.length, 12)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Eroski] Categoría ${i + 1}/${maxCats}: ${cat.name}`)
            await delay(800)

            try {
                await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
                await page.waitForTimeout(3000)

                await page.evaluate(async () => {
                    for (let s = 0; s < document.body.scrollHeight; s += 500) {
                        window.scrollTo(0, s)
                        await new Promise(r => setTimeout(r, 400))
                    }
                })
                await page.waitForTimeout(1000)

                const prods = await page.evaluate((catName) => {
                    const items = []
                    const cards = document.querySelectorAll(
                        '[class*="product-card"], [class*="product-item"], [class*="product"], li[class*="product"], .grid-item, article'
                    )
                    cards.forEach(card => {
                        const nombreEl = card.querySelector(
                            '[class*="product-name"], [class*="product-title"], [class*="name"], h3, h2, [class*="title"]'
                        )
                        const precioEl = card.querySelector(
                            '[class*="price"], .current-price, [class*="precio"], [data-price], [class*="offer"]'
                        )
                        const precioKgEl = card.querySelector(
                            '[class*="unit-price"], [class*="price-per"], [class*="base-price"], [class*="reference"]'
                        )
                        const urlEl = card.querySelector('a[href]')
                        const imgEl = card.querySelector('img')
                        const marcaEl = card.querySelector('[class*="brand"], [data-brand], [class*="marca"]')
                        const cantidadEl = card.querySelector(
                            '[class*="quantity"], [class*="weight"], [class*="packaging"], [data-quantity], [class*="amount"]'
                        )

                        const nombre = nombreEl?.textContent?.trim() || ''
                        const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
                        const precio = parseFloat(precioTexto) || 0
                        const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
                        const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

                        let href = urlEl?.href || ''
                        if (href && !href.startsWith('http')) href = `https://supermercado.eroski.es${href}`

                        if (nombre && precio > 0) {
                            items.push({
                                nombre, precio_actual: precio, precio_por_kg: precioKg,
                                unidad: 'kg', url_producto: href, imagen_url: imgEl?.src || '',
                                marca: marcaEl?.textContent?.trim() || 'Eroski',
                                cantidad: cantidadEl?.textContent?.trim() || undefined, disponible: true, categoria: catName,
                            })
                        }
                    })
                    return items
                }, cat.name)

                for (const p of prods) productos.push(p)
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

// ── LIDL (Playwright mejorado) ─────────────────────────────────

async function scrapearLidl() {
    const inicio = Date.now()
    const errores = []
    const productos = []
    let browser

    try {
        console.log('[Lidl] Lanzando navegador Playwright...')
        const { chromium } = await import('playwright')
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

        console.log('[Lidl] Obteniendo categorías de alimentación...')
        let categorias = []

        try {
            await page.goto('https://www.lidl.es/c/alimentacion', {
                waitUntil: 'networkidle',
                timeout: 30000,
            }).catch(() => { })
            await page.waitForTimeout(3000)

            categorias = await page.evaluate(() => {
                const links = []
                const seen = new Set()
                const anchors = document.querySelectorAll(
                    'a[href*="/c/"], a[data-category], nav a[href*="categoria"], [class*="category"] a[href], .nav-item a[href*="/c/"]'
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
        } catch { }

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

        const maxCats = Math.min(categorias.length, 10)

        for (let i = 0; i < maxCats; i++) {
            const cat = categorias[i]
            console.log(`[Lidl] Categoría ${i + 1}/${maxCats}: ${cat.name}`)
            await delay(1500)

            try {
                await page.goto(cat.url, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => { })
                await page.waitForTimeout(3000)

                await page.evaluate(async () => {
                    for (let s = 0; s < document.body.scrollHeight; s += 500) {
                        window.scrollTo(0, s)
                        await new Promise(r => setTimeout(r, 500))
                    }
                })
                await page.waitForTimeout(1000)

                const prods = await page.evaluate((catName) => {
                    const items = []
                    const cards = document.querySelectorAll(
                        'article[data-product], [class*="product-card"], [class*="product-item"], [class*="product"], [data-testid*="product"], .grid-item, li[class*="product"]'
                    )
                    cards.forEach(card => {
                        const nombreEl = card.querySelector(
                            '[data-product-name], [class*="product-name"], [class*="product-title"], [class*="name"], h3, h2, [class*="title"]'
                        )
                        const precioEl = card.querySelector(
                            '[data-product-price], [class*="price"], .current-price, [class*="precio"], .price'
                        )
                        const precioKgEl = card.querySelector(
                            '[class*="base-price"], [class*="unit-price"], [class*="price-per"], [class*="reference"]'
                        )
                        const urlEl = card.querySelector('a[href]')
                        const imgEl = card.querySelector('img')
                        const cantidadEl = card.querySelector(
                            '[class*="quantity"], [class*="weight"], [class*="packaging"], [data-quantity], [class*="amount"]'
                        )

                        const nombre = nombreEl?.textContent?.trim() || ''
                        const precioTexto = precioEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || '0'
                        const precio = parseFloat(precioTexto) || 0
                        const precioKgTexto = precioKgEl?.textContent?.replace(/[^\d,]/g, '').replace(',', '.') || ''
                        const precioKg = precioKgTexto ? parseFloat(precioKgTexto) : undefined

                        let href = urlEl?.href || ''
                        if (href && !href.startsWith('http')) href = `https://www.lidl.es${href}`

                        if (nombre && precio > 0) {
                            items.push({
                                nombre, precio_actual: precio, precio_por_kg: precioKg,
                                unidad: 'kg', url_producto: href, imagen_url: imgEl?.src || '',
                                marca: 'Lidl',
                                cantidad: cantidadEl?.textContent?.trim() || undefined, disponible: true, categoria: catName,
                            })
                        }
                    })
                    return items
                }, cat.name)

                for (const p of prods) productos.push(p)
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

// ═══════════════════════════════════════════════════════════════
//  PIPELINE OPTIMIZADO: BATCH UPSERT + DEDUP + LÍMITE
// ═══════════════════════════════════════════════════════════════

const MAX_PRODUCTOS_POR_SM = 1500
const BATCH_SIZE = 500
const DIAS_SIN_ACTUALIZAR = 30  // Si el precio tiene menos de 30 días, lo saltamos

/**
 * Busca o crea un alimento en la tabla `alimentos`
 * Cachea resultados en memoria para evitar queries repetidas
 */
const cacheAlimentos = new Map()

async function buscarOMCrearAlimento(nombreLimpio, categoria) {
    try {
        if (!nombreLimpio || nombreLimpio.length < 2) return null

        // Cache en memoria
        const cacheKey = nombreLimpio.toLowerCase()
        if (cacheAlimentos.has(cacheKey)) return cacheAlimentos.get(cacheKey)

        const { data: exacto } = await supabase
            .from('alimentos')
            .select('id')
            .ilike('nombre', nombreLimpio)
            .maybeSingle()
        if (exacto) {
            cacheAlimentos.set(cacheKey, exacto.id)
            return exacto.id
        }

        const { data: contains } = await supabase
            .from('alimentos')
            .select('id')
            .or(`nombre.ilike.%${nombreLimpio}%,nombre.ilike.${nombreLimpio}%`)
            .limit(1)
            .maybeSingle()
        if (contains) {
            cacheAlimentos.set(cacheKey, contains.id)
            return contains.id
        }

        const { data: nuevo, error } = await supabase
            .from('alimentos')
            .insert({
                nombre: nombreLimpio,
                categoria: categoria || 'Supermercado',
                calorias: 0, proteinas: 0, carbohidratos: 0, grasas: 0,
            })
            .select('id')
            .single()

        if (error) {
            process.stderr.write(`  ⚠️  No se pudo crear alimento "${nombreLimpio}": ${error.message}\n`)
            return null
        }
        cacheAlimentos.set(cacheKey, nuevo.id)
        return nuevo.id
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        process.stderr.write(`  ⚠️  Excepción en buscarOMCrearAlimento("${nombreLimpio}"): ${msg}\n`)
        return null
    }
}

/**
 * Carga productos existentes de un supermercado en un Map para
 * evitar consultas 1x1 y detectar si el precio ya está actualizado.
 */
async function cargarProductosExistentes(supermercadoId) {
    const map = new Map()
    try {
        let desde = 0
        const limite = 1000
        while (true) {
            const { data, error } = await supabase
                .from('productos_supermercado')
                .select('id, nombre_original, alimento_id, precio_por_kg, precio_unidad, fecha_precio')
                .eq('supermercado_id', supermercadoId)
                .range(desde, desde + limite - 1)
            if (error) {
                console.warn(`  ⚠️  Error cargando productos existentes: ${error.message}`)
                break
            }
            if (!data || data.length === 0) break
            for (const p of data) {
                map.set(p.nombre_original, p)
            }
            desde += limite
            if (data.length < limite) break
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`  ⚠️  Excepción cargando productos existentes: ${msg}`)
    }
    return map
}

/**
 * Procesa un supermercado completo:
 * 1. Scrapea productos
 * 2. Filtra comestibles
 * 3. Deduplica por limpiarNombre()
 * 4. Limita a MAX_PRODUCTOS_POR_SM
 * 5. Batch upsert en lotes de 500
 * 6. Sin histórico (precios de referencia)
 */
async function procesarSupermarket(slug, scrapeFn, supermercados) {
    const sm = supermercados[slug]
    if (!sm) {
        console.error(`❌ "${slug}" no encontrado en la BD. Ejecuta primero el seed.`)
        return
    }

    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  🏪  ${sm.nombre} (${sm.slug})`)
    console.log(`═══════════════════════════════════════════════\n`)

    // ── 1. Scrapear ──
    const resultado = await scrapeFn()

    console.log(`\n📊 Scraping:`)
    console.log(`   📦 Total: ${resultado.productos.length}`)
    console.log(`   ⚠️  Errores: ${resultado.errores.length}`)
    console.log(`   ⏱️  ${(resultado.duracion_ms / 1000).toFixed(1)}s`)

    if (resultado.errores.length > 0) {
        console.log('\n⚠️  Errores:')
        resultado.errores.forEach(e => console.log(`   • ${e}`))
    }

    // ── 2. Filtrar comestibles ──
    const comestibles = resultado.productos.filter(p => esComestible(p.categoria))
    const descartados = resultado.productos.length - comestibles.length
    console.log(`\n🍽️  Comestibles: ${comestibles.length}`)
    console.log(`🚫  Descartados: ${descartados}`)

    if (comestibles.length === 0) {
        console.log('\n⚠️  No hay productos comestibles.')
        return
    }

    // ── 3. Deduplicar por limpiarNombre() ──
    const dedupMap = new Map()
    for (const prod of comestibles) {
        const key = limpiarNombre(prod.nombre) || prod.nombre
        if (!dedupMap.has(key)) {
            dedupMap.set(key, prod)
        }
    }
    const unicos = Array.from(dedupMap.values())
    console.log(`\n🔍 Deduplicados: ${comestibles.length} → ${unicos.length} únicos`)

    // ── 4. Limitar a MAX_PRODUCTOS_POR_SM ──
    const limitados = unicos.slice(0, MAX_PRODUCTOS_POR_SM)
    if (unicos.length > MAX_PRODUCTOS_POR_SM) {
        console.log(`🎯 Limitado a ${MAX_PRODUCTOS_POR_SM} productos (de ${unicos.length} únicos)`)
    }

    // ── 5. Cargar productos existentes para detectar cambios ──
    console.log('\n⏳ Cargando productos existentes en Supabase...')
    const existentes = await cargarProductosExistentes(sm.id)
    console.log(`   ${existentes.size} productos existentes cargados`)

    // ── 6. Preparar batch upsert ──
    console.log('\n⏳ Guardando en Supabase (batch upsert)...')
    const hoy = new Date().toISOString().split('T')[0]
    let nuevos = 0, actualizados = 0, saltados = 0, errores = 0
    const batch = []

    for (let i = 0; i < limitados.length; i++) {
        const prod = limitados[i]

        // Verificar si ya existe con precio reciente
        const existente = existentes.get(prod.nombre)
        if (existente) {
            const fechaExistente = existente.fecha_precio
            if (fechaExistente) {
                const diffDias = Math.floor((Date.now() - new Date(fechaExistente).getTime()) / 86400000)
                if (diffDias < DIAS_SIN_ACTUALIZAR) {
                    // Comprobar si el precio ha cambiado
                    const precioActual = prod.precio_por_kg ?? prod.precio_actual
                    const precioExistente = existente.precio_por_kg ?? existente.precio_unidad
                    if (precioActual === precioExistente) {
                        saltados++
                        continue // Mismo precio, lo saltamos
                    }
                }
            }
        }

        // Buscar/crear alimento
        const nombreLimpio = limpiarNombre(prod.nombre)
        const alimentoId = await buscarOMCrearAlimento(nombreLimpio, prod.categoria)

        if (!alimentoId) {
            errores++
            continue
        }

        batch.push({
            supermercado_id: sm.id,
            nombre_original: prod.nombre,
            alimento_id: alimentoId,
            precio_por_kg: prod.precio_por_kg ?? prod.precio_actual,
            precio_unidad: prod.precio_actual !== (prod.precio_por_kg ?? prod.precio_actual)
                ? prod.precio_actual : null,
            unidad: prod.unidad || 'kg',
            url_producto: prod.url_producto || null,
            marca: prod.marca || null,
            fecha_precio: hoy,
        })

        // ── Flush batch cada BATCH_SIZE ──
        if (batch.length >= BATCH_SIZE) {
            const res = await flushBatch(sm.id, batch)
            nuevos += res.nuevos
            actualizados += res.actualizados
            errores += res.errores
            batch.length = 0
        }

        if ((i + 1) % 100 === 0 || i === 0) {
            const pct = (((i + 1) / limitados.length) * 100).toFixed(1)
            console.log(`   📊 ${i + 1}/${limitados.length} (${pct}%) · +${nuevos} · ~${actualizados} · ⏭${saltados} · err:${errores}`)
        }
    }

    // ── Flush batch restante ──
    if (batch.length > 0) {
        const res = await flushBatch(sm.id, batch)
        nuevos += res.nuevos
        actualizados += res.actualizados
        errores += res.errores
    }

    console.log(`\n📊 Resumen ${sm.nombre}:`)
    console.log(`   🆕 Nuevos:       ${nuevos}`)
    console.log(`   🔄 Actualizados: ${actualizados}`)
    console.log(`   ⏭ Saltados:     ${saltados}`)
    console.log(`   ❌ Errores:      ${errores}`)
    console.log(`   🍽️  Procesados:  ${limitados.length} (de ${comestibles.length} comestibles)`)
    console.log(`   🚫 Descartados:  ${descartados} (no comestibles)`)
    console.log(`   ⏱️  Scraping:    ${(resultado.duracion_ms / 1000).toFixed(1)}s`)
}

/**
 * Inserta o actualiza un lote de productos usando upsert con
 * la constraint (supermercado_id, nombre_original).
 */
async function flushBatch(supermercadoId, batch) {
    let nuevos = 0, actualizados = 0, errores = 0

    try {
        // Upsert respetando unique constraint (supermercado_id, nombre_original)
        const { data, error } = await supabase
            .from('productos_supermercado')
            .upsert(batch, {
                onConflict: 'supermercado_id,nombre_original',
                ignoreDuplicates: false,
            })
            .select('id')

        if (error) {
            // Fallback: insertar 1x1 si falla el batch
            console.warn(`   ⚠️  Batch upsert falló (${error.message}), insertando 1x1...`)
            for (const item of batch) {
                try {
                    const { error: insError } = await supabase
                        .from('productos_supermercado')
                        .upsert(item, {
                            onConflict: 'supermercado_id,nombre_original',
                            ignoreDuplicates: false,
                        })
                    if (insError) {
                        if (!insError.message?.includes('duplicate')) {
                            errores++
                        }
                    } else {
                        nuevos++
                    }
                } catch {
                    errores++
                }
            }
        } else {
            // Si devuelve datos, contamos
            if (data) {
                nuevos = data.length
            } else {
                // upsert sin returning - asumimos éxito
                nuevos = batch.length
            }
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`   ⚠️  Error en flushBatch: ${msg}`)
        errores = batch.length
    }

    return { nuevos, actualizados, errores }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════

const MODOS = {
    mercadona: scrapearMercadona,
    carrefour: scrapearCarrefour,
    dia: scrapearDia,
    alcampo: scrapearAlcampo,
    consum: scrapearConsum,
    eroski: scrapearEroski,
    lidl: scrapearLidl,
}

async function main() {
    const args = process.argv.slice(2)
    const flags = args.filter(a => a.startsWith('--')).map(a => a.replace('--', ''))

    let slugsAEjecutar

    if (flags.includes('all') || flags.length === 0) {
        slugsAEjecutar = Object.keys(MODOS)
    } else {
        slugsAEjecutar = flags.filter(f => MODOS[f])
        if (slugsAEjecutar.length === 0) {
            console.error('❌ Modo no reconocido. Usa: --mercadona, --carrefour, --dia, --alcampo, --consum, --eroski, --lidl')
            process.exit(1)
        }
    }

    console.log('═══════════════════════════════════════════════')
    console.log('  🛒  NutriCoach · Consolidación de Scraping')
    console.log(`  Modo: ${slugsAEjecutar.join(', ')}`)
    console.log('═══════════════════════════════════════════════\n')

    const { data: supermercados, error: smError } = await supabase
        .from('supermercados')
        .select('*')
        .eq('activo', true)

    if (smError) {
        console.error('❌ Error al obtener supermercados:', smError.message)
        process.exit(1)
    }

    const smMap = {}
    for (const sm of supermercados) smMap[sm.slug] = sm

    const inicioTotal = Date.now()

    for (const slug of slugsAEjecutar) {
        const scrapeFn = MODOS[slug]
        if (scrapeFn) {
            try {
                await procesarSupermarket(slug, scrapeFn, smMap)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.error(`\n❌ Error crítico en "${slug}": ${msg}`)
                console.warn(`   ⏩ Continuando con el siguiente supermercado...\n`)
            }
        } else {
            console.warn(`⚠️  No hay scraper para "${slug}"`)
        }
    }

    const totalMs = Date.now() - inicioTotal
    console.log(`\n═══════════════════════════════════════════════`)
    console.log(`  ✅ Consolidación completada en ${(totalMs / 1000 / 60).toFixed(1)} min (${(totalMs / 1000).toFixed(0)}s)`)
    console.log(`═══════════════════════════════════════════════`)
}

main().catch(err => {
    console.error('\n❌ Error fatal:', err)
    process.exit(1)
})

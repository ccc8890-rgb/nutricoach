/**
 * diagnosticar-dia.ts — Prueba múltiples estrategias contra el WAF de Día
 *
 * Estrategias probadas:
 *   1. Headless normal (control)
 *   2. Headless + flags anti-detección (--disable-blink-features=AutomationControlled)
 *   3. Stealth: ocultar navigator.webdriver, mockear chrome.runtime, etc.
 *   4. No-headless (modo visible, requiere usuario mirando)
 *   5. Sin cookies iniciales (context limpio) + primer load homepage
 *   6. Con cookies/gelatina persistente (simulando sesión real)
 *
 * Web: https://www.dia.es/compra-online/
 */

import { chromium } from 'playwright'

/* ─── Estrategias ─── */

interface Estrategia {
    nombre: string
    headless: boolean
    extraArgs: string[]
    stealthJs?: string         // JS a inyectar en la página antes de navegar
    usarHomepageFirst?: boolean // Cargar homepage antes de la URL objetivo
    descripcion: string
}

const ESTRATEGIAS: Estrategia[] = [
    {
        nombre: 'Headless Normal',
        headless: true,
        extraArgs: [],
        descripcion: 'Igual que el scraper actual (control)',
    },
    {
        nombre: 'Headless + AntiAutomation',
        headless: true,
        extraArgs: [
            '--disable-blink-features=AutomationControlled',
            '--disable-automation',
        ],
        descripcion: 'Desactiva flags de automatización de Chrome',
    },
    {
        nombre: 'Headless + Stealth JS',
        headless: true,
        extraArgs: [
            '--disable-blink-features=AutomationControlled',
            '--disable-automation',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
        ],
        stealthJs: `
            // Ocultar navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

            // Mockear chrome.runtime (Playwright no lo tiene)
            Object.defineProperty(window, 'chrome', {
                get: () => ({
                    runtime: { connect: () => {}, sendMessage: () => {} },
                    loadTimes: () => {},
                    csi: () => {},
                    app: {},
                }),
            });

            // Mockear permisos
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (params) =>
                params.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(params);

            // Añadir plugins (headless no los tiene)
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Añadir lenguajes
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-ES', 'es', 'en'],
            });
        `,
        descripcion: 'Inyecta JS para ocultar navigator.webdriver y simular navegador real',
    },
    {
        nombre: 'Homepage First + Stealth',
        headless: true,
        extraArgs: [
            '--disable-blink-features=AutomationControlled',
            '--disable-automation',
            '--no-sandbox',
            '--disable-setuid-sandbox',
        ],
        stealthJs: `
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(window, 'chrome', {
                get: () => ({
                    runtime: { connect: () => {}, sendMessage: () => {} },
                    loadTimes: () => {},
                    csi: () => {},
                    app: {},
                }),
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-ES', 'es', 'en'],
            });
        `,
        usarHomepageFirst: true,
        descripcion: 'Carga homepage primero (como Carrefour) + stealth JS',
    },
]

/* ─── URLs a probar ─── */

const URLS_A_PROBAR = [
    { nombre: 'Homepage', url: 'https://www.dia.es/compra-online/' },
    { nombre: 'Categoría Alimentación', url: 'https://www.dia.es/compra-online/alimentacion/c/AL00' },
    { nombre: 'Categoría Leches', url: 'https://www.dia.es/compra-online/leches-y-postres/c/AL01' },
]

/* ─── Diagnóstico ─── */

interface ResultadoEstrategia {
    nombre: string
    url: string
    urlFinal: string
    status: number
    titulo: string
    bodySize: number
    tieneProductos: boolean
    tieneAccessDenied: boolean
    esPaginaProductos: boolean
    selectoresEncontrados: Record<string, number>
    sampleProductos: string[]
    error?: string
}

async function diagnosticar() {
    console.log('=== DIAGNÓSTICO DÍA — PRUEBA DE ESTRATEGIAS ANTI-WAF ===\n')

    const resultados: ResultadoEstrategia[] = []

    for (const estrategia of ESTRATEGIAS) {
        console.log(`\n── Estrategia: ${estrategia.nombre} ──`)
        console.log(`  → ${estrategia.descripcion}`)

        for (const target of URLS_A_PROBAR) {
            console.log(`\n  📍 ${target.nombre}: ${target.url}`)

            const resultado = await probarEstrategia(estrategia, target.url)
            resultados.push(resultado)

            console.log(`     URL final: ${resultado.urlFinal}`)
            console.log(`     Title: ${resultado.titulo}`)
            console.log(`     Body: ${resultado.bodySize} bytes`)
            console.log(`     Access Denied: ${resultado.tieneAccessDenied ? '❌ SÍ' : '✅ NO'}`)
            console.log(`     Tiene productos: ${resultado.tieneProductos ? '✅' : '❌'}`)

            if (resultado.sampleProductos.length > 0) {
                console.log(`     Muestras:`)
                resultado.sampleProductos.slice(0, 5).forEach(p => console.log(`       - ${p}`))
            }

            // Si hay selectores relevantes
            const selsConDatos = Object.entries(resultado.selectoresEncontrados)
                .filter(([, count]) => count > 0)
            if (selsConDatos.length > 0) {
                console.log(`     Selectores:`)
                selsConDatos.forEach(([sel, count]) => console.log(`       ${sel}: ${count}`))
            }

            if (resultado.error) {
                console.log(`     ⚠️ Error: ${resultado.error.slice(0, 200)}`)
            }
        }
    }

    /* ─── Resumen ─── */
    console.log('\n\n=== RESUMEN ===\n')

    for (const est of ESTRATEGIAS) {
        const r = resultados.filter(r => r.nombre === est.nombre)
        const ok = r.filter(r => !r.tieneAccessDenied && r.bodySize > 5000)
        const conProds = r.filter(r => r.tieneProductos)
        console.log(`\n${est.nombre}:`)
        console.log(`  URLs sin bloqueo: ${ok.length}/${r.length}`)
        console.log(`  URLs con productos: ${conProds.length}/${r.length}`)
        if (ok.length > 0) {
            ok.forEach(o => console.log(`  ✅ ${o.url}: ${o.bodySize} bytes, title="${o.titulo}"`))
        }
        if (conProds.length > 0) {
            conProds.forEach(c => console.log(`  🛒 ${c.url}: ${c.sampleProductos.length} muestras`))
        }
    }

    /* ─── Recomendación ─── */
    console.log('\n\n=== RECOMENDACIÓN ===\n')

    const mejorEstrategia = ESTRATEGIAS
        .map(est => {
            const r = resultados.filter(r => r.nombre === est.nombre)
            const exitosSinBloqueo = r.filter(r => !r.tieneAccessDenied && r.bodySize > 5000).length
            const exitosConProductos = r.filter(r => r.tieneProductos).length
            return {
                nombre: est.nombre,
                descripcion: est.descripcion,
                exitosSinBloqueo,
                exitosConProductos,
                totalUrls: r.length,
            }
        })
        .sort((a, b) => {
            // Priorizar: productos > sin bloqueo
            if (b.exitosConProductos !== a.exitosConProductos) return b.exitosConProductos - a.exitosConProductos
            return b.exitosSinBloqueo - a.exitosSinBloqueo
        })

    for (const est of mejorEstrategia) {
        const emoji = est.exitosConProductos > 0 ? '✅' : est.exitosSinBloqueo > 0 ? '⚠️' : '❌'
        console.log(`${emoji} ${est.nombre}: ${est.exitosConProductos} con productos, ${est.exitosSinBloqueo}/${est.totalUrls} sin bloqueo — ${est.descripcion}`)
    }

    const winner = mejorEstrategia[0]
    if (winner.exitosConProductos > 0 || winner.exitosSinBloqueo > 0) {
        console.log(`\n👉 Estrategia recomendada: "${winner.nombre}"`)
        console.log(`   ${winner.descripcion}`)
    } else {
        console.log(`\n❌ Ninguna estrategia funcionó.`)
        console.log(`   Alternativas a considerar:`)
        console.log(`   1. Usar puppeteer-extra con plugin-stealth`)
        console.log(`   2. Usar navegador real (no-headless) + `)
        console.log(`   3. Buscar API interna de Día (XHR/GraphQL)`)
        console.log(`   4. Usar un servicio de proxies residenciales`)
        console.log(`   5. Extraer datos de Google Shopping / Idealo`)
    }
}

async function probarEstrategia(
    estrategia: Estrategia,
    url: string
): Promise<ResultadoEstrategia> {
    let browser
    try {
        const args = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            ...estrategia.extraArgs,
        ]

        browser = await chromium.launch({
            headless: estrategia.headless,
            args,
        })

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            locale: 'es-ES',
            timezoneId: 'Europe/Madrid',
            // Añadir geolocalización para España
            geolocation: { latitude: 40.4168, longitude: -3.7038 },
            permissions: ['geolocation'],
            // Aceptar cookies implícitamente
            extraHTTPHeaders: {
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Sec-CH-UA': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
                'Sec-CH-UA-Mobile': '?0',
                'Sec-CH-UA-Platform': '"macOS"',
            },
        })

        const page = await context.newPage()

        // Si la estrategia usa homepage first, cargar homepage antes
        if (estrategia.usarHomepageFirst) {
            console.log(`     ↳ Cargando homepage primero...`)
            try {
                await page.goto('https://www.dia.es/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000,
                }).catch(() => { })
                await page.waitForTimeout(2000)
            } catch {
                // Si falla, continuamos igual
                console.log(`     ↳ Homepage no cargó, continuando...`)
            }
        }

        // Inyectar stealth JS si la estrategia lo incluye
        if (estrategia.stealthJs) {
            // Inyectar antes de navegar a la URL objetivo
            await context.addInitScript(estrategia.stealthJs)
        }

        // Navegar a la URL objetivo
        const resp = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        }).catch(() => null)

        await page.waitForTimeout(4000)

        const urlFinal = page.url()
        const titulo = await page.title().catch(() => '')
        const bodyText = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
        const bodyHtml = await page.evaluate(() => document.documentElement?.outerHTML || '').catch(() => '')
        const bodySize = bodyHtml.length

        // Detectar Access Denied / Cloudflare / WAF
        const tieneAccessDenied =
            bodyText.includes('Access Denied') ||
            bodyText.includes('access denied') ||
            bodyText.includes('blocked') ||
            bodyText.includes('Attention Required') ||
            bodyText.includes('Cloudflare') ||
            bodyText.includes('Just a moment') ||
            bodyHtml.includes('Access Denied') ||
            bodyHtml.includes('/cdn-cgi/') ||
            bodyHtml.includes('challenge-platform') ||
            bodySize < 5000

        // Buscar selectores de producto
        const selectoresEncontrados: Record<string, number> = {}
        const selectoresAProbar = [
            'article[data-product]',
            '[class*="product-card"]',
            '[class*="product-item"]',
            '[class*="product"]',
            '[data-testid*="product"]',
            '[class*="item-product"]',
            '[class*="grid-item"]',
            '[class*="product-grid"]',
            '.product',
            '[class*="result-item"]',
            '[class*="search-result"]',
            '[class*="product-list"]',
            // Selectores de Día específicos
            '[class*="dia-product"]',
            '[class*="producto"]',
            '[class*="precio"]',
            '[class*="price"]',
            // Links de producto
            'a[href*="/product/"]',
            'a[href*="/producto/"]',
            'a[href*="/p/"]',
        ]

        for (const sel of selectoresAProbar) {
            const count = await page.evaluate((s) => document.querySelectorAll(s).length, sel).catch(() => 0)
            if (count > 0) {
                selectoresEncontrados[sel] = count
            }
        }

        // También contar contenedores genéricos de productos
        const cards = await page.evaluate(() => {
            const cards: string[] = []
            // Buscar elementos que contengan precio + nombre
            const allElements = document.querySelectorAll('a[href], div[class]')
            const seen = new Set<string>()
            allElements.forEach(el => {
                const text = el.textContent?.trim() || ''
                // Si tiene precio (€) y no es header/footer
                if (text.includes('€') && text.length > 10 && text.length < 200) {
                    const key = text.slice(0, 50)
                    if (!seen.has(key)) {
                        seen.add(key)
                        cards.push(text)
                    }
                }
            })
            return cards.slice(0, 20)
        }).catch(() => [])

        // Extraer nombre de página para debugging
        const pageInfo = await page.evaluate(() => {
            return {
                h1: document.querySelector('h1')?.textContent?.trim() || '',
                h2: Array.from(document.querySelectorAll('h2')).slice(0, 5).map(h => h.textContent?.trim()),
                breadcrumbs: Array.from(document.querySelectorAll('[class*="breadcrumb"] a, nav a')).slice(0, 5).map(a => a.textContent?.trim()),
                links: Array.from(document.querySelectorAll('a[href*="/c/"], a[href*="categoria"]')).slice(0, 10).map(a => ({
                    text: a.textContent?.trim(),
                    href: (a as HTMLAnchorElement).href,
                })),
            }
        }).catch(() => ({ h1: '', h2: [], breadcrumbs: [], links: [] }))

        const status = resp?.status() || 0

        return {
            nombre: estrategia.nombre,
            url,
            urlFinal,
            status,
            titulo,
            bodySize,
            tieneProductos: cards.length > 0 || Object.values(selectoresEncontrados).some(c => c > 5),
            tieneAccessDenied,
            esPaginaProductos: pageInfo.h1.toLowerCase().includes('producto') || pageInfo.h1.toLowerCase().includes('categor'),
            selectoresEncontrados,
            sampleProductos: cards,
        }
    } catch (err) {
        return {
            nombre: estrategia.nombre,
            url,
            urlFinal: '',
            status: 0,
            titulo: '',
            bodySize: 0,
            tieneProductos: false,
            tieneAccessDenied: true,
            esPaginaProductos: false,
            selectoresEncontrados: {},
            sampleProductos: [],
            error: err instanceof Error ? err.message : String(err),
        }
    } finally {
        if (browser) await browser.close().catch(() => { })
    }
}

diagnosticar().catch(console.error)

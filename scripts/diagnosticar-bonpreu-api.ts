/**
 * Diagnóstico Bonpreu — Búsqueda de datos ocultos en SPA
 *
 * Objetivo: Encontrar cómo extraer productos a pesar de que la SPA
 * no hidrata los skeletons en headless Playwright.
 *
 * Estrategias:
 * 1. Buscar __NEXT_DATA__ (JSON SSR)
 * 2. Buscar script tags con datos de producto
 * 3. Interceptar peticiones XHR/fetch para detectar APIs
 * 4. Buscar en el textContent del body patrones de producto
 *
 * Uso: npx tsx scripts/diagnosticar-bonpreu-api.ts
 */
import { chromium } from 'playwright'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'ca-ES',
        extraHTTPHeaders: { 'Accept-Language': 'ca-ES,ca;q=0.9,es;q=0.8' },
    })

    const page = await context.newPage()

    // ── Interceptar XHR/fetch para detectar APIs ──
    const apisDetectadas: string[] = []
    page.on('request', (req) => {
        const url = req.url()
        if (req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
            const entry = `[${req.method()}] ${url}`
            if (!apisDetectadas.includes(entry)) {
                apisDetectadas.push(entry)
            }
        }
    })

    const responses: { url: string; status: number; body: string }[] = []
    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('api') || url.includes('graphql') || url.includes('products') || url.includes('search') || url.includes('categories')) {
            let body = ''
            try {
                body = (await res.text()).slice(0, 500)
            } catch { body = '(no body)' }
            responses.push({ url, status: res.status(), body })
        }
    })

    // ── Estrategia 1: Navegar a /categories/frescos/ con UUID ──
    const uuid = 'c95cfbf2-501d-433f-bae3-10fcef330b11'
    const urlCategoria = `${URL_BASE}/categories/frescos/${uuid}`

    console.log('📍 Navegando a:', urlCategoria)
    try {
        await page.goto(urlCategoria, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e: any) { console.log('   ⚠️ timeout') }
    await page.waitForTimeout(8000)

    // Scroll
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.3)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight * 0.6)`)
    await page.waitForTimeout(1000)
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`)
    await page.waitForTimeout(2000)

    // ── Estrategia 2: Buscar __NEXT_DATA__ ──
    console.log('\n🔍 ESTRATEGIA 1: __NEXT_DATA__')
    const nextData = await page.evaluate(`(() => {
        var el = document.getElementById('__NEXT_DATA__');
        if (!el) return null;
        try {
            var data = JSON.parse(el.textContent || '{}');
            return {
                exists: true,
                keys: Object.keys(data).slice(0, 20),
                propsKeys: data.props ? Object.keys(data.props.pageProps || {}).slice(0, 20) : [],
                size: (el.textContent || '').length,
                preview: JSON.stringify(data).slice(0, 2000),
            };
        } catch(e) { return { exists: true, error: e.message }; }
    })()`)
    console.log('   __NEXT_DATA__:', JSON.stringify(nextData, null, 2))

    // ── Estrategia 3: Buscar script tags con datos ──
    console.log('\n🔍 ESTRATEGIA 2: Script tags con datos')
    const scripts = await page.evaluate(`(() => {
        var scripts = document.querySelectorAll('script');
        var results = [];
        for (var i = 0; i < scripts.length; i++) {
            var s = scripts[i];
            var text = (s.textContent || s.innerHTML || '').trim();
            if (text.length > 100 && (text.indexOf('product') !== -1 || text.indexOf('price') !== -1 || text.indexOf('preu') !== -1 || text.indexOf('precio') !== -1)) {
                results.push({
                    id: s.id || '(no id)',
                    type: s.type || '(no type)',
                    src: s.src || '(inline)',
                    size: text.length,
                    preview: text.slice(0, 500),
                });
            }
        }
        return results;
    })()`)
    console.log('   Scripts con datos de producto:', (scripts as any[]).length)
    for (const s of (scripts as any[])) {
        console.log(`   - <script id="${s.id}" type="${s.type}"> (${s.size} bytes)`)
        console.log(`     ${s.preview.slice(0, 200)}`)
    }

    // ── Estrategia 4: Buscar texto de producto en body ──
    console.log('\n🔍 ESTRATEGIA 3: Texto de productos en body')
    const bodyText = await page.evaluate(`(() => {
        var text = document.body ? document.body.innerText : '';
        var lines = text.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        // Buscar líneas que parezcan productos (con precio €)
        var productLines = [];
        for (var i = 0; i < lines.length; i++) {
            var l = lines[i];
            if (l.indexOf('€') !== -1 || l.indexOf('EUR') !== -1) {
                // Capturar también la línea anterior (nombre) si existe
                var context = '';
                if (i > 0) context = lines[i-1] + ' | ';
                productLines.push(context + l);
            }
        }
        return {
            totalLines: lines.length,
            linesWithEuro: productLines.length,
            preview: productLines.slice(0, 30),
        };
    })()`)
    console.log('   Líneas totales en body:', (bodyText as any).totalLines)
    console.log('   Líneas con €:', (bodyText as any).linesWithEuro)
    const preview = (bodyText as any).preview as string[]
    for (const line of preview.slice(0, 20)) {
        console.log('   💰 ' + line)
    }

    // ── Estrategia 5: Buscar elementos ocultos con datos ──
    // ── Estrategia 6: Extraer de __INITIAL_STATE__ ──
    console.log('\n🔍 ESTRATEGIA 6: window.__INITIAL_STATE__ (datos de producto)')
    const initialState = await page.evaluate(`(() => {
        var w = window;
        var st = w.__INITIAL_STATE__;
        if (!st) return { exists: false };
        var keys = Object.keys(st);
        // Buscar datos de producto dentro del estado
        var data = st.data || {};
        var dataKeys = Object.keys(data);
        // Buscar productos en varias ubicaciones típicas
        var productSources = {};
        for (var dk in data) {
            var val = data[dk];
            if (val && typeof val === 'object' && val.data && Array.isArray(val.data)) {
                productSources[dk + '.data'] = val.data.length + ' items';
            }
            if (val && typeof val === 'object' && val.items && Array.isArray(val.items)) {
                productSources[dk + '.items'] = val.items.length + ' items';
            }
            if (val && typeof val === 'object' && val.products && Array.isArray(val.products)) {
                productSources[dk + '.products'] = val.products.length + ' items';
            }
        }
        return {
            exists: true,
            size: JSON.stringify(st).length,
            topKeys: keys.slice(0, 20),
            dataKeys: dataKeys.slice(0, 20),
            productSources: productSources,
            // Preview de los datos
            preview: JSON.stringify(st).slice(0, 3000),
        };
    })()`)
    console.log('   __INITIAL_STATE__ existe:', (initialState as any).exists)
    console.log('   Tamaño:', (initialState as any).size, 'bytes')
    console.log('   Keys top-level:', JSON.stringify((initialState as any).topKeys))
    console.log('   data keys:', JSON.stringify((initialState as any).dataKeys))
    console.log('   Posibles fuentes de producto:', JSON.stringify((initialState as any).productSources, null, 2))
    console.log('   Preview:', (initialState as any).preview.slice(0, 1500))

    // ── Estrategia 7: Extraer JSON-LD con productos ──
    console.log('\n🔍 ESTRATEGIA 7: JSON-LD productos (schema.org)')
    const jsonldItems = await page.evaluate(`(() => {
        var scripts = document.querySelectorAll('script[type="application/ld+json"]');
        var items = [];
        for (var i = 0; i < scripts.length; i++) {
            try {
                var data = JSON.parse(scripts[i].textContent || '{}');
                if (data.itemListElement && Array.isArray(data.itemListElement)) {
                    for (var j = 0; j < data.itemListElement.length; j++) {
                        var el = data.itemListElement[j];
                        items.push({
                            position: el.position,
                            url: el.url || '',
                            name: (el.item && el.item.name) || el.name || '',
                            description: (el.item && el.item.description) || '',
                            image: (el.item && el.item.image) || '',
                            offers: (el.item && el.item.offers) || null,
                        });
                    }
                }
            } catch(e) {}
        }
        return {
            total: items.length,
            preview: items.slice(0, 10),
        };
    })()`)
    console.log('   Total productos en JSON-LD:', (jsonldItems as any).total)
    for (const item of ((jsonldItems as any).preview || [])) {
        console.log('   #' + item.position + ' ' + item.name)
        console.log('     URL: ' + item.url)
        console.log('     Desc: ' + (item.description || '').slice(0, 80))
        console.log('     Img: ' + (item.image || '').slice(0, 80))
        if (item.offers) {
            console.log('     Offers:', JSON.stringify(item.offers).slice(0, 150))
        }
    }

    // ── Estrategia 6: Buscar JSON-LD (schema.org) ──
    console.log('\n🔍 ESTRATEGIA 5: JSON-LD (datos estructurados)')
    const jsonld = await page.evaluate(`(() => {
        var scripts = document.querySelectorAll('script[type="application/ld+json"]');
        var results = [];
        for (var i = 0; i < scripts.length; i++) {
            try {
                var data = JSON.parse(scripts[i].textContent || '{}');
                results.push({
                    type: Array.isArray(data) ? 'array' : typeof data,
                    keys: Object.keys(data).slice(0, 10),
                    preview: JSON.stringify(data).slice(0, 400),
                });
            } catch(e) {
                results.push({ error: e.message, preview: (scripts[i].textContent || '').slice(0, 200) });
            }
        }
        return results;
    })()`)
    console.log('   JSON-LD encontrados:', (jsonld as any[]).length)
    for (const j of (jsonld as any[])) {
        console.log(`   type=${j.type} keys=${JSON.stringify(j.keys)}`)
        console.log(`   ${(j.preview || '').slice(0, 300)}`)
    }

    // ── Mostrar APIs detectadas ──
    console.log('\n🌐 APIs interceptadas durante navegación:')
    for (const api of apisDetectadas) {
        console.log('   ' + api)
    }

    console.log('\n📡 Respuestas de API interceptadas:')
    for (const res of responses) {
        console.log(`   ${res.status} ${res.url.slice(0, 120)}`)
        console.log(`     body: ${res.body.slice(0, 200)}`)
    }

    await browser.close()
    console.log('\n✅ Diagnóstico completado')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

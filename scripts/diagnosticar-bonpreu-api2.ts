/**
 * Diagnóstico Bonpreu — Captura respuestas completas de la API de productos
 *
 * Uso: npx tsx scripts/diagnosticar-bonpreu-api2.ts
 */
import { chromium } from 'playwright'
import * as fs from 'fs'

const URL_BASE = 'https://www.compraonline.bonpreuesclat.cat'
const CATEGORY_UUID = 'c95cfbf2-501d-433f-bae3-10fcef330b11'

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

    // Interceptar respuestas de la API de productos
    const responses: any[] = []
    page.on('response', async (res) => {
        const url = res.url()
        if (url.includes('webproductpagews') || url.includes('graphql')) {
            let body = ''
            try {
                body = await res.text()
            } catch { body = '(no body)' }
            responses.push({
                url: url.slice(0, 120),
                status: res.status(),
                headers: res.headers(),
                bodyLength: body.length,
                body: body.length > 50000 ? body.slice(0, 50000) + '...[TRUNCATED]' : body,
            })
        }
    })

    // Navegar a categoría de frescos
    const categoriaUrl = `${URL_BASE}/categories/frescos/${CATEGORY_UUID}`
    console.log('📍 Navegando a:', categoriaUrl)
    try {
        await page.goto(categoriaUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    } catch (e: any) { console.log('   ⚠️ timeout') }
    await page.waitForTimeout(12000) // Esperar a que carguen todas las llamadas API

    // Guardar respuestas a archivo
    const outputPath = 'scripts/output-bonpreu-api.json'
    fs.writeFileSync(outputPath, JSON.stringify(responses, null, 2))

    // Mostrar resumen
    console.log(`\n📦 ${responses.length} respuestas API capturadas`)
    for (const r of responses) {
        console.log(`\n${r.status} ${r.url}`)
        console.log(`   Body: ${r.bodyLength} bytes`)
        // Mostrar primeros 300 chars del body
        console.log(`   Preview: ${r.body.slice(0, 300)}`)

        // Si es la API de productos, intentar parsear
        if (r.url.includes('webproductpagews')) {
            try {
                const json = JSON.parse(r.body)
                if (json.products) {
                    console.log(`   🏪 Productos en respuesta: ${json.products.length}`)
                    for (const p of json.products.slice(0, 5)) {
                        console.log(`   - ${p.name} | ${p.brand || ''} | ${p.packSizeDescription || ''} | price: ${p.price?.amount || p.price || '?'}`)
                    }
                }
                if (json.categories) {
                    console.log(`   📂 Categorías: ${json.categories.length}`)
                }
            } catch (e) { }
        }

        // Si es GraphQL
        if (r.url.includes('graphql')) {
            try {
                const json = JSON.parse(r.body)
                console.log(`   GraphQL keys: ${Object.keys(json.data || {}).join(', ')}`)
            } catch (e) { }
        }
    }

    // También extraer estados de __INITIAL_STATE__
    console.log('\n🔍 Extrayendo datos de __INITIAL_STATE__...')
    const stateInfo = await page.evaluate(`(() => {
        var w = window;
        var st = w.__INITIAL_STATE__;
        if (!st) return { error: 'no __INITIAL_STATE__' };
        var data = st.data || {};
        var result = {};

        // Buscar categorías
        if (data.categories && data.categories.data) {
            result.categoriesCount = data.categories.data.length;
            result.categoriesSample = data.categories.data.slice(0, 5).map(function(c) {
                return { id: c.id, name: c.name, url: c.url, productCount: c.productCount };
            });
        }

        // Buscar productos en categoryProducts o similar
        for (var key in data) {
            var val = data[key];
            if (val && val.data && Array.isArray(val.data)) {
                result['data_' + key] = val.data.length + ' items';
            }
            if (val && val.items && Array.isArray(val.items)) {
                result['items_' + key] = val.items.length + ' items';
            }
            if (val && val.products && Array.isArray(val.products)) {
                result['products_' + key] = val.products.length + ' items';
            }
        }

        // Buscar directamente propiedades que contengan arrays
        for (var key in data) {
            var val = data[key];
            if (val && typeof val === 'object' && !Array.isArray(val)) {
                for (var subkey in val) {
                    var subval = val[subkey];
                    if (Array.isArray(subval) && subval.length > 0 && subval[0] && subval[0].name) {
                        result['found_array_' + key + '.' + subkey] = subval.length + ' items, sample: ' + (subval[0].name || '');
                        if (!result.samples) result.samples = [];
                        result.samples.push({ source: key + '.' + subkey, items: subval.slice(0, 3) });
                    }
                }
            }
        }

        return result;
    })()`)
    console.log(JSON.stringify(stateInfo, null, 2))

    await browser.close()
    console.log('\n✅ Diagnóstico guardado en:', outputPath)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

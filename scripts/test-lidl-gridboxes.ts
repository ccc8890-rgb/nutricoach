/**
 * test-lidl-gridboxes.ts — Verifica el formato real de la API gridboxes de Lidl
 * Extrae erpNumbers de los productos ya en BD y consulta gridboxes para ver la respuesta
 *
 * Uso: env $(cat .env.local | grep -v '^#' | xargs) npx tsx scripts/test-lidl-gridboxes.ts
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

const LIDL_UUID = '29d40fe3-c49d-40c9-b61b-5072f704ec35'
const GRIDBOXES_API = 'https://www.lidl.es/p/api/gridboxes/ES/es'

function extraerErpNumber(url: string): string | null {
    const match = url.match(/\/p(\d{6,12})(?:[?#/]|$)/)
    return match ? match[1] : null
}

async function main() {
    // 1. Obtener URLs de productos Lidl en BD
    const { data: productos } = await supabase
        .from('productos_supermercado')
        .select('url_producto, nombre_original')
        .eq('supermercado_id', LIDL_UUID)
        .not('url_producto', 'is', null)
        .limit(10)

    if (!productos?.length) {
        console.log('No hay productos Lidl con URL en BD')
        return
    }

    const erpNumbers: string[] = []
    for (const p of productos) {
        const erp = extraerErpNumber(p.url_producto)
        if (erp) {
            erpNumbers.push(erp)
            console.log(`URL: ${p.url_producto}`)
            console.log(`  → erpNumber: ${erp}`)
            console.log(`  → nombre: ${p.nombre_original}`)
        }
    }

    if (!erpNumbers.length) {
        console.log('\n❌ No se pudieron extraer erpNumbers de las URLs')
        console.log('URLs encontradas:')
        productos.forEach(p => console.log(`  ${p.url_producto}`))
        return
    }

    console.log(`\n✅ ${erpNumbers.length} erpNumbers extraídos: ${erpNumbers.join(', ')}`)

    // 2. Obtener cookies de sesión con Playwright
    console.log('\n[Playwright] Obteniendo cookies de sesión...')
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    })
    const page = await context.newPage()
    await page.goto('https://www.lidl.es/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
    const cookies = await context.cookies()
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ')
    await browser.close()
    console.log(`[Playwright] ${cookies.length} cookies capturadas`)

    // 3. Llamar a gridboxes API
    const url = `${GRIDBOXES_API}?erpNumbers=${erpNumbers.join(',')}`
    console.log(`\n[Gridboxes] GET ${url}`)

    const resp = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cookie': cookieHeader,
            'Referer': 'https://www.lidl.es/',
            'Origin': 'https://www.lidl.es',
        },
    })

    console.log(`HTTP ${resp.status} ${resp.statusText}`)
    console.log('Content-Type:', resp.headers.get('content-type'))
    console.log('Content-Encoding:', resp.headers.get('content-encoding'))

    const text = await resp.text()
    console.log(`\nRespuesta (${text.length} chars):`)
    console.log(text.substring(0, 2000))

    // Intentar parsear
    try {
        const data = JSON.parse(text)
        console.log('\n=== ESTRUCTURA JSON ===')
        if (Array.isArray(data)) {
            console.log(`Array con ${data.length} elementos`)
            if (data.length > 0) {
                console.log('Claves del primer elemento:', Object.keys(data[0]).join(', '))
                console.log('\nPrimer elemento completo:')
                console.log(JSON.stringify(data[0], null, 2).substring(0, 1000))
            }
        } else if (typeof data === 'object') {
            console.log('Objeto con claves:', Object.keys(data).join(', '))
            console.log(JSON.stringify(data, null, 2).substring(0, 1000))
        }
    } catch {
        console.log('No se pudo parsear como JSON')
    }
}

main().catch(console.error)

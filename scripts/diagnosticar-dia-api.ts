/**
 * diagnosticar-dia-api.ts — Busca APIs internas y endpoints HTTP de Día
 *
 * Día bloquea headless Playwright completamente.
 * Probemos si tienen una API interna tipo GraphQL o REST que podamos llamar
 * directamente con fetch (sin navegador).
 */

/* ─── Posibles endpoints API de Día ─── */

interface ApiTest {
    nombre: string
    url: string
    metodo: 'GET' | 'POST'
    headers?: Record<string, string>
    body?: string
}

const ENDPOINTS: ApiTest[] = [
    // API pública de producto/search (patrones típicos de supermercados españoles)
    {
        nombre: 'API search pública',
        url: 'https://www.dia.es/api/search?q=leche&page=1&pageSize=20',
        metodo: 'GET',
    },
    {
        nombre: 'API GraphQL',
        url: 'https://www.dia.es/api/graphql',
        metodo: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: `{ products(search: "leche", first: 10) { edges { node { name price image } } } }`,
        }),
    },
    // Endpoints REST comunes
    {
        nombre: 'API productos REST',
        url: 'https://www.dia.es/compra-online/api/products?category=AL00',
        metodo: 'GET',
    },
    {
        nombre: 'API categorías REST',
        url: 'https://www.dia.es/compra-online/api/categories',
        metodo: 'GET',
    },
    // API de producto individual
    {
        nombre: 'API producto individual',
        url: 'https://www.dia.es/api/product/leche',
        metodo: 'GET',
    },
    // Posible API de búsqueda (empathy.co usada por Carrefour)
    {
        nombre: 'Empathy search API',
        url: 'https://api.empathy.co/v1/search?q=leche&scope=dia',
        metodo: 'GET',
    },
    // Sitemap/JSON-LD
    {
        nombre: 'Sitemap products',
        url: 'https://www.dia.es/sitemap-products.xml',
        metodo: 'GET',
    },
    // Store API (usada por apps móviles)
    {
        nombre: 'Store API v1',
        url: 'https://www.dia.es/api/v1/products?category=AL00',
        metodo: 'GET',
    },
    {
        nombre: 'Store API v2',
        url: 'https://api.dia.es/v2/products',
        metodo: 'GET',
    },
    // API de precios
    {
        nombre: 'Precios API',
        url: 'https://www.dia.es/api/v1/prices',
        metodo: 'GET',
    },
    // Product search con parámetros tipo comercio electrónico
    {
        nombre: 'Search con parámetros',
        url: 'https://www.dia.es/compra-online/search?q=leche&format=json',
        metodo: 'GET',
    },
    {
        nombre: 'Category JSON',
        url: 'https://www.dia.es/compra-online/alimentacion/c/AL00?format=json',
        metodo: 'GET',
    },
    // Headless CMS API (Contentful, Prismic, etc.)
    {
        nombre: 'API productos SSR',
        url: 'https://www.dia.es/_next/data/.../products.json',
        metodo: 'GET',
    },
    // Posible API de Open Data
    {
        nombre: 'OpenData Día',
        url: 'https://www.dia.es/opendata/products',
        metodo: 'GET',
    },
]

/* ─── Diagnóstico ─── */

interface ApiResult {
    nombre: string
    url: string
    status: number
    contentType: string
    bodySize: number
    esJSON: boolean
    contieneProductos: boolean
    sampleData?: string
    error?: string
}

async function probarEndpoint(ep: ApiTest): Promise<ApiResult> {
    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const resp = await fetch(ep.url, {
            method: ep.metodo,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
                ...ep.headers,
            },
            body: ep.body,
            signal: controller.signal,
        })

        clearTimeout(timeout)

        const contentType = resp.headers.get('content-type') || ''
        const text = await resp.text()
        const bodySize = text.length
        const esJSON = contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')

        // Detectar si contiene productos
        const contieneProductos = esJSON && (
            text.includes('"name"') ||
            text.includes('"nombre"') ||
            text.includes('"product"') ||
            text.includes('"price"') ||
            text.includes('"precio"') ||
            text.includes('"title"') ||
            text.includes('"products"') ||
            text.includes('"items"')
        )

        let sampleData: string | undefined
        if (esJSON && contieneProductos) {
            sampleData = text.slice(0, 500)
        } else if (esJSON) {
            sampleData = text.slice(0, 300)
        }

        return {
            nombre: ep.nombre,
            url: ep.url,
            status: resp.status,
            contentType,
            bodySize,
            esJSON,
            contieneProductos,
            sampleData,
        }
    } catch (err) {
        return {
            nombre: ep.nombre,
            url: ep.url,
            status: 0,
            contentType: '',
            bodySize: 0,
            esJSON: false,
            contieneProductos: false,
            error: err instanceof Error ? err.message : String(err),
        }
    }
}

async function diagnosticar() {
    console.log('=== DIAGNÓSTICO DÍA — BÚSQUEDA DE APIS INTERNAS ===\n')
    console.log('Probando', ENDPOINTS.length, 'posibles endpoints...\n')

    const resultados: ApiResult[] = []

    for (const ep of ENDPOINTS) {
        process.stdout.write(`  ${ep.metodo} ${ep.nombre}... `.padEnd(50))
        const r = await probarEndpoint(ep)
        resultados.push(r)

        if (r.error) {
            console.log(`❌ ${r.error.slice(0, 80)}`)
        } else if (r.status === 200 && r.esJSON && r.contieneProductos) {
            console.log(`✅ ${r.status} | ${r.bodySize} bytes | JSON con productos!`)
        } else if (r.status === 200 && r.esJSON) {
            console.log(`⚠️ ${r.status} | ${r.bodySize} bytes | JSON (sin productos detectados)`)
        } else if (r.status === 200) {
            console.log(`⚠️ ${r.status} | ${r.bodySize} bytes | ${r.contentType.slice(0, 30)}`)
        } else if (r.status === 404) {
            console.log(`🔍 404`)
        } else if (r.status === 403) {
            console.log(`🚫 403 Forbidden`)
        } else if (r.status === 429) {
            console.log(`⏳ 429 Rate Limited`)
        } else {
            console.log(`❓ ${r.status} | ${r.bodySize} bytes`)
        }
    }

    /* ─── Resumen ─── */
    const exitos = resultados.filter(r => r.status === 200 && r.esJSON && r.contieneProductos)
    const jsonSinProductos = resultados.filter(r => r.status === 200 && r.esJSON && !r.contieneProductos)
    const html = resultados.filter(r => r.status === 200 && !r.esJSON)

    console.log('\n\n=== RESUMEN ===')
    console.log(`\n✅ APIs con productos: ${exitos.length}`)
    for (const r of exitos) {
        console.log(`   • ${r.nombre}: ${r.url}`)
        if (r.sampleData) {
            console.log(`     Preview: ${r.sampleData.slice(0, 200)}`)
        }
    }

    console.log(`\n⚠️ APIs JSON (sin productos): ${jsonSinProductos.length}`)
    for (const r of jsonSinProductos) {
        console.log(`   • ${r.nombre}: ${r.url} — ${r.bodySize} bytes`)
        if (r.sampleData) {
            console.log(`     Preview: ${r.sampleData.slice(0, 200)}`)
        }
    }

    console.log(`\n📄 Páginas HTML: ${html.length}`)
    for (const r of html) {
        console.log(`   • ${r.nombre}: ${r.status} | ${r.bodySize} bytes`)
    }

    const errores = resultados.filter(r => r.error)
    console.log(`\n❌ Errores: ${errores.length}`)

    if (exitos.length === 0) {
        console.log('\n❌ No se encontraron APIs accesibles con fetch directo.')
        console.log('\nAlternativas restantes:')
        console.log('  1. puppeteer-extra con plugin-stealth (npm install puppeteer-extra puppeteer-extra-plugin-stealth)')
        console.log('  2. Modo no-headless con Playwright (requiere display, pero evita fingerprint headless)')
        console.log('  3. Proxy residencial (BrightData, ScrapingBee, etc.)')
        console.log('  4. Extraer datos de Google Shopping / Idealo / comparadores')
        console.log('  5. Usar Playwright con Firefox en vez de Chromium (fingerprint diferente)')
        console.log('  6. Copiar cookies de sesión real de un navegador normal')
    }
}

diagnosticar().catch(console.error)

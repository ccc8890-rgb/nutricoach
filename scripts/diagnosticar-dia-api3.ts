/**
 * diagnosticar-dia-api3.ts — Prueba los endpoints API reales de Día
 *
 * Basado en APIs encontradas en el HTML SPA:
 *   - /api/v2/home-back
 *   - /api/v1/search-back
 *   - /api/v1/search-insight
 *   - /api/v1/common-aggregator
 *   - /api/v2/home-insight
 */

async function probarEndpoint(url: string, metodo: string = 'GET', body?: string) {
    try {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'es-ES,es;q=0.9',
            'Origin': 'https://www.dia.es',
            'Referer': 'https://www.dia.es/',
        }
        if (body) {
            headers['Content-Type'] = 'application/json'
        }

        const resp = await fetch(url, {
            method: metodo,
            headers,
            body,
        })

        const text = await resp.text()
        const contentType = resp.headers.get('content-type') || ''

        const esJSON = contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[')

        let parsed: any = null
        if (esJSON) {
            try { parsed = JSON.parse(text) } catch { parsed = null }
        }

        return {
            url,
            status: resp.status,
            contentType,
            bodySize: text.length,
            esJSON,
            esObjeto: parsed !== null && typeof parsed === 'object',
            keys: parsed ? Object.keys(parsed).slice(0, 20) : [],
            contieneProductos: text.includes('"name"') || text.includes('"productName"') || text.includes('"title"') || text.includes('"products"') || text.includes('"items"') || text.includes('"results"'),
            preview: text.slice(0, 500),
            error: null,
        }
    } catch (err) {
        return {
            url,
            status: 0,
            contentType: '',
            bodySize: 0,
            esJSON: false,
            esObjeto: false,
            keys: [],
            contieneProductos: false,
            preview: '',
            error: err instanceof Error ? err.message : String(err),
        }
    }
}

async function diagnosticar() {
    console.log('=== DÍA — PRUEBA DE ENDPOINTS API REALES ===\n')

    const endpoints = [
        // APIs internas encontradas en el HTML
        { url: 'https://www.dia.es/api/v2/home-back', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v1/search-back', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v1/search-back?q=leche&page=1', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v1/search-insight', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v1/common-aggregator', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v2/home-insight', metodo: 'GET' },
        { url: 'https://www.dia.es/api/v1/list-back', metodo: 'GET' },
        // Version con parámetros de search
        { url: 'https://www.dia.es/api/v1/search-back?q=leche&page=1&pageSize=20&sort=relevance', metodo: 'GET' },
        // Con Content-Type JSON
        { url: 'https://www.dia.es/api/v1/search-back', metodo: 'POST', body: JSON.stringify({ query: 'leche', page: 1, pageSize: 20 }) },
        { url: 'https://www.dia.es/api/v2/home-back', metodo: 'POST', body: JSON.stringify({}) },
        // GraphQL-style
        { url: 'https://www.dia.es/api/v2/home-back/graphql', metodo: 'POST', body: JSON.stringify({ query: '{ products { name price } }' }) },
        // Intentar con headers específicos de Día (copiados del HTML)
        { url: 'https://www.dia.es/api/v2/home-back', metodo: 'GET', extra: { 'x-locale': 'es', 'x-cart-id': '', 'x-session-id': '' } },
    ]

    for (const ep of endpoints) {
        process.stdout.write(`  [${ep.metodo}] ${ep.url}... `.padEnd(60))
        const r = await probarEndpoint(ep.url, ep.metodo, (ep as any).body)

        if (r.error) {
            console.log(`❌ ${r.error.slice(0, 80)}`)
        } else if (r.status === 200 && r.esJSON && r.contieneProductos) {
            console.log(`✅ ${r.status} | ${r.bodySize} bytes | JSON con productos!`)
            console.log(`     Keys: ${r.keys.join(', ')}`)
        } else if (r.status === 200 && r.esJSON) {
            console.log(`⚠️ ${r.status} | ${r.bodySize} bytes | JSON (${r.keys.length} keys: ${r.keys.join(', ')})`)
            if (r.bodySize < 2000) {
                console.log(`     Preview: ${r.preview.slice(0, 300)}`)
            }
        } else if (r.status === 200) {
            console.log(`⚠️ ${r.status} | ${r.bodySize} bytes | ${r.contentType.slice(0, 30)}`)
            console.log(`     Preview: ${r.preview.slice(0, 300)}`)
        } else if (r.status === 404) {
            console.log(`🔍 404`)
        } else if (r.status === 403) {
            console.log(`🚫 403`)
        } else if (r.status === 400) {
            console.log(`❓ 400 | ${r.bodySize} bytes`)
            if (r.bodySize < 500) console.log(`     ${r.preview.slice(0, 200)}`)
        } else {
            console.log(`❓ ${r.status} | ${r.bodySize} bytes`)
            if (r.bodySize < 500) console.log(`     ${r.preview.slice(0, 200)}`)
        }
    }

    /* ─── Ahora extraemos los datos SSR del HTML directamente ─── */
    console.log('\n\n=== EXTRACCIÓN DE DATOS SSR ===\n')
    console.log('El HTML contiene un script de 59KB con datos de producto (pageProps).')
    console.log('Vamos a extraer los productos desde ahí.\n')

    const resp = await fetch('https://www.dia.es/compra-online/alimentacion/c/AL00', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
    })
    const html = await resp.text()

    // Extraer el script grande (pageContext)
    const scriptMatch = html.match(/<script[^>]*>(\{[\s\S]*?"pageProps"[\s\S]*?is404[\s\S]*?\})<\/script>/)
    if (scriptMatch) {
        const jsonStr = scriptMatch[1]
        console.log(`Script SSR encontrado: ${jsonStr.length} bytes\n`)

        try {
            const data = JSON.parse(jsonStr)
            console.log('Estructura del objeto SSR:')
            console.log(`  pageProps: ${data.pageProps ? '✅ presente' : '❌ ausente'}`)
            console.log(`  routeParams: ${JSON.stringify(data.routeParams)}`)
            console.log(`  is404: ${data.is404}`)

            if (data.pageProps) {
                console.log(`\n  pageProps keys: ${Object.keys(data.pageProps).join(', ')}`)

                // Buscar productos en pageProps
                function buscarProductos(obj: any, path: string = 'pageProps') {
                    if (!obj || typeof obj !== 'object') return
                    if (Array.isArray(obj)) {
                        if (obj.length > 0 && typeof obj[0] === 'object' && (obj[0].name || obj[0].productName || obj[0].title)) {
                            console.log(`\n  🛒 Array de productos en "${path}": ${obj.length} items`)
                            obj.slice(0, 5).forEach((p: any, i: number) => {
                                const name = p.name || p.productName || p.title || p.nombre || '?'
                                const price = p.price || p.precio || p.actualPrice || p.priceWithTax || '?'
                                console.log(`     ${i + 1}. ${name} — ${price}€`)
                            })
                            return true
                        }
                        for (let i = 0; i < obj.length; i++) {
                            if (buscarProductos(obj[i], `${path}[${i}]`)) return true
                        }
                        return false
                    }
                    for (const key of Object.keys(obj)) {
                        if (key === 'products' || key === 'items' || key === 'results' || key === 'productos') {
                            const arr = obj[key]
                            if (Array.isArray(arr) && arr.length > 0) {
                                console.log(`\n  🛒 "${path}.${key}": ${arr.length} items`)
                                arr.slice(0, 5).forEach((p: any, i: number) => {
                                    const name = p.name || p.productName || p.title || p.nombre || '?'
                                    const price = p.price || p.precio || p.actualPrice || '?'
                                    console.log(`     ${i + 1}. ${name} — ${price}€`)
                                })
                                return true
                            }
                        }
                        if (typeof obj[key] === 'object' && obj[key] !== null) {
                            if (buscarProductos(obj[key], `${path}.${key}`)) return true
                        }
                    }
                    return false
                }

                if (!buscarProductos(data.pageProps)) {
                    console.log('\n  No se encontraron productos en pageProps')
                    console.log(`  Primeras keys de pageProps:`)
                    const firstKeys = Object.keys(data.pageProps).slice(0, 10)
                    for (const k of firstKeys) {
                        const v = data.pageProps[k]
                        if (typeof v === 'object' && v !== null) {
                            const type = Array.isArray(v) ? `Array(${v.length})` : typeof v
                            console.log(`    ${k}: ${type}`)
                        } else {
                            console.log(`    ${k}: ${JSON.stringify(v).slice(0, 100)}`)
                        }
                    }
                }
            }
        } catch (err) {
            console.log(`Error parseando JSON SSR: ${err}`)
            // Mostrar fragmento
            console.log(`\nPrimeros 1000 chars del script:`)
            console.log(jsonStr.slice(0, 1000))
        }
    } else {
        console.log('No se encontró script SSR con pageProps')
        // Buscar cualquier script grande
        const allScripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi)
        if (allScripts) {
            const bigScripts = allScripts.filter(s => s.length > 5000)
            console.log(`Scripts grandes encontrados: ${bigScripts.length}`)
            bigScripts.forEach((s, i) => {
                const clean = s.replace(/<[^>]+>/g, '').trim()
                console.log(`  Script ${i + 1}: ${clean.length} chars — empieza con: ${clean.slice(0, 100)}`)
            })
        }
    }
}

diagnosticar().catch(console.error)

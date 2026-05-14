/**
 * diagnosticar-dia-api2.ts — Busca el endpoint API real de Día en el HTML SPA
 *
 * El HTML de Día (210KB) es un shell SPA. Los productos se cargan vía XHR.
 * Buscamos:
 *   1. URLs de API en los scripts del HTML
 *   2. Configuración de red/Axios/Fetch
 *   3. Endpoints en window.__INITIAL_STATE__ o similar
 *   4. Endpoints en los chunks JS
 */

async function diagnosticar() {
    console.log('=== DÍA — BÚSQUEDA DE API REAL EN EL SPA SHELL ===\n')

    const resp = await fetch('https://www.dia.es/compra-online/alimentacion/c/AL00', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
    })
    const html = await resp.text()

    // 1. Buscar scripts con configuración
    console.log('1. SCRIPTS CONFIG\n')
    const configScripts = html.match(/<script[^>]*>(?:window\.__|var\s+\w+\s*=|const\s+\w+\s*=)[^<]+<\/script>/gi)
    if (configScripts) {
        configScripts.slice(0, 5).forEach(s => {
            const clean = s.replace(/<[^>]+>/g, '').trim()
            if (clean.length > 20) {
                // Buscar URLs
                const urls = clean.match(/https?:\/\/[^"'\s,;]+/g)
                console.log(`  Script (${clean.length} chars):`)
                if (urls) urls.forEach(u => console.log(`    🔗 ${u}`))
                console.log(`    ${clean.slice(0, 400)}\n`)
            }
        })
    } else {
        console.log('  (no encontrados)\n')
    }

    // 2. Buscar cualquier URL de API en TODO el HTML
    console.log('2. POSIBLES URLS DE API\n')
    const apisUrls = new Set<string>()
    const urlPatterns = [
        /https?:\/\/[^"'\s<>]*api[^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]*\/v[12][^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]*\/graphql[^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]*\/rest[^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]*\/search[^"'\s<>]*/gi,
        /https?:\/\/[^"'\s<>]*\/(?:es\/)?api[^"'\s<>]*/gi,
    ]
    for (const pattern of urlPatterns) {
        const matches = html.match(pattern)
        if (matches) matches.forEach(m => apisUrls.add(m))
    }
    if (apisUrls.size > 0) {
        apisUrls.forEach(u => console.log(`  🔗 ${u}`))
    } else {
        console.log('  (ninguna URL de API encontrada — rutas relativas probablemente)')
    }

    // 3. Buscar rutas API relativas
    console.log('\n3. RUTAS API RELATIVAS\n')
    const apiPaths = new Set<string>()
    const pathPatterns = [
        /["']\/api\/[^"']+["']/gi,
        /["']\/v[12]\/[^"']+["']/gi,
        /["']\/graphql["']/gi,
        /["']\/rest\/[^"']+["']/gi,
        /["']\/search[\/"][^"']*["']/gi,
        /["']\/product[\/"][^"']*["']/gi,
        /["']\/category[\/"][^"']*["']/gi,
        /axios\.(?:get|post|put)\(["'][^"']+["']/gi,
        /fetch\(["'][^"']+["']/gi,
        /["']\/es\/api[^"']+["']/gi,
    ]
    for (const pattern of pathPatterns) {
        const matches = html.match(pattern)
        if (matches) matches.forEach(m => {
            const clean = m.replace(/["']/g, '').trim()
            if (clean.length > 5 && clean.length < 200) apiPaths.add(clean)
        })
    }
    if (apiPaths.size > 0) {
        apiPaths.forEach(p => console.log(`  📡 ${p}`))
    } else {
        console.log('  (ninguna encontrada en HTML — probablemente en chunks JS)')
    }

    // 4. Buscar en el último script (normalmente tiene pageContext o estado inicial)
    console.log('\n4. ÚLTIMOS SCRIPTS (pageContext/init state)\n')
    const scriptMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)
    let lastScripts: string[] = []
    for (const m of scriptMatches) {
        lastScripts.push(m[1])
    }
    // Los últimos 3 scripts suelen tener datos
    const relevantScripts = lastScripts.slice(-3)
    for (let i = 0; i < relevantScripts.length; i++) {
        const s = relevantScripts[i]
        console.log(`  Script #${lastScripts.length - 3 + i + 1} (${s.length} chars):`)
        // Buscar objetos JSON grandes
        const jsonObjects = s.match(/\{["'][^"']+["'][:][\s\S]*?\}/g)
        if (jsonObjects) {
            jsonObjects.slice(0, 3).forEach(j => {
                // Mostrar solo las keys
                const keys = j.match(/"\w+"/g)
                if (keys) console.log(`    Keys: ${keys.slice(0, 15).join(', ')}${keys.length > 15 ? '...' : ''}`)
                // Buscar URLs
                const urls = j.match(/https?:\/\/[^"'\s,;}\]]+/g)
                if (urls) urls.forEach(u => console.log(`    🔗 ${u}`))
            })
        }
        // Buscar fragmentos con "api" o "url"
        const apiFragments = s.match(/["'](?:api|url|endpoint|baseURL|baseUrl)["']\s*[:=]\s*["'][^"']+["']/gi)
        if (apiFragments) apiFragments.forEach(f => console.log(`    ⚙️ ${f.slice(0, 200)}`))
        console.log()
    }

    // 5. Extraer todos los src de scripts y analizar nombres de chunks
    console.log('5. CHUNKS JS\n')
    const scriptSrcs = html.match(/<script[^>]*src=["']([^"']+)["'][^>]*>/gi)
    if (scriptSrcs) {
        for (const s of scriptSrcs) {
            const srcMatch = s.match(/src=["']([^"']+)["']/)
            if (srcMatch) {
                const src = srcMatch[1]
                if (src.includes('chunk') || src.includes('app.') || src.includes('vendor.') || src.includes('main.')) {
                    console.log(`  📦 ${src}`)
                }
            }
        }
    }

    // 6. Buscar window.__INITIAL_STATE__, __NEXT_DATA__, __NUXT__, etc.
    console.log('\n6. ESTADO INICIAL (SSR data)\n')
    const statePatterns = [
        /window\.__INITIAL_STATE__\s*=\s*([^;]+)/,
        /window\.__NUXT__\s*=\s*([^;]+)/,
        /window\.__NEXT_DATA__\s*=\s*([^;]+)/,
        /window\.__DATA__\s*=\s*([^;]+)/,
        /window\.__INITIAL_ASYNC__\s*=\s*([^;]+)/,
        /window\.__PRELOADED_STATE__\s*=\s*([^;]+)/,
        /__INITIAL_STATE__\s*=\s*(\{[^;]+\})/,
        /window\.__APOLLO_STATE__\s*=\s*([^;]+)/,
    ]
    for (const pattern of statePatterns) {
        const match = html.match(pattern)
        if (match) {
            console.log(`  ✅ ${match[0].slice(0, 200)}...`)
            // Buscar URLs de API dentro del estado
            const urls = match[1].match(/https?:\/\/[^"'\s,;}\]]+/g)
            if (urls) urls.forEach(u => console.log(`     🔗 ${u}`))
        }
    }

    // 7. Buscar en los chunks JS descargados
    console.log('\n7. ANALIZANDO CHUNK JS PRINCIPAL\n')
    const mainScriptMatch = html.match(/<script[^>]*src=["']([^"']*(?:main|app)[^"']*\.js)["']/i)
    if (mainScriptMatch) {
        const mainJsUrl = mainScriptMatch[1].startsWith('http')
            ? mainScriptMatch[1]
            : `https://www.dia.es${mainScriptMatch[1]}`
        console.log(`  Descargando: ${mainJsUrl}`)
        try {
            const jsResp = await fetch(mainJsUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                },
            })
            if (jsResp.ok) {
                const js = await jsResp.text()
                console.log(`  Tamaño: ${js.length} bytes`)

                // Buscar URLs de API
                const apiUrlsInJs = new Set<string>()
                const patterns = [
                    /(?:api|endpoint|baseURL|baseUrl)\s*[:=]\s*["']([^"']+)["']/gi,
                    /axios\.create\s*\(\s*\{[^}]*baseURL[^}]*\}/gi,
                    /["']\/api\/[^"']+["']/gi,
                    /https?:\/\/[^"'\s,;]*api[^"'\s,;]*/gi,
                    /https?:\/\/[^"'\s,;]*(?:\.dia\.es)[^"'\s,;]*/gi,
                ]
                for (const p of patterns) {
                    const matches = js.match(p)
                    if (matches) matches.forEach(m => apiUrlsInJs.add(m))
                }
                if (apiUrlsInJs.size > 0) {
                    console.log(`  APIs encontradas en JS:`)
                    apiUrlsInJs.forEach(u => console.log(`    📡 ${u.slice(0, 200)}`))
                } else {
                    console.log('  (no se encontraron APIs en el chunk principal)')
                }

                // Buscar config de red
                const fetchMatches = js.match(/["']\/[^"']*(?:search|product|category|price)[^"']*["']/gi)
                if (fetchMatches) {
                    console.log(`\n  Posibles endpoints:`)
                    const unique = [...new Set(fetchMatches)]
                    unique.slice(0, 20).forEach(u => console.log(`    📡 ${u}`))
                }
            }
        } catch (err) {
            console.log(`  Error: ${err}`)
        }
    } else {
        console.log('  (no se encontró chunk main/app)')
    }

    console.log('\n=== DIAGNÓSTICO COMPLETADO ===')
}

diagnosticar().catch(console.error)

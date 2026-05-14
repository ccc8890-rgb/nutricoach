/**
 * diagnosticar-dom-scrapers.ts
 * 
 * Visita cada supermercado con Playwright, guarda el HTML renderizado
 * y muestra qué elementos existen realmente para actualizar selectores.
 * 
 * Uso: npx tsx scripts/diagnosticar-dom-scrapers.ts [supermercado]
 *      supermercado opcional: carrefour, lidl, dia (todos por defecto)
 */

import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const SUPERMERCARDOS: Record<string, { url: string; name: string }> = {
    carrefour: { url: 'https://www.carrefour.es/supermercado/', name: 'Carrefour' },
    lidl: { url: 'https://www.lidl.es/', name: 'Lidl' },
    dia: { url: 'https://www.dia.es/', name: 'Día' },
}

async function diagnosticar(slug: string, cfg: { url: string; name: string }) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🔍 Diagnosticando ${cfg.name} (${slug})`)
    console.log(`${'='.repeat(60)}`)

    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-ES',
    })

    const page = await context.newPage()

    try {
        // 1. Ir a la página principal
        console.log(`\n📄 Navegando a ${cfg.url}...`)
        await page.goto(cfg.url, {
            waitUntil: 'networkidle',
            timeout: 45000,
        }).catch(() => console.log('   (timeout, continuando)'))

        await page.waitForTimeout(3000)
        console.log(`   Title: ${await page.title()}`)
        console.log(`   URL final: ${page.url()}`)

        // 2. Guardar HTML completo
        const html = await page.content()
        const outDir = path.join(__dirname, '..', 'tmp', 'dom-diagnostics')
        fs.mkdirSync(outDir, { recursive: true })
        const htmlPath = path.join(outDir, `${slug}-full.html`)
        fs.writeFileSync(htmlPath, html)
        console.log(`   HTML guardado: ${htmlPath} (${(html.length / 1024).toFixed(0)} KB)`)

        // 3. Analizar enlaces de categorías de alimentación
        console.log(`\n🔗 Enlaces (a[href]):`)
        const enlaces = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href]'))
            return anchors
                .filter(a => (a as HTMLAnchorElement).href && a.textContent?.trim())
                .slice(0, 50)
                .map(a => {
                    const anchor = a as HTMLAnchorElement
                    return {
                        href: anchor.href.slice(0, 150),
                        text: (a.textContent || '').trim().slice(0, 60),
                        class: (a.className || '').slice(0, 80),
                        id: a.id?.slice(0, 40) || '',
                        data: Object.keys((a as HTMLElement).dataset).slice(0, 5).join(','),
                    }
                })
        })
        enlaces.forEach(e => {
            console.log(`   [${e.class}] "${e.text}" → ${e.href}`)
        })

        // 4. Buscar elementos con data-product o similar
        console.log(`\n🏷️ Elementos con data-product / article / [class*="product"]:`)
        const productEls = await page.evaluate(() => {
            const selectors = [
                'article[data-product]',
                '[class*="product-card"]',
                '[class*="product-item"]',
                '[class*="product"]',
                '[data-testid*="product"]',
                '.grid-item',
                'li[class*="product"]',
                '[class*="Product"]',
            ]
            const results: Record<string, number> = {}
            for (const sel of selectors) {
                try {
                    const count = document.querySelectorAll(sel).length
                    if (count > 0) results[sel] = count
                } catch { }
            }
            return results
        })
        for (const [sel, count] of Object.entries(productEls)) {
            console.log(`   ${sel}: ${count} elementos`)
        }

        // 5. Mostrar sample HTML de un posible contenedor de producto
        console.log(`\n📦 Primer contenedor con clase "product" (ignorando case):`)
        const sample = await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'))
            const candidates = all.filter(el => {
                const cls = (el.className || '').toLowerCase()
                return cls.includes('product') || cls.includes('item') || el.tagName === 'ARTICLE'
            })
            if (candidates.length === 0) return 'NO ENCONTRADO'
            const el = candidates[0]
            return {
                tag: el.tagName,
                id: el.id,
                class: el.className.slice(0, 200),
                html: el.innerHTML.slice(0, 1000),
            }
        })
        if (typeof sample === 'string') {
            console.log(`   ${sample}`)
        } else {
            console.log(`   <${sample.tag} id="${sample.id}" class="${sample.class}">`)
            console.log(`   HTML: ${sample.html}`)
        }

        // 6. Ver categorías de alimentación específicas
        console.log(`\n📂 Categorías de alimentación:`)
        const cats = slug === 'lidl'
            ? await diagnosticarCategoriasLidl(page)
            : slug === 'dia'
                ? await diagnosticarCategoriasDia(page)
                : await diagnosticarCategoriasCarrefour(page)
        console.log(`   ${cats.length} categorías encontradas`)
        cats.slice(0, 15).forEach(c => console.log(`   • ${c.name}: ${c.url}`))

        // 7. Si hay categorías, navegar a la primera de alimentación real
        const catAlimentacion = cats.find(c =>
            /alimentaci[oó]n|leche|carne|fruta|verdura|pan|huevo|l[aá]cteo/i.test(c.name)
        )
        if (catAlimentacion) {
            console.log(`\n🛒 Navegando a categoría de alimentación: "${catAlimentacion.name}"...`)
            await page.goto(catAlimentacion.url, {
                waitUntil: 'networkidle',
                timeout: 30000,
            }).catch(() => { })
            await page.waitForTimeout(3000)

            // Scroll
            await page.evaluate(`
                (async () => {
                    const delay = ms => new Promise(r => setTimeout(r, ms));
                    for (let i = 0; i < Math.min(document.body.scrollHeight, 5000); i += 500) {
                        window.scrollTo(0, i);
                        await delay(300);
                    }
                })()
            `)
            await page.waitForTimeout(1000)

            // Analizar productos en esta categoría
            const prodInfo = await page.evaluate(() => {
                const all = Array.from(document.querySelectorAll('*'))
                // Buscar elementos que podrían ser tarjetas de producto
                const candidates = all.filter(el => {
                    const html = el.innerHTML.toLowerCase()
                    const cls = (el.className || '').toLowerCase()
                    // Tiene precio € y nombre
                    return (html.includes('€') || html.includes('&euro;')) &&
                        (el.children.length > 2) &&
                        (cls.includes('product') || cls.includes('card') || cls.includes('item') || cls.includes('tile'))
                })
                return candidates.slice(0, 3).map(el => ({
                    tag: el.tagName,
                    class: el.className.slice(0, 150),
                    html: el.innerHTML.slice(0, 800),
                }))
            })
            console.log(`   Posibles tarjetas de producto:`)
            prodInfo.forEach((p, i) => {
                console.log(`   [${i + 1}] <${p.tag} class="${p.class}">`)
                console.log(`       ${p.html}`)
            })

            // Guardar HTML de categoría
            const catHtml = await page.content()
            const catPath = path.join(outDir, `${slug}-categoria.html`)
            fs.writeFileSync(catPath, catHtml)
            console.log(`   HTML categoría guardado: ${catPath}`)
        }

    } catch (err) {
        console.error(`   ❌ Error: ${err}`)
    } finally {
        await browser.close()
    }
}

async function diagnosticarCategoriasCarrefour(page: any) {
    return await page.evaluate(() => {
        const links: { url: string; name: string }[] = []
        const seen = new Set<string>()
        const anchors = document.querySelectorAll('a[href*="/supermercado"]')
        anchors.forEach(a => {
            const href = (a as HTMLAnchorElement).href?.trim()
            const text = a.textContent?.trim()
            if (href && text && !seen.has(href) && text.length > 2 && !href.includes('#')) {
                seen.add(href)
                links.push({ url: href, name: text })
            }
        })
        return links
    })
}

async function diagnosticarCategoriasLidl(page: any) {
    return await page.evaluate(() => {
        const links: { url: string; name: string }[] = []
        const seen = new Set<string>()
        const anchors = document.querySelectorAll('a[href*="/c/"]')
        anchors.forEach(a => {
            const href = (a as HTMLAnchorElement).href?.trim()
            const text = a.textContent?.trim()
            if (href && text && !seen.has(href) && text.length > 2 && !href.includes('#')) {
                seen.add(href)
                links.push({ url: href, name: text })
            }
        })
        return links
    })
}

async function diagnosticarCategoriasDia(page: any) {
    return await page.evaluate(() => {
        const links: { url: string; name: string }[] = []
        const seen = new Set<string>()
        const anchors = document.querySelectorAll('a[href*="/compra-online"]')
        anchors.forEach(a => {
            const href = (a as HTMLAnchorElement).href?.trim()
            const text = a.textContent?.trim()
            if (href && text && !seen.has(href) && text.length > 2 && !href.includes('#')) {
                seen.add(href)
                links.push({ url: href, name: text })
            }
        })
        return links
    })
}

// ─── Main ───

async function main() {
    const args = process.argv.slice(2)
    const target = args[0]?.toLowerCase()

    if (target && SUPERMERCARDOS[target]) {
        await diagnosticar(target, SUPERMERCARDOS[target])
    } else if (target) {
        console.error(`Supermercado no encontrado: ${target}. Opciones: ${Object.keys(SUPERMERCARDOS).join(', ')}`)
        process.exit(1)
    } else {
        for (const [slug, cfg] of Object.entries(SUPERMERCARDOS)) {
            await diagnosticar(slug, cfg)
        }
    }

    console.log(`\n✅ Diagnóstico completado. Revisa tmp/dom-diagnostics/`)
}

main().catch(console.error)

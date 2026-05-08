/**
 * capturar-imagenes-reales.mjs
 *
 * CAPTURA DIRECTA — Sin IA, sin refino, sin generación.
 * Solo Playwright para obtener la imagen real del post de Instagram/TikTok.
 *
 * USO:
 *   MAX_RECETAS=5 node scripts/capturar-imagenes-reales.mjs
 *
 * SALIDA:
 *   salidas/revision-imagenes/real--{nombre}.webp
 *   salidas/revision-imagenes/revision_real.html (panel)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

const MAX_RECETAS = parseInt(process.env.MAX_RECETAS || '5', 10)

function safeName(nombre) {
    return nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
}

async function descargarBuffer(url, timeout = 15000) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || ''
        if (!ct.startsWith('image/')) return null
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length < 1000) return null
        return buf
    } catch { return null }
}

// ── Capturar screenshot real con Playwright (SIN IA) ──
async function capturarScreenshotReal(url) {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        // User-Agent iPhone para versión móvil (más imágenes, menos bloqueo)
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page = await context.newPage()

        // Capturar la imagen más grande que cargue
        let mejorImagen = null
        let mayorTamano = 0

        page.on('response', async (response) => {
            const ct = response.headers()['content-type'] || ''
            if (ct.startsWith('image/')) {
                try {
                    const buf = await response.body()
                    if (buf.length > mayorTamano) {
                        mayorTamano = buf.length
                        mejorImagen = buf
                    }
                } catch { /* ignorar */ }
            }
        })

        console.log(`     🌐 Cargando página...`)
        await page.goto(url, { waitUntil: 'networkidle', timeout: 25000 })
        await page.waitForTimeout(3000)

        // Scroll para activar lazy loading
        await page.evaluate(() => window.scrollBy(0, 500))
        await page.waitForTimeout(1500)

        // Buscar imágenes grandes en el DOM
        const imgSrcs = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'))
            return imgs
                .filter(img => img.naturalWidth > 200 && img.naturalHeight > 200)
                .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))
                .slice(0, 5)
                .map(img => img.src)
        })

        for (const src of imgSrcs) {
            const buf = await descargarBuffer(src)
            if (buf && buf.length > mayorTamano) {
                mejorImagen = buf
                mayorTamano = buf.length
            }
        }

        await browser.close()

        if (mejorImagen && mayorTamano > 50000) {
            console.log(`     ✅ Imagen real: ${(mayorTamano / 1024).toFixed(0)}KB`)
            return mejorImagen
        }

        // Fallback: screenshot de pantalla
        console.log(`     📸 Sin imagen grande, haciendo screenshot...`)
        const browser2 = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const ctx2 = await browser2.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page2 = await ctx2.newPage()
        await page2.goto(url, { waitUntil: 'networkidle', timeout: 25000 })
        await page2.waitForTimeout(3000)

        const screenshot = await page2.screenshot({ type: 'jpeg', quality: 85 })
        await browser2.close()

        if (screenshot.length > 20000) {
            console.log(`     ✅ Screenshot: ${(screenshot.length / 1024).toFixed(0)}KB`)
            return screenshot
        }

        console.log(`     ❌ No se pudo capturar nada`)
        return null
    } catch (err) {
        console.log(`     ❌ Error: ${err.message}`)
        return null
    }
}

// ── Generar panel HTML (sin IA, solo la imagen real) ──
function generarPanelHTML(resultados) {
    const cards = resultados.map((r, idx) => {
        if (!r.imagen) {
            return `
            <div class="receta-card error">
                <h2>${r.nombre}</h2>
                <p class="meta">🔗 <a href="${r.url_origen}" target="_blank">ver original</a></p>
                <div class="no-imagen">❌ No se pudo capturar</div>
            </div>`
        }

        const b64 = r.imagen.toString('base64')
        return `
        <div class="receta-card">
            <h2>${r.nombre}</h2>
            <p class="meta">
                🔗 <a href="${r.url_origen}" target="_blank">ver original</a>
                · 📸 ${(r.imagen.length / 1024).toFixed(0)}KB
            </p>
            <div class="imagen-wrap">
                <img src="data:image/webp;base64,${b64}" alt="${r.nombre}" loading="lazy">
            </div>
        </div>`
    }).join('')

    const capturadas = resultados.filter(r => r.imagen).length

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Capturas Reales — Playwright sin IA</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 20px;
    max-width: 900px;
    margin: 0 auto;
}
h1 { font-size: 26px; margin-bottom: 4px; }
.subtitle { color: #86868b; margin-bottom: 24px; }
.stats {
    display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;
}
.stat {
    background: white;
    border-radius: 12px;
    padding: 12px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    font-size: 14px;
}
.stat strong { font-size: 22px; display: block; color: #1d1d1f; }
.receta-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.receta-card h2 { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.receta-card.error { opacity: 0.6; }
.meta { font-size: 13px; color: #86868b; margin-bottom: 12px; }
.meta a { color: #007AFF; text-decoration: none; }
.imagen-wrap {
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    border-radius: 12px;
    overflow: hidden;
}
.imagen-wrap img {
    width: 100%;
    height: auto;
    display: block;
}
.no-imagen {
    padding: 40px;
    text-align: center;
    background: #f2f2f2;
    border-radius: 12px;
    color: #86868b;
}
</style>
</head>
<body>
    <h1>📸 Capturas Reales — Sin IA</h1>
    <p class="subtitle">Playwright · Solo la imagen del post original · Sin refino</p>
    <div class="stats">
        <div class="stat"><strong>${resultados.length}</strong> recetas</div>
        <div class="stat"><strong>${capturadas}</strong> capturadas 📸</div>
        <div class="stat"><strong>${resultados.length - capturadas}</strong> fallos ❌</div>
        <div class="stat"><strong>$0</strong> coste</div>
    </div>
    ${cards}
</body>
</html>`

    const htmlPath = join(SALIDA_DIR, 'revision_real.html')
    writeFileSync(htmlPath, html)
    console.log(`\n  ✅ Panel: salidas/revision-imagenes/revision_real.html`)
    console.log(`     file://${htmlPath}`)
}

// ── MAIN ──
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 CAPTURAS REALES — Playwright sin IA                ║
║  Screenshot directo del post original                   ║
║  Sin generación · Sin refino · Coste $0                 ║
╚══════════════════════════════════════════════════════════╝
`)

    // Obtener recetas sin imagen, con URL válida de Instagram/TikTok
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen')
        .is('imagen_url', null)
        .not('url_origen', 'is', null)
        .limit(MAX_RECETAS)

    if (!recetas || recetas.length === 0) {
        console.log('  No hay recetas sin imagen con url_origen')
        return
    }

    // Filtrar solo URLs que realmente tengan contenido (no strings vacíos o inválidos)
    const validas = recetas.filter(r => {
        const u = (r.url_origen || '').trim()
        return u.length > 10 && (u.includes('instagram.com') || u.includes('tiktok.com'))
    })

    console.log(`  📊 Total recetas con URL: ${recetas.length}`)
    console.log(`  📊 URLs válidas (Instagram/TikTok): ${validas.length}`)
    console.log(`  💰 Coste: $0 (sin IA)\n`)

    const resultados = []

    for (let i = 0; i < validas.length; i++) {
        const r = validas[i]
        console.log(`[${i + 1}/${validas.length}] ${r.nombre}`)
        console.log(`     🔗 ${r.url_origen.substring(0, 70)}`)

        const imagen = await capturarScreenshotReal(r.url_origen)

        if (imagen) {
            const name = `real--${safeName(r.nombre)}.webp`
            writeFileSync(join(SALIDA_DIR, name), imagen)
            console.log(`     💾 Guardada: ${name}`)
        } else {
            console.log(`     ❌ Fallo al capturar`)
        }

        resultados.push({ nombre: r.nombre, url_origen: r.url_origen, imagen })
        console.log('')
    }

    generarPanelHTML(resultados)

    const capturadas = resultados.filter(r => r.imagen).length
    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  📊 RESUMEN`)
    console.log(`═══════════════════════════════════════════`)
    console.log(`  ✅ Capturadas: ${capturadas}/${resultados.length}`)
    console.log(`  ❌ Fallos:      ${resultados.length - capturadas}`)
    console.log(`  💰 Coste:       $0`)
    console.log(`  📄 Panel:       salidas/revision-imagenes/revision_real.html`)
    console.log(``)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

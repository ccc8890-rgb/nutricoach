/**
 * probar-playwright-img2img.mjs
 *
 * FASE 1 — Capturar imágenes reales de Instagram/TikTok con Playwright
 * y refinarlas sutilmente con Flux Pro img2img (strength ~0.25)
 *
 * El objetivo es obtener imágenes que:
 * 1. SEAN REALES (captura del post original)
 * 2. Con un refino IA muy sutil que mejore luz/color/detalle
 * 3. Sin perder la autenticidad de "comida hecha por una persona"
 *
 * USO:
 *   MAX_RECETAS=5 node scripts/probar-playwright-img2img.mjs
 *
 * SALIDA:
 *   salidas/revision-imagenes/playwright--{nombre}.webp  (captura real)
 *   salidas/revision-imagenes/playwright_refinada--{nombre}.webp  (refino sutil)
 *   salidas/revision-imagenes/revision_fase1.html  (panel comparativo)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
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

// ── Config ─────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_KEY = process.env.REPLICATE_API_KEY
const REPLICATE_API = 'https://api.replicate.com/v1'
const FLUX_PRO = 'black-forest-labs/flux-pro'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

const MAX_RECETAS = parseInt(process.env.MAX_RECETAS || '5', 10)
const COSTE_POR_IMAGEN = 0.05
const STRENGTH_REFINO = 0.25  // Muy sutil — apenas mejora luz/color

// ── Utilidades ─────────────────────────────────────────
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
    } catch {
        return null
    }
}

function guardarBuffer(buffer, nombre, metodo) {
    const name = `${metodo}--${safeName(nombre)}.webp`
    const path = join(SALIDA_DIR, name)
    writeFileSync(path, buffer)
    return { name, path }
}

function bufferToBase64(buf) {
    return `data:image/webp;base64,${buf.toString('base64')}`
}

// ═══════════════════════════════════════════════════════
//  CAPTURAR CON PLAYWRIGHT — Screenshot real del post
// ═══════════════════════════════════════════════════════

async function capturarScreenshot(url) {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })

        // Usar iPhone para que Instagram sirva versión móvil (más estable)
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page = await context.newPage()

        // Interceptar la imagen más grande que cargue
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

        console.log(`     🌐 Navegando a ${url.substring(0, 60)}...`)
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
        await page.waitForTimeout(3000)

        // Scroll down suave para activar lazy loading
        await page.evaluate(() => window.scrollBy(0, 300))
        await page.waitForTimeout(1000)

        // Buscar la imagen del post (la más grande visible)
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

        // Si encontramos una imagen grande (>50KB), es la del post
        if (mejorImagen && mayorTamano > 50000) {
            console.log(`     📸 Imagen capturada: ${(mayorTamano / 1024).toFixed(0)}KB`)
            return mejorImagen
        }

        // Fallback: screenshot de toda la página
        console.log(`     📸 Sin imagen grande, haciendo screenshot...`)
        const browser2 = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context2 = await browser2.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page2 = await context2.newPage()
        await page2.goto(url, { waitUntil: 'networkidle', timeout: 20000 })
        await page2.waitForTimeout(3000)

        // Intentar hacer scroll al video/reel
        await page2.evaluate(() => {
            const video = document.querySelector('video')
            if (video) video.scrollIntoView({ behavior: 'instant', block: 'center' })
        })
        await page2.waitForTimeout(1000)

        const screenshot = await page2.screenshot({
            type: 'jpeg',
            quality: 85,
            fullPage: false,
        })
        await browser2.close()

        if (screenshot.length > 20000) {
            console.log(`     📸 Screenshot: ${(screenshot.length / 1024).toFixed(0)}KB`)
            return screenshot
        }

        console.log(`     ❌ No se pudo capturar nada`)
        return null
    } catch (err) {
        console.log(`     ❌ Error Playwright: ${err.message}`)
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  FLUX PRO img2img — Refino sutil
// ═══════════════════════════════════════════════════════

async function refinarConFlux(prompt, imagenBase64, strength = 0.25) {
    if (!API_KEY) return null

    try {
        const input = {
            prompt,
            image: imagenBase64,
            strength,
            aspect_ratio: '1:1',
            output_format: 'webp',
            safety_tolerance: 2,
            num_outputs: 1,
        }

        const createRes = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ version: FLUX_PRO, input }),
        })

        if (!createRes.ok) {
            const errText = await createRes.text()
            if (createRes.status === 402) {
                console.warn('     ⚠️ Crédito insuficiente en Replicate')
                return null
            }
            if (createRes.status === 429) {
                console.log('     ⏳ Rate limit, esperando 10s...')
                await new Promise(r => setTimeout(r, 10000))
                return refinarConFlux(prompt, imagenBase64, strength)
            }
            console.warn(`     ⚠️ Replicate error ${createRes.status}: ${errText.substring(0, 100)}`)
            return null
        }

        const prediction = await createRes.json()
        const timeout = 60000
        const start = Date.now()
        let url = prediction.urls.get

        while (Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 2000))
            const poll = await fetch(url, {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
            })
            if (!poll.ok) break
            const status = await poll.json()

            if (status.status === 'succeeded') {
                const output = status.output
                if (Array.isArray(output) && output.length > 0) return output[0]
                if (typeof output === 'string') return output
                return null
            }
            if (status.status === 'failed') return null
            url = status.urls.get
        }
        return null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  PROMPT DE REFINO — Sutil, respeta la imagen original
// ═══════════════════════════════════════════════════════

function construirPromptRefino(nombre) {
    return [
        `Professional food photo of "${nombre}".`,
        `Natural lighting, warm tones, slightly enhanced colors and contrast.`,
        `Keep the exact same composition, same dish, same plating.`,
        `Subtle improvement: richer colors, better lighting balance, sharper details.`,
        `Realistic food photography, homemade style, NOT studio photography.`,
        `The food must look authentic and real, as if cooked by a person at home.`,
        `No text, no watermarks, no artificial elements.`,
    ].join(' ')
}

// ═══════════════════════════════════════════════════════
//  GENERAR PANEL HTML DE COMPARACIÓN
// ═══════════════════════════════════════════════════════

function generarPanelHTML(resultados) {
    const cards = resultados.map((r, idx) => {
        const imgOriginal = r.captura
            ? `<div class="imagen-card">
                   <img src="${bufferToBase64(r.captura)}" alt="${r.nombre} - original" loading="lazy">
                   <div class="metodo-label original">📸 Original</div>
                   <div class="tamano">${(r.captura.length / 1024).toFixed(0)}KB</div>
               </div>`
            : `<div class="imagen-card error">
                   <div class="no-imagen">❌ No se pudo capturar</div>
               </div>`

        const imgRefinada = r.refinada
            ? `<div class="imagen-card">
                   <img src="${bufferToBase64(r.refinada)}" alt="${r.nombre} - refinada" loading="lazy">
                   <div class="metodo-label refinada">✨ Refinada (strength ${STRENGTH_REFINO})</div>
                   <div class="tamano">${(r.refinada.length / 1024).toFixed(0)}KB</div>
               </div>`
            : r.captura
                ? `<div class="imagen-card">
                       <div class="no-imagen">⏭️ Sin refino (ahorrar crédito)</div>
                   </div>`
                : ''

        return `
        <div class="receta-card" id="receta-${idx}">
            <h2>${r.nombre}</h2>
            <p class="meta">
                ${r.url_origen ? `🔗 <a href="${r.url_origen}" target="_blank">ver original</a>` : ''}
                ${r.coste ? ` 💰 $${r.coste.toFixed(2)}` : ''}
            </p>
            <div class="comparacion">
                ${imgOriginal}
                ${r.captura && r.refinada ? '<div class="vs">→</div>' : ''}
                ${imgRefinada}
            </div>
        </div>
        `
    }).join('')

    // Stats
    const capturadas = resultados.filter(r => r.captura).length
    const refinadas = resultados.filter(r => r.refinada).length
    const costeTotal = resultados.reduce((s, r) => s + (r.coste || 0), 0)

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Fase 1 — Playwright + img2img</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 20px;
    max-width: 1200px;
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
.meta { font-size: 13px; color: #86868b; margin-bottom: 16px; }
.meta a { color: #007AFF; text-decoration: none; }
.comparacion {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
}
.imagen-card {
    flex: 1;
    min-width: 250px;
    max-width: 400px;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
}
.imagen-card img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 12px;
}
.metodo-label {
    position: absolute;
    top: 8px;
    left: 8px;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    color: white;
}
.metodo-label.original { background: rgba(0,0,0,0.6); }
.metodo-label.refinada { background: rgba(255, 149, 0, 0.85); }
.tamano {
    position: absolute;
    bottom: 8px;
    right: 8px;
    padding: 2px 8px;
    border-radius: 12px;
    background: rgba(0,0,0,0.5);
    color: white;
    font-size: 11px;
}
.vs {
    font-size: 24px;
    color: #86868b;
    font-weight: 600;
}
.no-imagen {
    padding: 40px;
    text-align: center;
    background: #f2f2f2;
    border-radius: 12px;
    color: #86868b;
    font-size: 14px;
}
.error { opacity: 0.7; }
</style>
</head>
<body>
    <h1>📸 Fase 1 — Captura real + Refino sutil</h1>
    <p class="subtitle">Playwright → Flux Pro img2img (strength ${STRENGTH_REFINO})</p>
    <div class="stats">
        <div class="stat"><strong>${resultados.length}</strong> recetas</div>
        <div class="stat"><strong>${capturadas}</strong> capturadas 📸</div>
        <div class="stat"><strong>${refinadas}</strong> refinadas ✨</div>
        <div class="stat"><strong>$${costeTotal.toFixed(2)}</strong> coste total</div>
    </div>
    ${cards}
</body>
</html>`

    const htmlPath = join(SALIDA_DIR, 'revision_fase1.html')
    writeFileSync(htmlPath, html)
    console.log(`\n  ✅ Panel Fase 1: salidas/revision-imagenes/revision_fase1.html`)
    console.log(`     file://${htmlPath}`)
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 FASE 1 — Playwright + Flux Pro img2img             ║
║  Captura real del post + refino sutil (strength 0.25)   ║
╚══════════════════════════════════════════════════════════╝
`)

    // Obtener recetas SIN imagen pero CON url_origen de Instagram/TikTok
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

    console.log(`  📊 Recetas a procesar: ${recetas.length}`)
    console.log(`  💰 Coste refino: ~$${(recetas.length * COSTE_POR_IMAGEN).toFixed(2)} (si se refinan todas)`)
    console.log(`  🎚️  Strength refino: ${STRENGTH_REFINO} (muy sutil)\n`)

    const resultados = []
    let costeTotal = 0

    for (let i = 0; i < recetas.length; i++) {
        const r = recetas[i]
        console.log(`[${i + 1}/${recetas.length}] ${r.nombre}`)

        // Paso 1: Capturar con Playwright
        console.log(`     📸 Capturando screenshot real...`)
        const captura = await capturarScreenshot(r.url_origen)

        if (!captura) {
            console.log(`     ❌ No se pudo capturar imagen para esta receta`)
            resultados.push({
                nombre: r.nombre,
                url_origen: r.url_origen,
                captura: null,
                refinada: null,
                coste: 0,
            })
            continue
        }

        // Guardar captura original
        const { name: capName } = guardarBuffer(captura, r.nombre, 'playwright')
        console.log(`     ✅ Captura guardada: ${capName} (${(captura.length / 1024).toFixed(0)}KB)`)

        // Paso 2: Subir la captura a un lugar accesible para Flux Pro
        // Flux Pro img2img necesita una URL pública, no base64.
        // Tenemos dos opciones:
        //   A) Subir a Supabase Storage temporalmente y pasar URL
        //   B) Convertir a base64 data URI
        // Flux Pro acepta base64 data URIs según la documentación.
        // Probemos con base64.

        console.log(`     ✨ Refinando con Flux Pro (strength ${STRENGTH_REFINO})...`)

        const prompt = construirPromptRefino(r.nombre)
        const capturaBase64 = `data:image/webp;base64,${captura.toString('base64')}`

        const refinadaUrl = await refinarConFlux(prompt, capturaBase64, STRENGTH_REFINO)

        if (refinadaUrl) {
            const bufRefinada = await descargarBuffer(refinadaUrl)
            if (bufRefinada) {
                const { name: refName } = guardarBuffer(bufRefinada, r.nombre, 'playwright_refinada')
                console.log(`     ✅ Refinada guardada: ${refName} (${(bufRefinada.length / 1024).toFixed(0)}KB)`)

                resultados.push({
                    nombre: r.nombre,
                    url_origen: r.url_origen,
                    captura,
                    refinada: bufRefinada,
                    coste: COSTE_POR_IMAGEN,
                })
                costeTotal += COSTE_POR_IMAGEN
            } else {
                console.log(`     ⚠️ No se pudo descargar la imagen refinada`)
                resultados.push({
                    nombre: r.nombre,
                    url_origen: r.url_origen,
                    captura,
                    refinada: null,
                    coste: 0,
                })
            }
        } else {
            console.log(`     ⏭️ Refino no disponible (sin crédito o error) — solo captura`)
            resultados.push({
                nombre: r.nombre,
                url_origen: r.url_origen,
                captura,
                refinada: null,
                coste: 0,
            })
        }

        // Pausa entre recetas
        if (i < recetas.length - 1) {
            await new Promise(r => setTimeout(r, 3000))
        }
        console.log('')
    }

    // Generar panel
    generarPanelHTML(resultados)

    // Resumen
    const capturadas = resultados.filter(r => r.captura).length
    const refinadas = resultados.filter(r => r.refinada).length

    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  📊 RESUMEN FASE 1`)
    console.log(`═══════════════════════════════════════════`)
    console.log(`  📸 Capturadas (reales):   ${capturadas}/${resultados.length}`)
    console.log(`  ✨ Refinadas (img2img):   ${refinadas}/${resultados.length}`)
    console.log(`  💰 Coste refinos:         $${costeTotal.toFixed(2)}`)
    console.log(`  📄 Panel:                 salidas/revision-imagenes/revision_fase1.html`)
    console.log(`\n  ➡️  Abre el panel para comparar:`)
    console.log(`     file://${join(SALIDA_DIR, 'revision_fase1.html')}`)
    console.log(``)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

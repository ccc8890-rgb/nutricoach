/**
 * capturar-y-refinar-18.mjs
 *
 * Pipeline completo para las 18 recetas con url_origen:
 * 1. Captura la imagen real con Playwright → og_image--*.webp
 * 2. Refina con GPT-4o image edit (Claude pipeline) → flux_img2img--*.webp
 * 3. Genera panel visual para revisión
 * 4. Muestra instrucciones para subir
 *
 * USO: node scripts/capturar-y-refinar-18.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        process.env[k] = v
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const OPENAI_KEY = process.env.OPENAI_API_KEY
const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

// ── Helpers ──
function safeName(nombre) {
    return nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60)
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

// ── FASE 1: Capturar con Playwright ──
async function capturarScreenshotReal(url) {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page = await context.newPage()

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
        await page.evaluate(() => window.scrollBy(0, 500))
        await page.waitForTimeout(1500)

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
            console.log(`     ✅ Capturada: ${(mayorTamano / 1024).toFixed(0)}KB`)
            return mejorImagen
        }

        // Fallback: screenshot
        console.log(`     📸 Sin imagen grande, screenshot...`)
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

        console.log(`     ❌ No se pudo capturar`)
        return null
    } catch (err) {
        console.log(`     ❌ Error: ${err.message}`)
        return null
    }
}

// ── FASE 2: Refinar con GPT-4o image edit (Claude pipeline) ──
function buildPrompt(nombreReceta) {
    return `Esta es una foto de la receta "${nombreReceta}".

Por favor, edita la imagen de esta manera:
1. Elimina cualquier texto superpuesto, título, subtítulo, watermark, logo, hashtag o información nutricional que aparezca encima de la comida.
2. Si hay personas, manos o dedos visibles, elimínalos. Deja solo el plato y la comida.
3. Mantén exactamente la misma composición y los mismos alimentos del plato original.
4. Ajusta la iluminación para que parezca luz natural de tarde entrando por una ventana de cocina mediterránea, cálida y suave.
5. El fondo debe ser una mesa de madera o encimera de cocina casera y sencilla, mismo estilo en todas las fotos.
6. Estilo: foto personal de blog de cocina, Sony mirrorless, composición ligeramente imperfecta, auténtica.

El resultado debe ser la misma comida que en la imagen original, pero en un entorno de cocina casera consistente y sin ningún texto ni personas.`
}

async function gptImageEdit(imageBuffer, prompt, filename) {
    const form = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/webp' })
    form.append('image', blob, filename.replace('.webp', '.png'))
    form.append('model', 'gpt-image-1.5')
    form.append('prompt', prompt)
    form.append('n', '1')
    form.append('size', '1024x1024')
    form.append('quality', 'medium')
    form.append('input_fidelity', 'high')

    const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: form,
        signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
        const err = await res.text()
        if (res.status === 429) {
            console.log('     ⏳ Rate limit, esperando 20s...')
            await new Promise(r => setTimeout(r, 20000))
            return gptImageEdit(imageBuffer, prompt, filename)
        }
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')

    const url = data.data?.[0]?.url
    if (url) {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) })
        return Buffer.from(await imgRes.arrayBuffer())
    }

    throw new Error('Respuesta vacía de OpenAI imagen')
}

// ── Panel HTML ──
function generarPanel(resultados) {
    const cards = resultados.map((r, idx) => {
        const tieneCapture = r.capturaBuffer
        const tieneRefine = r.refineBuffer
        const capturaB64 = tieneCapture ? r.capturaBuffer.toString('base64') : null
        const refineB64 = tieneRefine ? r.refineBuffer.toString('base64') : null

        return `
        <div class="card">
            <h2>${r.nombre}</h2>
            <p class="meta">🔗 <a href="${r.url}" target="_blank">ver original</a></p>
            <div class="grid-2">
                <div class="img-box ${tieneCapture ? '' : 'vacia'}">
                    <div class="label">📸 Captura (og_image)</div>
                    ${tieneCapture ? `<img src="data:image/webp;base64,${capturaB64}" loading="lazy">` : '<div class="no-img">❌ No capturada</div>'}
                </div>
                <div class="img-box ${tieneRefine ? '' : 'vacia'}">
                    <div class="label">🎨 Refinada (flux_img2img)</div>
                    ${tieneRefine ? `<img src="data:image/webp;base64,${refineB64}" loading="lazy">` : '<div class="no-img">⏳ Pendiente</div>'}
                </div>
            </div>
        </div>`
    }).join('')

    const capturadas = resultados.filter(r => r.capturaBuffer).length
    const refinadas = resultados.filter(r => r.refineBuffer).length

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pipeline 18 recetas — Captura + Refinado</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#f5f5f7; color:#1d1d1f; padding:20px; max-width:1100px; margin:0 auto; }
h1 { font-size:28px; margin-bottom:4px; }
.subtitle { color:#86868b; margin-bottom:24px; }
.stats { display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
.stat { background:white; border-radius:12px; padding:12px 20px; box-shadow:0 1px 3px rgba(0,0,0,0.08); font-size:14px; }
.stat strong { font-size:22px; display:block; }
.card { background:white; border-radius:16px; padding:20px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
.card h2 { font-size:17px; font-weight:600; margin-bottom:4px; }
.meta { font-size:13px; color:#86868b; margin-bottom:12px; }
.meta a { color:#007AFF; text-decoration:none; }
.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.img-box { border-radius:12px; overflow:hidden; background:#f2f2f2; }
.img-box.vacia { opacity:0.6; }
.label { font-size:12px; font-weight:600; padding:8px 12px; background:rgba(0,0,0,0.03); }
.img-box img { width:100%; height:auto; display:block; }
.no-img { padding:40px; text-align:center; color:#86868b; font-size:14px; }
@media (max-width:600px) { .grid-2 { grid-template-columns:1fr; } }
</style>
</head>
<body>
    <h1>📸🎨 Pipeline 18 recetas</h1>
    <p class="subtitle">Captura Playwright → Refinado GPT-4o (Claude)</p>
    <div class="stats">
        <div class="stat"><strong>${resultados.length}</strong> recetas</div>
        <div class="stat"><strong>${capturadas}</strong> capturadas 📸</div>
        <div class="stat"><strong>${refinadas}</strong> refinadas 🎨</div>
        <div class="stat"><strong>${resultados.length - capturadas}</strong> fallos ❌</div>
    </div>
    ${cards}
</body>
</html>`

    const htmlPath = join(SALIDA_DIR, 'pipeline-18.html')
    writeFileSync(htmlPath, html)
    console.log(`\n  ✅ Panel: salidas/revision-imagenes/pipeline-18.html`)
    console.log(`     file://${htmlPath}`)
}

// ── MAIN ──
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 Pipeline 18 recetas                                 ║
║  FASE 1: Capturar con Playwright → og_image--*.webp     ║
║  FASE 2: Refinar con GPT-4o → flux_img2img--*.webp      ║
╚══════════════════════════════════════════════════════════╝
`)

    if (!OPENAI_KEY) {
        console.error('❌ OPENAI_API_KEY no configurada en .env.local')
        process.exit(1)
    }

    // Obtener recetas sin imagen con URL real
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen')
        .is('imagen_url', null)
        .not('url_origen', 'is', null)
        .order('nombre')

    if (error) { console.error('Error BD:', error); process.exit(1) }

    // Filtrar URLs reales (excluir test.com, cadenas vacías)
    const validas = recetas.filter(r => {
        const u = (r.url_origen || '').trim()
        try {
            const host = new URL(u).hostname
            return u.length > 10 && !host.includes('test.com') && !host.includes('localhost')
        } catch { return false }
    })

    console.log(`  📊 Total con URL:    ${recetas.length}`)
    console.log(`  📊 URLs válidas:     ${validas.length}`)
    console.log(`  💰 Coste captura:    $0 (Playwright)`)
    console.log(`  💰 Coste refinado:   ~$${(validas.length * 0.034).toFixed(2)} (GPT-4o)\n`)

    const resultados = []

    for (let i = 0; i < validas.length; i++) {
        const r = validas[i]
        const slug = safeName(r.nombre)
        const ogFilename = `og_image--${slug}.webp`
        const fluxFilename = `flux_img2img--${slug}.webp`
        const ogPath = join(SALIDA_DIR, ogFilename)
        const fluxPath = join(SALIDA_DIR, fluxFilename)

        console.log(`\n[${i + 1}/${validas.length}] ${r.nombre}`)
        console.log(`     🔗 ${r.url_origen.substring(0, 80)}`)

        const resultado = { nombre: r.nombre, url: r.url_origen, capturaBuffer: null, refineBuffer: null }

        // ── FASE 1: Capturar si no existe og_image ──
        if (existsSync(ogPath)) {
            console.log(`     ⏭️  og_image ya existe, re-leyendo...`)
            resultado.capturaBuffer = readFileSync(ogPath)
        } else {
            const captura = await capturarScreenshotReal(r.url_origen)
            if (captura) {
                writeFileSync(ogPath, captura)
                console.log(`     💾 Guardada: ${ogFilename}`)
                resultado.capturaBuffer = captura
            } else {
                console.log(`     ❌ No se pudo capturar`)
                resultados.push(resultado)
                continue
            }
        }

        // ── FASE 2: Refinar si no existe flux_img2img ──
        if (existsSync(fluxPath)) {
            console.log(`     ⏭️  flux_img2img ya existe, saltando`)
            resultado.refineBuffer = readFileSync(fluxPath)
        } else {
            console.log(`     🎨 GPT-4o refinando...`)
            try {
                const inputBuffer = readFileSync(ogPath)
                const prompt = buildPrompt(r.nombre)
                const refined = await gptImageEdit(inputBuffer, prompt, ogFilename)
                writeFileSync(fluxPath, refined)
                console.log(`     ✅ ${fluxFilename} (${(refined.length / 1024).toFixed(0)}KB)`)
                resultado.refineBuffer = refined
            } catch (err) {
                console.error(`     ❌ Error refinado: ${err.message}`)
            }
        }

        resultados.push(resultado)

        if (i < validas.length - 1) {
            await new Promise(r => setTimeout(r, 2000))
        }
    }

    generarPanel(resultados)

    const capturadas = resultados.filter(r => r.capturaBuffer).length
    const refinadas = resultados.filter(r => r.refineBuffer).length

    console.log(`\n${'═'.repeat(55)}`)
    console.log(`  📊 RESUMEN FINAL`)
    console.log(`${'═'.repeat(55)}`)
    console.log(`  📸 Capturadas:  ${capturadas}/${resultados.length}`)
    console.log(`  🎨 Refinadas:   ${refinadas}/${resultados.length}`)
    console.log(`  ❌ Fallos captura: ${resultados.length - capturadas}`)
    console.log(`  💰 Coste GPT-4o: ~$${(refinadas * 0.034).toFixed(2)}`)
    console.log(`\n  ➡️  Para subir: node scripts/subir-imagenes-aprobadas.mjs\n`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

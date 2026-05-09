/**
 * rehacer-imagenes.mjs
 *
 * Pipeline completo: reset + captura real (agent-browser) + Flux img2img casero + upload directo a Supabase.
 * No necesita dev server ni panel HTML — sube directamente y actualiza la BD.
 *
 * USO:
 *   node scripts/rehacer-imagenes.mjs                  → recetas SIN imagen
 *   node scripts/rehacer-imagenes.mjs --reset           → borra todas y rehace
 *   node scripts/rehacer-imagenes.mjs --limite 10       → limitar a N recetas
 *   node scripts/rehacer-imagenes.mjs --solo-sin-url    → solo recetas sin url_origen (Flux directo)
 *   node scripts/rehacer-imagenes.mjs --dry             → muestra plan sin ejecutar nada
 *
 * FLUJO POR RECETA:
 *   1. agent-browser → captura imagen REAL de la página fuente (si hay url_origen)
 *   2a. Si hay imagen real → Flux img2img strength=0.2 (estilo casero, 20% de cambio)
 *   2b. Si no hay imagen   → Flux txt2img con prompt casero variado
 *   3. Upload a Supabase Storage bucket 'recetas' → path 'casero/{nombre}-{ts}.webp'
 *   4. UPDATE recetas SET imagen_url WHERE id
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) { console.error('❌ .env.local no encontrado'); process.exit(1) }
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY
const REPLICATE_API_KEY = process.env.REPLICATE_API_KEY
const BUCKET            = 'recetas'
const STORAGE_PREFIX    = 'casero'
const REPLICATE_API     = 'https://api.replicate.com/v1'
const FLUX_PRO          = 'black-forest-labs/flux-pro'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Args ───────────────────────────────────────────────
const args = process.argv.slice(2)
const RESET_MODE   = args.includes('--reset')
const DRY_MODE     = args.includes('--dry')
const SOLO_SIN_URL = args.includes('--solo-sin-url')
const LIMITE_IDX   = args.indexOf('--limite')
const MAX          = LIMITE_IDX !== -1 ? parseInt(args[LIMITE_IDX + 1], 10) : 9999
const PAUSA_MS     = 8000   // entre recetas (respeta rate limit Replicate ~6 req/min)

// ── Estilos caseros variados ───────────────────────────
const ESTILOS = {
    Postre:    ['soft afternoon light, white kitchen counter, homemade dessert on simple plate',
                'window light, marble surface, casual home baking moment, imperfect edges',
                'warm afternoon, wooden table, homemade sweet, honest home photography'],
    Desayuno:  ['morning light through kitchen window, wooden table, casual breakfast',
                'bright morning Mediterranean kitchen, white countertop, simple breakfast setup',
                'early morning soft light, rustic wood surface, honest home breakfast'],
    Comida:    ['afternoon natural light, home dining table, casual Spanish kitchen feel',
                'warm midday light, simple ceramic plate, home cooked meal, honest food',
                'Mediterranean kitchen, terracotta tiles, natural window light, real home meal'],
    Cena:      ['warm evening kitchen light, casual dinner plate, cozy home atmosphere',
                'low natural light, dark wood table, intimate Spanish kitchen ambiance',
                'evening warm tones, simple plating, authentic home dinner scene'],
    Snack:     ['quick grab shot, kitchen counter, casual home snack moment',
                'natural light, simple plate, casual afternoon at home, honest shot'],
    Merienda:  ['afternoon light, home kitchen table, casual snack time setup',
                'soft afternoon, simple ceramic, Mediterranean home kitchen, personal blog'],
}

function getEstilo(categoria) {
    const opts = ESTILOS[categoria] ?? ESTILOS['Comida']
    return opts[Math.floor(Math.random() * opts.length)]
}

function buildPromptImg2Img(nombre, categoria) {
    return [
        `casual home food photo of "${nombre}",`,
        `${getEstilo(categoria)},`,
        `shot on Sony mirrorless camera, personal food blog aesthetic,`,
        `authentic home-cooked presentation, honest natural food photography,`,
        `slightly imperfect composition, no studio lighting, no flash,`,
        `warm Mediterranean color grade, real kitchen feel, not overly styled.`,
        `Photorealistic, no AI artifacts, no watermarks.`,
    ].join(' ')
}

function buildPromptTxt2Img(nombre, categoria, ingredientes) {
    const ings = (ingredientes || []).slice(0, 5).join(', ') || 'ingredientes frescos'
    return [
        `casual home food photo of "${nombre}",`,
        `${getEstilo(categoria)},`,
        `key ingredients visible: ${ings}.`,
        `Shot on Sony mirrorless, personal food blog, authentic home cooking,`,
        `slightly imperfect, natural light, no studio, warm Mediterranean tones.`,
        `Photorealistic, no watermarks.`,
    ].join(' ')
}

// ── Utilidades ─────────────────────────────────────────
function safeName(nombre) {
    return nombre.toLowerCase().replace(/[^a-z0-9áéíóúüñ\s-]/g, '').replace(/\s+/g, '-').slice(0, 55)
}

async function descargar(url, timeoutMs = 15000) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
            signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || ''
        if (!ct.startsWith('image/')) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.length > 1000 ? buf : null
    } catch { return null }
}

// ── MÉTODO 0: imagen real de la página fuente ─────────
// Estrategia A: fetch directo + og:image / ld+json (rápido, sin browser)
// Estrategia B: agent-browser open+html+close (si A falla)
async function capturarImagenReal(urlOrigen) {
    if (!urlOrigen) return null

    // — Estrategia A: fetch directo ——————————————————
    try {
        const res = await fetch(urlOrigen, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NutriCoachBot/1.0)' },
            signal: AbortSignal.timeout(12000),
        })
        if (res.ok) {
            const html = await res.text()
            const imgUrl = extraerImagenDeHTML(html)
            if (imgUrl) {
                const buf = await descargar(imgUrl)
                if (buf && buf.length > 15000) {
                    console.log(`      ✅ Imagen real via fetch+og:image (${(buf.length/1024).toFixed(0)} KB)`)
                    return buf
                }
            }
        }
    } catch { /* continuar con estrategia B */ }

    // — Estrategia B: agent-browser open → html → close —
    try {
        const abEnv = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` }
        execSync(`agent-browser open ${JSON.stringify(urlOrigen)}`, { timeout: 20000, encoding: 'utf8', env: abEnv })
        const html = execSync(`agent-browser html`, { timeout: 10000, encoding: 'utf8', env: abEnv })
        try { execSync(`agent-browser close`, { timeout: 5000, env: abEnv }) } catch { /* ignorar */ }

        const imgUrl = extraerImagenDeHTML(html)
        if (imgUrl) {
            const buf = await descargar(imgUrl)
            if (buf && buf.length > 15000) {
                console.log(`      ✅ Imagen real via agent-browser (${(buf.length/1024).toFixed(0)} KB)`)
                return buf
            }
        }
    } catch { /* agent-browser no disponible o URL inaccesible */ }

    return null
}

// Extrae la URL de imagen más relevante de un bloque HTML
function extraerImagenDeHTML(html) {
    // 1. og:image (mejor calidad)
    const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    if (og?.[1]?.startsWith('http')) return og[1]

    // 2. JSON-LD image
    const ldMatch = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i)
    if (ldMatch) {
        try {
            const ld = JSON.parse(ldMatch[1])
            const img = ld.image
            if (typeof img === 'string' && img.startsWith('http')) return img
            if (Array.isArray(img) && img[0]?.startsWith?.('http')) return img[0]
            if (img?.url?.startsWith?.('http')) return img.url
        } catch { /* ignorar */ }
    }

    // 3. twitter:image
    const tw = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (tw?.[1]?.startsWith('http')) return tw[1]

    return null
}

// ── Replicate Flux Pro ─────────────────────────────────
async function fluxImgToImg(imageBuffer, prompt, strength = 0.2) {
    if (!REPLICATE_API_KEY) return null
    try {
        const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`
        const res = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: FLUX_PRO,
                input: { image: dataUri, prompt, strength, aspect_ratio: '1:1', output_format: 'webp', safety_tolerance: 2, seed: Math.floor(Math.random() * 999999) },
            }),
            signal: AbortSignal.timeout(10000),
        })
        if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); return fluxImgToImg(imageBuffer, prompt, strength) }
        if (!res.ok) { const t = await res.text(); console.log(`     ⚠️  Replicate ${res.status}: ${t.slice(0, 100)}`); return null }
        const pred = await res.json()
        return pred.urls?.get ? await pollReplicate(pred.urls.get) : null
    } catch (e) { console.log(`     ⚠️  Replicate error: ${e.message?.slice(0,80)}`); return null }
}

async function fluxTxt2Img(prompt) {
    if (!REPLICATE_API_KEY) return null
    try {
        const res = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${REPLICATE_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: FLUX_PRO,
                input: { prompt, aspect_ratio: '1:1', output_format: 'webp', safety_tolerance: 2, seed: Math.floor(Math.random() * 999999) },
            }),
            signal: AbortSignal.timeout(10000),
        })
        if (res.status === 429) { await new Promise(r => setTimeout(r, 15000)); return fluxTxt2Img(prompt) }
        if (!res.ok) { console.log(`     ⚠️  Replicate txt2img ${res.status}`); return null }
        const pred = await res.json()
        return pred.urls?.get ? await pollReplicate(pred.urls.get) : null
    } catch (e) { console.log(`     ⚠️  Replicate txt2img error: ${e.message?.slice(0,80)}`); return null }
}

async function pollReplicate(pollUrl, maxMs = 90000) {
    const deadline = Date.now() + maxMs
    while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 2500))
        try {
            const poll = await fetch(pollUrl, {
                headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
                signal: AbortSignal.timeout(8000),
            })
            if (!poll.ok) return null
            const s = await poll.json()
            if (s.status === 'succeeded') {
                const out = s.output
                return Array.isArray(out) ? out[0] : (typeof out === 'string' ? out : null)
            }
            if (s.status === 'failed') { console.log('     ⚠️  Replicate: prediction failed'); return null }
        } catch { return null }
    }
    return null
}

// ── Upload a Supabase Storage ──────────────────────────
async function subirAStorage(buffer, nombre) {
    const path = `${STORAGE_PREFIX}/${safeName(nombre)}-${Date.now()}.webp`
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
        contentType: 'image/webp', upsert: true,
    })
    if (error) throw new Error(`Storage upload: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return publicUrl
}

// ── Actualizar BD ──────────────────────────────────────
async function actualizarDB(id, imagenUrl) {
    const { error } = await supabase.from('recetas').update({ imagen_url: imagenUrl }).eq('id', id)
    if (error) throw new Error(`DB update: ${error.message}`)
}

// ── Procesar una receta ────────────────────────────────
async function procesarReceta(r, idx, total) {
    const tag = `[${idx}/${total}]`
    console.log(`\n${tag} ${r.nombre}`)
    console.log(`      categoria: ${r.categoria ?? '—'} | url_origen: ${r.url_origen ? 'sí' : 'no'}`)

    let imagenBuffer = null
    let metodo = ''

    // Paso 1 — Intentar capturar imagen real
    if (r.url_origen && !SOLO_SIN_URL) {
        console.log(`      📸 agent-browser capturando imagen real...`)
        const real = capturarImagenReal(r.url_origen)
        if (real) {
            console.log(`      ✅ Imagen real obtenida (${(real.length / 1024).toFixed(0)} KB)`)
            if (REPLICATE_API_KEY) {
                console.log(`      🎨 Flux img2img strength=0.2 (estilo casero)...`)
                const prompt = buildPromptImg2Img(r.nombre, r.categoria)
                const fluxUrl = await fluxImgToImg(real, prompt, 0.2)
                if (fluxUrl) {
                    imagenBuffer = await descargar(fluxUrl)
                    metodo = 'agent_browser+flux_img2img'
                    console.log(`      ✅ Flux img2img completado`)
                }
            }
            if (!imagenBuffer) {
                // Sin Replicate o Flux falló → usar imagen real directa
                imagenBuffer = real
                metodo = 'agent_browser_directo'
            }
        } else {
            console.log(`      ℹ️  agent-browser: sin imagen en la página`)
        }
    }

    // Paso 2 — Fallback: Flux txt2img casero
    if (!imagenBuffer) {
        if (!REPLICATE_API_KEY) {
            console.log(`      ⚠️  Sin REPLICATE_API_KEY y sin imagen real — saltando`)
            return { ok: false, razon: 'sin_replicate_y_sin_imagen' }
        }
        console.log(`      🎨 Flux txt2img casero (sin imagen real disponible)...`)
        const prompt = buildPromptTxt2Img(r.nombre, r.categoria, r.ingredientes)
        const fluxUrl = await fluxTxt2Img(prompt)
        if (fluxUrl) {
            imagenBuffer = await descargar(fluxUrl)
            metodo = 'flux_txt2img_casero'
            console.log(`      ✅ Flux txt2img completado`)
        }
    }

    if (!imagenBuffer) {
        console.log(`      ❌ No se obtuvo imagen — saltando`)
        return { ok: false, razon: 'sin_imagen' }
    }

    if (DRY_MODE) {
        console.log(`      🔍 DRY: habría subido ${(imagenBuffer.length / 1024).toFixed(0)} KB via ${metodo}`)
        return { ok: true, metodo, dry: true }
    }

    // Paso 3 — Subir a Storage
    console.log(`      ☁️  Subiendo a Storage (${(imagenBuffer.length / 1024).toFixed(0)} KB)...`)
    const publicUrl = await subirAStorage(imagenBuffer, r.nombre)

    // Paso 4 — Actualizar BD
    await actualizarDB(r.id, publicUrl)
    console.log(`      ✅ Guardado: ${publicUrl.slice(-60)}`)

    return { ok: true, metodo }
}

// ── MAIN ───────────────────────────────────────────────
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 REHACER IMÁGENES — Estilo casero personal          ║
║  agent-browser real → Flux img2img 0.2 → Supabase     ║
╚══════════════════════════════════════════════════════════╝
`)

    if (DRY_MODE)     console.log('  🔍 MODO DRY — no se sube ni actualiza nada\n')
    if (RESET_MODE)   console.log('  🔄 MODO RESET — se borrará imagen_url de todas las recetas\n')
    if (SOLO_SIN_URL) console.log('  🎨 MODO SOLO-SIN-URL — solo recetas sin url_origen (Flux directo)\n')

    // Reset: limpiar imagen_url
    if (RESET_MODE && !DRY_MODE) {
        const { error } = await supabase.from('recetas').update({ imagen_url: null }).eq('estado', 'aprobada')
        if (error) { console.error('❌ Error en reset:', error.message); process.exit(1) }
        console.log('  🗑️  imagen_url limpiada en todas las recetas aprobadas\n')
    }

    // Obtener recetas
    let query = supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen, imagen_url')
        .eq('estado', 'aprobada')
        .limit(MAX)

    if (!RESET_MODE) query = query.is('imagen_url', null)
    if (SOLO_SIN_URL) query = query.is('url_origen', null)

    const { data: recetasBase, error: qError } = await query
    if (qError) { console.error('❌ Error query:', qError.message); process.exit(1) }
    if (!recetasBase?.length) { console.log('  ✅ No hay recetas a procesar'); return }

    // Obtener ingredientes para cada receta
    const recetas = []
    for (const r of recetasBase) {
        const { data: ings } = await supabase.from('receta_ingredientes').select('nombre_libre').eq('receta_id', r.id)
        recetas.push({ ...r, ingredientes: (ings || []).map(i => i.nombre_libre).filter(Boolean) })
    }

    const total = recetas.length
    const costeEst = REPLICATE_API_KEY ? `~$${(total * 0.05).toFixed(2)} Replicate` : 'sin coste (sin Replicate)'
    console.log(`  📊 Recetas a procesar: ${total}`)
    console.log(`  💰 Coste estimado: ${costeEst}`)
    console.log(`  ⏱️  Tiempo estimado: ~${Math.ceil(total * 12 / 60)} minutos\n`)

    let ok = 0, fallidos = 0, saltados = 0
    const log = []

    for (let i = 0; i < recetas.length; i++) {
        const r = recetas[i]
        try {
            const resultado = await procesarReceta(r, i + 1, total)
            if (resultado.ok) { ok++; log.push({ nombre: r.nombre, metodo: resultado.metodo, estado: '✅' }) }
            else              { saltados++; log.push({ nombre: r.nombre, metodo: resultado.razon, estado: '⏭️' }) }
        } catch (e) {
            fallidos++
            log.push({ nombre: r.nombre, metodo: 'error', estado: '❌' })
            console.log(`      ❌ Error: ${e.message?.slice(0, 100)}`)
        }

        if (i < recetas.length - 1) await new Promise(r => setTimeout(r, PAUSA_MS))
    }

    // Resumen
    const SALIDA_DIR = resolve(RAÍZ, 'salidas')
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })
    const logPath = join(SALIDA_DIR, `rehacer-imagenes-${new Date().toISOString().slice(0,10)}.json`)
    if (!DRY_MODE) writeFileSync(logPath, JSON.stringify(log, null, 2))

    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  📊 RESUMEN`)
    console.log(`═══════════════════════════════════════════`)
    console.log(`  ✅ Subidas:  ${ok}/${total}`)
    console.log(`  ⏭️  Saltadas: ${saltados}`)
    console.log(`  ❌ Fallidas: ${fallidos}`)
    if (!DRY_MODE) console.log(`  📄 Log:     ${logPath}`)
    console.log(``)

    // Breakdown por método
    const porMetodo = {}
    log.filter(l => l.estado === '✅').forEach(l => { porMetodo[l.metodo] = (porMetodo[l.metodo] || 0) + 1 })
    if (Object.keys(porMetodo).length) {
        console.log(`  Métodos usados:`)
        Object.entries(porMetodo).forEach(([m, n]) => console.log(`    ${m}: ${n}`))
    }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

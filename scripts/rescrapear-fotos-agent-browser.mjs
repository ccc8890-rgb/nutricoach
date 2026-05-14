/**
 * rescrapear-fotos-agent-browser.mjs
 *
 * Para las recetas que tienen url_origen (Instagram/TikTok/YouTube):
 *   1. Usa agent-browser para abrir la URL y extraer la imagen más grande del post
 *   2. Si agent-browser falla → descarga directa del og:image / primer <img> grande
 *   3. Pasa la imagen por OpenAI GPT-image-1.5 edit para limpiar y homogeneizar
 *   4. Guarda en salidas/revision-imagenes/ con prefijo og_image--
 *
 * Después de revisar:
 *   node scripts/subir-imagenes-aprobadas.mjs   → sube las aprobadas a Storage
 *
 * USO:
 *   node scripts/rescrapear-fotos-agent-browser.mjs            → preview (5 de prueba)
 *   node scripts/rescrapear-fotos-agent-browser.mjs --genera   → genera todas
 *   node scripts/rescrapear-fotos-agent-browser.mjs --slug "tortitas"  → solo esa receta
 *   MAX_RECETAS=10 node scripts/rescrapear-fotos-agent-browser.mjs --genera
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const OPENAI_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY no configurada'); process.exit(1) }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const GENERA = process.argv.includes('--genera')
const slugIdx = process.argv.indexOf('--slug')
const SLUG_FILTRO = slugIdx !== -1 ? process.argv[slugIdx + 1] : null
const MAX_RECETAS = parseInt(process.env.MAX_RECETAS || '5', 10)

// ── Prompt de limpieza homogéneo ──────────────────────────────────────────────
function buildCleanupPrompt(nombre, categoria) {
    const ESTILOS = {
        Desayuno: 'morning natural light, light wood table, Mediterranean home kitchen',
        Comida: 'afternoon light through window, neutral ceramic plate, home kitchen setting',
        Cena: 'warm evening light, dark wood surface, cozy home dinner',
        Postre: 'soft window light, marble or light wood surface, simple home baking setup',
        Snack: 'natural light, kitchen counter, casual home moment',
        Merienda: 'afternoon light, simple ceramic plate, home kitchen',
    }
    const style = ESTILOS[categoria] || ESTILOS['Comida']
    return [
        `Clean up this photo of "${nombre}":`,
        '1. Remove ALL overlaid text, titles, calorie info, hashtags, watermarks, logos.',
        '2. Remove any hands, fingers, or people. Keep only the dish and plate.',
        '3. Keep the exact same food, same composition, same plating.',
        `4. Lighting and background: ${style}.`,
        'Photorealistic. No AI artifacts. Same food, same angle, just cleaned up.',
    ].join(' ')
}

// ── Descarga directa de imagen (fallback) ────────────────────────────────────
async function descargarBuffer(url, timeout = 15000) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
            signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || ''
        if (!ct.startsWith('image/')) return null
        const buf = Buffer.from(await res.arrayBuffer())
        return buf.length > 5000 ? buf : null
    } catch { return null }
}

// ── Thumbnail via yt-dlp + cookies Chrome (Instagram/TikTok) ─────────────────
// Usa las cookies de sesión de Chrome para autenticarse en Instagram/TikTok.
// Requiere Chrome abierto con la sesión activa al menos una vez.
async function obtenerThumbnailYtdlp(url) {
    const os = await import('os')
    const path = await import('path')
    const { mkdirSync, readdirSync, readFileSync, rmSync } = await import('fs')

    const tmpDir = path.default.join(os.default.tmpdir(), `ytdlp_thumb_${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })

    try {
        const PATH_EXT = `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`
        const env = { ...process.env, PATH: `${PATH_EXT}:${process.env.PATH || ''}` }
        const outTemplate = `${tmpDir}/thumb.%(ext)s`
        execSync(
            `yt-dlp --write-thumbnail --skip-download --cookies-from-browser chrome -o ${JSON.stringify(outTemplate)} ${JSON.stringify(url)}`,
            { timeout: 45000, encoding: 'utf8', env }
        )
        const files = readdirSync(tmpDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
        if (files.length === 0) return null
        const buf = readFileSync(path.default.join(tmpDir, files[0]))
        return buf.length > 5000 ? buf : null
    } catch {
        return null
    } finally {
        try { rmSync(tmpDir, { recursive: true }) } catch { /* ignore */ }
    }
}

// ── Scraping con agent-browser ────────────────────────────────────────────────
function scraperConAgentBrowser(url) {
    try {
        const PATH_EXT = `/opt/homebrew/bin:/Users/${process.env.USER}/.npm-global/bin:/usr/local/bin:/usr/bin:/bin`
        const env = { ...process.env, PATH: `${PATH_EXT}:${process.env.PATH || ''}` }

        // Abrir URL
        execSync(`agent-browser open ${JSON.stringify(url)}`, { timeout: 20000, encoding: 'utf8', env })

        // Extraer URLs de imágenes grandes via eval
        const result = execSync(
            `agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('img')).filter(img=>img.naturalWidth>150&&img.naturalHeight>150).sort((a,b)=>(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight)).slice(0,8).map(img=>img.src))"`,
            { timeout: 15000, encoding: 'utf8', env }
        )

        execSync('agent-browser close', { timeout: 5000, encoding: 'utf8', env }).toString()

        let urls = []
        try {
            const match = result.match(/\[[\s\S]*?\]/)
            if (match) urls = JSON.parse(match[0]).filter(u => typeof u === 'string' && u.startsWith('http'))
        } catch {
            const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
            urls = [...new Set([...result.matchAll(imgRegex)].map(m => m[0]))]
        }
        return urls
    } catch {
        return []
    }
}

// ── OpenAI image edit ─────────────────────────────────────────────────────────
async function openAIImageEdit(imageBuffer, prompt) {
    const form = new FormData()
    form.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'image.jpg')
    form.append('model', 'gpt-image-1.5')
    form.append('prompt', prompt)
    form.append('n', '1')
    form.append('size', '1024x1024')
    form.append('quality', 'medium')

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
            return openAIImageEdit(imageBuffer, prompt)
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
    throw new Error('OpenAI: respuesta vacía')
}

function slugify(nombre) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50)
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

    let query = supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen')
        .not('url_origen', 'is', null)

    if (SLUG_FILTRO) query = query.ilike('nombre', `%${SLUG_FILTRO}%`)

    const { data: recetas, error } = await query
    if (error) { console.error('Error Supabase:', error.message); process.exit(1) }
    if (!recetas?.length) { console.log('✅ No hay recetas con url_origen.'); return }

    const lista = GENERA ? recetas.slice(0, parseInt(process.env.MAX_RECETAS || '9999')) : recetas.slice(0, MAX_RECETAS)
    const coste = (lista.length * 0.034).toFixed(2)

    console.log(`\n🖼️  Re-scraping fotos — agent-browser + OpenAI GPT-image-1.5 edit`)
    console.log(`📋 Recetas con url_origen: ${recetas.length}`)
    console.log(`🔄 A procesar: ${lista.length} | 💰 Coste estimado: ~$${coste}`)

    if (!GENERA) {
        console.log('\n⚠️  PREVIEW (5 primeras) — añade --genera para procesar todas\n')
        lista.forEach((r, i) => console.log(`  ${i + 1}. ${r.nombre}`))
        console.log(`\n  Ejemplo: MAX_RECETAS=10 node scripts/rescrapear-fotos-agent-browser.mjs --genera`)
        return
    }

    let ok = 0, err = 0
    for (let i = 0; i < lista.length; i++) {
        const r = lista[i]
        const slug = slugify(r.nombre)
        const outPath = resolve(SALIDA_DIR, `og_image--${slug}.jpg`)

        // Skip si ya existe
        if (existsSync(outPath)) {
            console.log(`[${i + 1}/${lista.length}] ⏭️  ${r.nombre} (ya existe)`)
            ok++; continue
        }

        console.log(`[${i + 1}/${lista.length}] ${r.nombre}`)
        console.log(`     URL: ${r.url_origen}`)

        let imageBuffer = null
        const esSocial = /instagram\.com|tiktok\.com|vm\.tiktok/i.test(r.url_origen)

        // Paso 1: yt-dlp + cookies Chrome (solo para Instagram/TikTok — único método que funciona)
        if (esSocial) {
            console.log(`     📱 Instagram/TikTok — descargando thumbnail con yt-dlp...`)
            imageBuffer = await obtenerThumbnailYtdlp(r.url_origen)
            if (imageBuffer) console.log(`     ✅ Thumbnail descargado ${Math.round(imageBuffer.length / 1024)}KB`)
        }

        // Paso 2: agent-browser (para URLs no-sociales o si yt-dlp falla)
        if (!imageBuffer && !esSocial) {
            console.log(`     🌐 Scraping con agent-browser...`)
            const urls = scraperConAgentBrowser(r.url_origen)
            if (urls.length > 0) {
                console.log(`     📸 ${urls.length} imagen(es) encontradas, descargando...`)
                for (const imgUrl of urls) {
                    imageBuffer = await descargarBuffer(imgUrl)
                    if (imageBuffer) {
                        console.log(`     ✅ Descargada ${Math.round(imageBuffer.length / 1024)}KB`)
                        break
                    }
                }
            }
        }

        // Paso 3: fallback — og:image directo
        if (!imageBuffer) {
            console.log(`     ⚠️  Sin resultado, intentando og:image...`)
            try {
                const htmlRes = await fetch(r.url_origen, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
                    signal: AbortSignal.timeout(10000),
                })
                if (htmlRes.ok) {
                    const html = await htmlRes.text()
                    const ogMatch = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
                        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i)
                    if (ogMatch?.[1]) {
                        imageBuffer = await descargarBuffer(ogMatch[1])
                        if (imageBuffer) console.log(`     ✅ og:image descargada ${Math.round(imageBuffer.length / 1024)}KB`)
                    }
                }
            } catch { /* ignorar */ }
        }

        if (!imageBuffer) {
            console.log(`     ❌ No se pudo obtener imagen de la fuente`)
            err++; continue
        }

        // Paso 3: OpenAI image edit
        try {
            console.log(`     🎨 OpenAI GPT-image-1.5 edit...`)
            const prompt = buildCleanupPrompt(r.nombre, r.categoria)
            const refinedBuffer = await openAIImageEdit(imageBuffer, prompt)
            writeFileSync(outPath, refinedBuffer)
            console.log(`     ✅ ${Math.round(refinedBuffer.length / 1024)}KB → ${outPath.split('/').pop()}`)
            ok++
        } catch (e) {
            console.log(`     ⚠️  OpenAI falló (${e.message.slice(0, 80)}), guardando original sin refinar`)
            writeFileSync(outPath, imageBuffer)
            ok++
        }

        // Pausa entre llamadas para evitar rate limit
        if (i < lista.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`\n════════════════════════════════`)
    console.log(`  ✅ OK: ${ok}  ❌ Errores: ${err}`)
    console.log(`  💰 Coste real: ~$${(ok * 0.034).toFixed(2)}`)
    console.log(`  📁 Imágenes en: salidas/revision-imagenes/og_image--*.jpg`)
    console.log(`  ➡️  Subir: node scripts/subir-imagenes-aprobadas.mjs`)
}

main().catch(e => { console.error(e); process.exit(1) })

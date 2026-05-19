/**
 * regenerar-imagenes-reales.mjs
 *
 * Pipeline: foto real de Cookpad → crop cuadrado → edición ligera GPT-4o → Supabase Storage
 * La edición solo limpia texto/personas — mantiene la composición exacta de la foto real.
 * Misma estrategia que el pipeline de fotos reales de Instagram (refinar-imagenes-og.mjs).
 *
 * USO:
 *   node scripts/regenerar-imagenes-reales.mjs               → preview
 *   node scripts/regenerar-imagenes-reales.mjs --prueba      → 5 de prueba
 *   node scripts/regenerar-imagenes-reales.mjs --genera      → todas (~$0.034/img)
 *   node scripts/regenerar-imagenes-reales.mjs --limite 20   → máx N
 *   node scripts/regenerar-imagenes-reales.mjs --id <uuid>   → solo esa
 *   node scripts/regenerar-imagenes-reales.mjs --forzar --id <uuid> → re-genera aunque ya OK
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Env ───────────────────────────────────────────────────────────────────────
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
        if (!process.env[k]) process.env[k] = v
    }
}
loadEnv()

const SB_URL    = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const BUCKET    = 'recetas'

if (!SB_URL || !SB_KEY) { console.error('❌ Variables Supabase no configuradas'); process.exit(1) }
if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY no configurada en .env.local'); process.exit(1) }

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const GENERA  = args.includes('--genera')
const PRUEBA  = args.includes('--prueba')
const FORZAR  = args.includes('--forzar')
const idIdx   = args.indexOf('--id')
const SOLO_ID = idIdx !== -1 ? args[idIdx + 1] : undefined
const limIdx  = args.indexOf('--limite')
const MAX     = limIdx !== -1 ? parseInt(args[limIdx + 1], 10) : 9999

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

// ── Buscar imagen en Cookpad ──────────────────────────────────────────────────
async function buscarEnCookpad(nombre) {
    const r = await fetch('https://cookpad.com/es/buscar/' + encodeURIComponent(nombre), {
        headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' },
        signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) return null
    const html = await r.text()

    const urls = [...html.matchAll(/"(https:\/\/img-global\.cpcdn\.com\/recipes\/[^"]+)"/g)]
        .map(m => m[1])
        .filter((u, i, arr) => arr.indexOf(u) === i)

    return urls.find(u => u.includes('1200'))
        || urls.find(u => u.includes('640'))
        || urls.find(u => u.includes('400'))
        || urls[0]
        || null
}

// Fallback: og:image desde webs de recetas españolas
async function buscarFallback(nombre) {
    const sitios = [
        `https://www.pequerecetas.com/?s=${encodeURIComponent(nombre)}`,
        `https://www.recetasgratis.net/busqueda?q=${encodeURIComponent(nombre)}`,
        `https://www.directoalpaladar.com/?s=${encodeURIComponent(nombre)}`,
    ]
    for (const sitioUrl of sitios) {
        try {
            const r = await fetch(sitioUrl, {
                headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES' },
                signal: AbortSignal.timeout(12000),
            })
            if (!r.ok) continue
            const html = await r.text()

            const domain = new URL(sitioUrl).hostname
            const href = html.match(new RegExp(`href="(https?://${domain.replace('.', '\\.')}/[^"?#]+)"`))?.[1]
            if (!href) continue

            const r2 = await fetch(href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) })
            if (!r2.ok) continue
            const html2 = await r2.text()
            const og = html2.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                    || html2.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
            if (og?.[1]?.startsWith('http')) return og[1]
        } catch { /* siguiente sitio */ }
    }
    return null
}

// ── Descargar y cropear ───────────────────────────────────────────────────────
async function descargarYCropear(url) {
    const r = await fetch(url, {
        headers: { 'User-Agent': UA, Referer: 'https://cookpad.com/' },
        signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) return null
    const ct = r.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return null

    const raw = Buffer.from(await r.arrayBuffer())
    if (raw.length < 10000) return null

    const img = sharp(raw)
    const meta = await img.metadata()
    const lado = Math.min(meta.width || 800, meta.height || 800)

    return img
        .extract({
            left:   Math.floor(((meta.width || 0) - lado) / 2),
            top:    Math.floor(((meta.height || 0) - lado) / 2),
            width:  lado,
            height: lado,
        })
        .resize(1024, 1024)
        .jpeg({ quality: 90 })
        .toBuffer()
}

// ── Edición ligera GPT-4o — mismo pipeline que fotos de Instagram ─────────────
function buildPrompt(nombre) {
    return `Esta es una foto de la receta "${nombre}".

Edita la imagen de la forma más mínima posible:
1. Si hay texto superpuesto, títulos, watermarks, logos o hashtags sobre la comida, elimínalos.
2. Si hay personas, manos o dedos visibles, elimínalos.
3. Mantén TODO lo demás exactamente igual: la misma composición, la misma luz, el mismo fondo, el mismo plato, los mismos colores. No mejores nada, no cambies nada, no estilices nada.

El objetivo es la foto original sin texto ni personas. Nada más.`
}

async function editarConGPT(jpegBuffer, nombre) {
    const form = new FormData()
    const blob = new Blob([jpegBuffer], { type: 'image/jpeg' })
    form.append('image', blob, 'foto.png')   // OpenAI acepta JPEG aunque la extensión diga png
    form.append('model', 'gpt-image-1')
    form.append('prompt', buildPrompt(nombre))
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
            console.log('\n     ⏳ Rate limit, esperando 20s...')
            await new Promise(x => setTimeout(x, 20000))
            return editarConGPT(jpegBuffer, nombre)
        }
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')

    const url = data.data?.[0]?.url
    if (url) {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) })
        return Buffer.from(await imgRes.arrayBuffer())
    }

    throw new Error('Respuesta vacía de OpenAI')
}

// ── Supabase Storage ──────────────────────────────────────────────────────────
function extractFilename(url) {
    if (!url) return null
    try { return new URL(url).pathname.split('/').pop() } catch { return null }
}

async function subirImagen(buffer, recetaId) {
    const path = `blog/${recetaId}.jpg`
    const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
        contentType: 'image/jpeg', upsert: true,
    })
    if (error) throw new Error(`Storage: ${error.message}`)
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function actualizarUrl(id, imagenUrl) {
    const { error } = await sb.from('recetas').update({ imagen_url: imagenUrl }).eq('id', id)
    if (error) throw new Error(`DB: ${error.message}`)
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  📸 IMÁGENES REALES — Cookpad → crop → GPT-4o edición ligera    ║
║  Mismo pipeline que fotos de Instagram. ~$0.034/imagen.          ║
╚══════════════════════════════════════════════════════════════════╝
`)

    const { data: protegidas } = await sb.from('recetas').select('imagen_url').not('url_origen', 'is', null)
    const archivosProtegidos = new Set(
        (protegidas || []).map(r => extractFilename(r.imagen_url)).filter(Boolean)
    )
    console.log(`🔒 ${archivosProtegidos.size} archivos protegidos\n`)

    let query = sb
        .from('recetas')
        .select('id, nombre, tipo_plato, categoria, imagen_url')
        .order('nombre')

    if (!FORZAR) query = query.is('url_origen', null).ilike('imagen_url', '%/auto_%')
    if (SOLO_ID) query = query.eq('id', SOLO_ID)
    if (!SOLO_ID) query = query.limit(MAX)

    const { data: candidatas, error } = await query
    if (error) { console.error('❌', error.message); process.exit(1) }

    const lista0 = (candidatas || []).filter(r => {
        const fn = extractFilename(r.imagen_url)
        if (!fn) return false
        if (archivosProtegidos.has(fn)) {
            console.log(`⚠️  SKIP compartida: ${r.nombre}`)
            return false
        }
        return true
    })
    const lista = PRUEBA ? lista0.slice(0, 5) : lista0

    const coste = (lista.length * 0.034).toFixed(2)
    console.log(`📋 A procesar: ${lista.length}   💰 Coste estimado: ~$${coste}\n`)

    if (!GENERA) {
        console.log('⚠️  PREVIEW — añade --genera para ejecutar\n')
        lista.slice(0, 20).forEach((r, i) =>
            console.log(`  ${String(i+1).padStart(3)}. ${r.nombre}`)
        )
        if (lista.length > 20) console.log(`  ... y ${lista.length - 20} más`)
        console.log(`\n  node scripts/regenerar-imagenes-reales.mjs --prueba --genera`)
        console.log(`  node scripts/regenerar-imagenes-reales.mjs --genera\n`)
        return
    }

    let ok = 0, sinFoto = 0, errores = 0

    for (let i = 0; i < lista.length; i++) {
        const r = lista[i]
        process.stdout.write(`[${i+1}/${lista.length}] ${r.nombre.slice(0, 48).padEnd(50)} `)

        try {
            let imgUrl = await buscarEnCookpad(r.nombre)
            let fuente = 'Cookpad'

            if (!imgUrl) {
                imgUrl = await buscarFallback(r.nombre)
                fuente = 'fallback'
            }

            if (!imgUrl) {
                console.log('📭 sin foto')
                sinFoto++
                continue
            }

            const cropped = await descargarYCropear(imgUrl)
            if (!cropped) {
                console.log('❌ descarga fallida')
                sinFoto++
                continue
            }

            const edited = await editarConGPT(cropped, r.nombre)
            const publicUrl = await subirImagen(edited, r.id)
            await actualizarUrl(r.id, publicUrl)
            console.log(`✅ ${fuente} ${(edited.length/1024).toFixed(0)}KB`)
            ok++

        } catch (err) {
            console.log(`❌ ${err.message?.slice(0, 80)}`)
            errores++
        }

        if (i < lista.length - 1) await new Promise(x => setTimeout(x, 1500))
    }

    const costeReal = (ok * 0.034).toFixed(2)
    console.log(`
═══════════════════════════════════════
  ✅ OK:        ${ok}
  📭 Sin foto:  ${sinFoto}
  ❌ Errores:   ${errores}
  💰 Coste:     ~$${costeReal}
`)
    if (sinFoto > 0) console.log(`  Las ${sinFoto} sin foto → usar regenerar-imagenes-malas.mjs como fallback.`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

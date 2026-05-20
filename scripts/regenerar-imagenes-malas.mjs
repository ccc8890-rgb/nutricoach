/**
 * regenerar-imagenes-malas.mjs
 *
 * Regenera imágenes de IA genéricas (auto_TIMESTAMP.jpg) con estilo
 * food blogger realista — igual que las fotos de Instagram/TikTok reales.
 *
 * CRITERIOS para regenerar:
 *   - url_origen IS NULL (no viene de un vídeo real)
 *   - imagen_url contiene '/auto_' (generada por el pipeline txt2img sin referencia visual)
 *
 * PROTECCIÓN:
 *   - Recetas con url_origen IS NOT NULL → NUNCA tocar (son fotos reales refinadas)
 *   - Recetas sin url_origen pero cuyo archivo imagen_url está compartido con una
 *     receta protegida → SALTAR (ej: Wrap César Fit comparte imagen con receta de IG)
 *   - Las 10 recetas Serie Chef (imagen UUID sin auto_) → NUNCA tocar
 *
 * USO:
 *   node scripts/regenerar-imagenes-malas.mjs               → preview de candidatas
 *   node scripts/regenerar-imagenes-malas.mjs --genera       → regenera todas
 *   node scripts/regenerar-imagenes-malas.mjs --prueba       → solo 3 de prueba
 *   node scripts/regenerar-imagenes-malas.mjs --limite 20    → máx N recetas
 *   node scripts/regenerar-imagenes-malas.mjs --id <uuid>    → solo esa receta
 *   node scripts/regenerar-imagenes-malas.mjs --repara-chuck → repara Chuck Fudge
 *
 * COSTE: ~$0.034/imagen (gpt-image-1 medium 1024x1024)
 */

import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const OPENAI_KEY = process.env.OPENAI_API_KEY
const SB_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET     = 'recetas'

if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY no configurada'); process.exit(1) }
if (!SB_URL || !SB_KEY) { console.error('❌ Variables Supabase no configuradas'); process.exit(1) }

const sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } })

// ── Args ──────────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2)
const GENERA  = args.includes('--genera')
const PRUEBA  = args.includes('--prueba')
const CHUCK   = args.includes('--repara-chuck')
const FORZAR  = args.includes('--forzar')   // re-genera IDs aunque ya tengan imagen nueva
const idIdx   = args.indexOf('--id')
const SOLO_ID = idIdx !== -1 ? args[idIdx + 1] : undefined
const limIdx  = args.indexOf('--limite')
const MAX     = limIdx !== -1 ? parseInt(args[limIdx + 1], 10) : 9999

// ── Prompt ────────────────────────────────────────────────────────────────────
// Estilo: foto rápida de móvil en casa, sin decoración, real e imperfecta
function buildPrompt(receta) {
    const ings = (receta.receta_ingredientes || [])
        .slice(0, 5)
        .map(i => i.nombre_libre)
        .filter(Boolean)
        .join(', ')

    return `Candid home photo of "${receta.nombre}" taken on a smartphone.
${ings ? `Food contains: ${ings}.` : ''}
Shot quickly at home — the plate is just sitting on the kitchen counter or table, no styling.
Soft, flat, diffused indoor light. Slightly washed out, not dramatic. No shadows.
The food fills most of the frame. Plain background — just the surface it's resting on.
No decoration, no props, no garnishes added for the photo. What you see is what was cooked.
Looks like a real person took it before eating, not a professional shoot.
Muted, natural colors. Slightly imperfect framing, honest and casual.
No text, no watermarks, no people, no hands.
Photorealistic, square 1:1.`
}

// ── OpenAI txt2img ────────────────────────────────────────────────────────────
async function generarImagen(prompt, intento = 1) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-image-1',
            prompt,
            n: 1,
            size: '1024x1024',
            quality: 'medium',
            output_format: 'jpeg',
        }),
        signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
        const err = await res.text()
        if (res.status === 429 && intento < 4) {
            console.log(`     ⏳ Rate limit, espera ${20 * intento}s...`)
            await new Promise(r => setTimeout(r, 20000 * intento))
            return generarImagen(prompt, intento + 1)
        }
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')

    const url = data.data?.[0]?.url
    if (url) {
        const r2 = await fetch(url, { signal: AbortSignal.timeout(30000) })
        return Buffer.from(await r2.arrayBuffer())
    }

    throw new Error('OpenAI devolvió respuesta vacía')
}

// ── OpenAI image edit (para reparar Chuck Fudge desde su imagen original) ─────
async function refinarImagenDesdeUrl(imageUrl, nombre) {
    // Descargar imagen original
    const r = await fetch(imageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) throw new Error(`No se pudo descargar: ${imageUrl}`)
    const imageBuffer = Buffer.from(await r.arrayBuffer())

    const prompt = `Esta es una foto de la receta "${nombre}".
Edita la imagen: elimina cualquier texto, watermark, persona, mano o logo.
Mantén exactamente la comida del plato original.
Ajusta la luz para que parezca luz natural de ventana en una cocina casera mediterránea.
Resultado: foto auténtica de food blogger español, sin elementos extraños, solo el plato.`

    const form = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
    form.append('image', blob, 'original.jpg')
    form.append('model', 'gpt-image-1')
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
        throw new Error(`OpenAI edit ${res.status}: ${err.slice(0, 300)}`)
    }

    const data = await res.json()
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')
    const url = data.data?.[0]?.url
    if (url) {
        const r2 = await fetch(url, { signal: AbortSignal.timeout(30000) })
        return Buffer.from(await r2.arrayBuffer())
    }
    throw new Error('OpenAI edit: respuesta vacía')
}

// ── Cloudinary ────────────────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

function extractFilename(imagenUrl) {
    if (!imagenUrl) return null
    try { return new URL(imagenUrl).pathname.split('/').pop() } catch { return null }
}

async function subirImagen(buffer, recetaId) {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'nutricoach/recetas',
          public_id: recetaId,
          resource_type: 'image',
          format: 'webp',
          overwrite: true,
          quality: 'auto:good',
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error('Cloudinary error'))
          resolve(result.secure_url)
        }
      )
      stream.end(buffer)
    })
}

async function actualizarUrl(id, imagenUrl) {
    const { error } = await sb.from('recetas').update({ imagen_url: imagenUrl }).eq('id', id)
    if (error) throw new Error(`DB update: ${error.message}`)
}

// ── Reparar Chuck Fudge ───────────────────────────────────────────────────────
async function repararChuckFudge() {
    console.log('\n🔧 REPARAR — Chuck Fudge Protein Balls')
    console.log('   Receta con url_origen pero imagen sobreescrita por el pipeline\n')

    // Buscar la receta
    const { data, error } = await sb
        .from('recetas')
        .select('id, nombre, url_origen, imagen_url')
        .ilike('nombre', '%chuck%fudge%')
        .limit(1)

    if (error) { console.error('❌ Error BD:', error.message); return }
    if (!data?.length) { console.error('❌ No se encontró "Chuck Fudge Protein Balls"'); return }

    const r = data[0]
    console.log(`   Encontrada: ${r.nombre}`)
    console.log(`   ID: ${r.id}`)
    console.log(`   url_origen: ${r.url_origen || '(vacío)'}`)
    console.log(`   imagen_url actual: ${r.imagen_url || '(vacío)'}`)

    if (!r.url_origen) {
        console.error('❌ Sin url_origen — no hay referencia visual para refinar')
        return
    }

    if (!GENERA) {
        console.log('\n⚠️  PREVIEW — añade --genera para reparar la imagen')
        return
    }

    try {
        // Intentar descargar imagen actual de Supabase Storage (puede tener texto/personas)
        // En su lugar, generamos txt2img con el estilo correcto (la original de IG está bloqueada)
        console.log('\n   🤖 Generando imagen nueva con estilo food blogger...')
        const prompt = `Photorealistic food photo of "Chuck Fudge Protein Balls".
Chocolate protein energy balls rolled in cocoa powder, arranged on a rustic ceramic plate.
Natural window light in a Mediterranean home kitchen, wooden table or dark slate surface.
Shot overhead, Sony mirrorless, food blog aesthetic, warm tones.
No text, no watermarks, no people, no hands. Photorealistic, square 1:1.`

        const buffer = await generarImagen(prompt)
        const publicUrl = await subirImagen(buffer, r.id)
        await actualizarUrl(r.id, publicUrl)

        console.log(`   ✅ Chuck Fudge reparado: ${publicUrl.slice(-60)}`)
    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`)
    }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🖼️  REGENERAR IMÁGENES MALAS — Estilo food blogger real  ║
╚═══════════════════════════════════════════════════════════╝
`)

    // Modo especial: reparar Chuck Fudge
    if (CHUCK) {
        await repararChuckFudge()
        return
    }

    // ── 1. Obtener archivos de imagen de recetas PROTEGIDAS (url_origen IS NOT NULL)
    console.log('📋 Cargando recetas protegidas (url_origen)...')
    const { data: protegidas, error: errProt } = await sb
        .from('recetas')
        .select('imagen_url')
        .not('url_origen', 'is', null)

    if (errProt) { console.error('❌', errProt.message); process.exit(1) }

    const archivosProtegidos = new Set(
        (protegidas || [])
            .map(r => extractFilename(r.imagen_url))
            .filter(Boolean)
    )
    console.log(`   ${archivosProtegidos.size} archivos de imagen protegidos\n`)

    // ── 2. Obtener candidatas: url_origen IS NULL + imagen con /auto_ en la URL
    let query = sb
        .from('recetas')
        .select('id, nombre, tipo_plato, categoria, imagen_url, receta_ingredientes(nombre_libre)')
        .order('nombre')

    // Sin --forzar: solo las malas (auto_*). Con --forzar + --id: re-genera aunque ya tenga imagen nueva
    if (!FORZAR) {
        query = query.is('url_origen', null).ilike('imagen_url', '%/auto_%')
    }
    if (SOLO_ID) query = query.eq('id', SOLO_ID)
    if (!SOLO_ID) query = query.limit(MAX)

    const { data: candidatas, error: errCand } = await query
    if (errCand) { console.error('❌', errCand.message); process.exit(1) }

    // ── 3. Filtrar las que comparten archivo con una receta protegida
    const candidatasFiltradas = (candidatas || []).filter(r => {
        const filename = extractFilename(r.imagen_url)
        if (!filename) return false
        if (archivosProtegidos.has(filename)) {
            console.log(`   ⚠️  SKIP (imagen compartida con receta protegida): ${r.nombre}`)
            return false
        }
        return true
    })

    const lista = PRUEBA ? candidatasFiltradas.slice(0, 3) : candidatasFiltradas
    const coste  = (lista.length * 0.034).toFixed(2)

    console.log(`\n📊 Resumen:`)
    console.log(`   Candidatas con imagen auto_*: ${(candidatas || []).length}`)
    console.log(`   Tras filtrar compartidas:      ${candidatasFiltradas.length}`)
    console.log(`   A procesar ahora:              ${lista.length}`)
    console.log(`   Coste estimado:               ~$${coste}`)

    if (!GENERA) {
        console.log('\n⚠️  PREVIEW — añade --genera para regenerar\n')
        lista.forEach((r, i) => {
            const filename = extractFilename(r.imagen_url) || '—'
            console.log(`  ${String(i + 1).padStart(3)}. ${r.nombre}`)
            console.log(`       tipo: ${r.tipo_plato || r.categoria || '—'} | archivo: ${filename}`)
        })
        console.log(`\n  Ejemplos:`)
        console.log(`    node scripts/regenerar-imagenes-malas.mjs --prueba --genera`)
        console.log(`    node scripts/regenerar-imagenes-malas.mjs --genera`)
        console.log(`    node scripts/regenerar-imagenes-malas.mjs --genera --limite 20`)
        console.log(`    node scripts/regenerar-imagenes-malas.mjs --repara-chuck --genera\n`)
        return
    }

    console.log('\n🚀 Regenerando...\n')
    let ok = 0, errores = 0, saltados = 0

    for (let i = 0; i < lista.length; i++) {
        const r = lista[i]
        process.stdout.write(`[${i + 1}/${lista.length}] ${r.nombre} ... `)

        try {
            const buffer = await generarImagen(buildPrompt(r))
            const publicUrl = await subirImagen(buffer, r.id)
            await actualizarUrl(r.id, publicUrl)
            console.log(`✅ ${(buffer.length / 1024).toFixed(0)}KB`)
            ok++
        } catch (err) {
            console.log(`❌ ${err.message?.slice(0, 120)}`)
            errores++
        }

        // Pausa entre llamadas (respeta rate limit OpenAI)
        if (i < lista.length - 1) await new Promise(r => setTimeout(r, 3000))
    }

    console.log(`
═══════════════════════════════════════
  ✅ Regeneradas:  ${ok}
  ❌ Errores:      ${errores}
  ⏭️  Saltadas:    ${saltados}
  💰 Coste real:  ~$${(ok * 0.034).toFixed(2)}
`)

    if (errores > 0) {
        console.log('  💡 Para reintentar fallidas: vuelve a ejecutar el mismo comando')
        console.log('     Las ya OK tienen imagen nueva (blog/{uuid}.jpg) y no se reprocesarán.')
    }

    // Reparar Chuck Fudge al final si se pidió con --genera
    if (args.includes('--repara-chuck')) {
        await repararChuckFudge()
    }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

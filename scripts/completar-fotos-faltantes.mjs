/**
 * completar-fotos-faltantes.mjs
 *
 * Genera imágenes con gpt-image-1.5 (txt2img) para recetas sin imagen_url
 * y las sube DIRECTAMENTE a Supabase Storage sin revisión manual.
 *
 * Coste: ~$0.034/imagen (gpt-image-1.5 medium 1024x1024)
 *
 * USO:
 *   node scripts/completar-fotos-faltantes.mjs            → preview
 *   node scripts/completar-fotos-faltantes.mjs --prueba   → genera 1 receta de prueba
 *   node scripts/completar-fotos-faltantes.mjs --genera   → genera y sube todas
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const BUCKET = 'recetas'

function loadEnv() {
    const p = resolve(RAÍZ, '.env.local')
    if (!existsSync(p)) return
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
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
if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY no configurada en .env.local')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const GENERA = process.argv.includes('--genera')
const PRUEBA = process.argv.includes('--prueba')

// Palabras españolas que OpenAI filtra por homonimia en inglés
const SAFE_NOMBRES = {
    'rape': 'monkfish',
}

function safeName(nombre) {
    const lower = nombre.toLowerCase()
    for (const [word, replacement] of Object.entries(SAFE_NOMBRES)) {
        if (lower.includes(word)) {
            return nombre.toLowerCase().replace(word, replacement)
        }
    }
    return nombre
}

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(receta) {
    const ings = (receta.receta_ingredientes || [])
        .slice(0, 5)
        .map(i => i.nombre_libre || i.alimento?.nombre)
        .filter(Boolean)
        .join(', ')

    const nombre = safeName(receta.nombre)

    return `Photo of "${nombre}" taken by a Spanish nutrition coach for their Instagram.
${ings ? `Main ingredients: ${ings}.` : ''}
Home kitchen setting — clean marble or wooden surface, no elaborate props.
Good natural window light, soft and even.
Plating is neat but not fussy: real bowl or plate, food looks appetizing and fresh.
Not a professional shoot, but someone who cares about how their food looks.
Think: Spanish fitness influencer who cooks at home.
Overhead or slight angle. No text, no watermarks, no people. Square format. Photorealistic.`
}

// ── Generar imagen con OpenAI ─────────────────────────────────────────────────
async function generarImagen(prompt) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-image-1.5',
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
        if (res.status === 429) {
            console.log('     ⏳ Rate limit, esperando 20s...')
            await new Promise(r => setTimeout(r, 20000))
            return generarImagen(prompt)
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
    throw new Error('Respuesta vacía de OpenAI')
}

// ── Subir a Supabase Storage y actualizar BD ──────────────────────────────────
async function subirYActualizar(recetaId, buffer) {
    const storagePath = `${recetaId}/auto_${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

    if (uploadError) throw new Error(`Upload: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

    const { error: updateError } = await supabase
        .from('recetas')
        .update({ imagen_url: publicUrl })
        .eq('id', recetaId)

    if (updateError) throw new Error(`Update BD: ${updateError.message}`)

    return publicUrl
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, tipo_plato, receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
        .is('imagen_url', null)
        .eq('estado', 'aprobada')
        .order('nombre')

    if (error) { console.error('Error Supabase:', error.message); process.exit(1) }
    if (!recetas?.length) { console.log('✅ Todas las recetas tienen imagen.'); return }

    const lista = PRUEBA ? recetas.slice(0, 1) : recetas
    const coste = (lista.length * 0.034).toFixed(2)

    console.log(`\n🖼️  Completar fotos faltantes — gpt-image-1.5 txt2img`)
    console.log(`📋 Recetas sin imagen: ${recetas.length}`)
    console.log(`💰 Coste estimado: ~$${coste} ($0.034/img)`)
    console.log(`🚀 Modo: ${GENERA ? (PRUEBA ? 'PRUEBA (1 imagen)' : 'REAL') : 'PREVIEW'}`)
    console.log()

    lista.forEach((r, i) => console.log(`  ${i + 1}. ${r.nombre} (${r.tipo_plato || '—'})`))

    if (!GENERA) {
        console.log('\n⚠️  Para generar añade --genera (con --prueba para probar 1 primero)\n')
        return
    }

    console.log('\n🚀 Generando y subiendo...\n')
    let ok = 0
    let errores = 0

    for (let i = 0; i < lista.length; i++) {
        const receta = lista[i]
        process.stdout.write(`[${i + 1}/${lista.length}] ${receta.nombre} ... `)

        try {
            const buffer = await generarImagen(buildPrompt(receta))
            const url = await subirYActualizar(receta.id, buffer)
            console.log(`✅ ${(buffer.length / 1024).toFixed(0)}KB → ${url.slice(-40)}`)
            ok++
        } catch (err) {
            console.log(`❌ ${err.message}`)
            errores++
        }

        if (i < lista.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`\n═══════════════════════════`)
    console.log(`  ✅ Completadas: ${ok}`)
    console.log(`  ❌ Errores:    ${errores}`)
    console.log(`  💰 Coste real: ~$${(ok * 0.034).toFixed(2)}`)
    if (errores > 0) console.log(`\n  Reintenta los errores con --genera de nuevo (skip automático de las ya subidas)`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

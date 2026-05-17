/**
 * generar-imagenes-nuevas.mjs
 *
 * Genera imágenes con IA para recetas que NO tienen url_origen (foto real).
 * Usa gpt-image-1.5 (txt2img) via OpenAI API — fetch directo, sin SDK.
 *
 * Coste: ~$0.034/imagen (gpt-image-1.5 medium 1024x1024)
 * Para 18 recetas: ~$0.61 de $10 disponibles en OpenAI.
 *
 * Imágenes guardadas en salidas/revision-imagenes/ con prefijo ai_gen--.
 * Después: node scripts/subir-imagenes-aprobadas.mjs
 *
 * USO:
 *   node scripts/generar-imagenes-nuevas.mjs              → preview (sin generar)
 *   node scripts/generar-imagenes-nuevas.mjs --genera     → genera todas
 *   node scripts/generar-imagenes-nuevas.mjs --prueba     → solo 2 de prueba
 *   node scripts/generar-imagenes-nuevas.mjs --slug "pan" → solo esa receta
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

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
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[k]) process.env[k] = v
    }
}
loadEnv()

const OPENAI_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY no configurada en .env.local')
    console.error('   Añade: OPENAI_API_KEY=sk-...')
    process.exit(1)
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const GENERA = process.argv.includes('--genera')
const PRUEBA = process.argv.includes('--prueba')
const slugIdx = process.argv.indexOf('--slug')
const SLUG_FILTRO = slugIdx !== -1 ? process.argv[slugIdx + 1] : null

// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(receta) {
    const ings = (receta.receta_ingredientes || [])
        .slice(0, 5)
        .map(i => i.nombre_libre || i.alimento?.nombre)
        .filter(Boolean)
        .join(', ')

    return `Photo of "${receta.nombre}" taken by a Spanish nutrition coach for their Instagram.
${ings ? `Contains: ${ings}.` : ''}
Home kitchen setting — clean marble or wooden surface, no elaborate props.
Good natural window light, soft and even, not dramatic or golden hour.
Plating is neat but not fussy: real bowl or plate, food looks appetizing and fresh.
Not a professional shoot, but someone who cares about how their food looks.
Think: Spanish fitness influencer who cooks at home and knows basic composition.
Overhead or slight angle. No text, no watermarks, no people. Square format. Photorealistic.`
}

// ── Llamada API txt2img ───────────────────────────────────────────────────────
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

function nombreToSlug(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

    let query = supabase
        .from('recetas')
        .select('id, nombre, categoria, receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
        .is('url_origen', null)
        .is('imagen_url', null)

    if (SLUG_FILTRO) query = query.ilike('nombre', `%${SLUG_FILTRO}%`)

    const { data: recetas, error } = await query
    if (error) { console.error('Error Supabase:', error.message); process.exit(1) }
    if (!recetas?.length) { console.log('✅ No hay recetas sin imagen.'); return }

    const lista = PRUEBA ? recetas.slice(0, 2) : recetas
    const coste = (lista.length * 0.034).toFixed(2)

    console.log(`\n🖼️  Generación IA — gpt-image-1.5 txt2img`)
    console.log(`📋 Recetas sin imagen real: ${lista.length}`)
    console.log(`💰 Coste estimado: ~$${coste} (medium $0.034/img)`)

    if (!GENERA) {
        console.log('\n⚠️  PREVIEW — para generar añade --genera\n')
        lista.forEach((r, i) => console.log(`  ${i + 1}. ${r.nombre} (${r.categoria || '—'})`))
        console.log('\n  Ejemplo: node scripts/generar-imagenes-nuevas.mjs --prueba --genera')
        return
    }

    console.log('\n🚀 Generando...\n')
    let ok = 0, errores = 0

    for (let i = 0; i < lista.length; i++) {
        const receta = lista[i]
        const slug = nombreToSlug(receta.nombre)
        const outputFilename = `ai_gen--${slug}.jpg`
        const outputPath = join(SALIDA_DIR, outputFilename)

        process.stdout.write(`[${i + 1}/${lista.length}] ${receta.nombre} ... `)

        if (existsSync(outputPath)) {
            console.log('⏭️  ya existe')
            ok++
            continue
        }

        try {
            const buffer = await generarImagen(buildPrompt(receta))
            writeFileSync(outputPath, buffer)
            console.log(`✅ ${(buffer.length / 1024).toFixed(0)}KB`)
            ok++
        } catch (err) {
            console.log(`❌ ${err.message}`)
            errores++
        }

        if (i < lista.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    console.log(`\n═══════════════════════════`)
    console.log(`  ✅ Generadas: ${ok}  ❌ Errores: ${errores}`)
    console.log(`  💰 Coste real: ~$${(ok * 0.034).toFixed(2)}`)
    console.log(`  ➡️  Revisar imágenes en: salidas/revision-imagenes/ai_gen--*.jpg`)
    console.log(`  ➡️  Subir: node scripts/subir-imagenes-aprobadas.mjs\n`)
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

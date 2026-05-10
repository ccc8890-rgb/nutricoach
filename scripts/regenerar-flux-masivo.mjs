/**
 * regenerar-flux-masivo.mjs
 *
 * Refina con GPT-4o image edit las recetas cuya mejor imagen es flux_txt2img.
 * Toma la flux_txt2img existente como base y la refina con image edit para que
 * parezca una foto real de cocina casera, no IA generada desde cero.
 *
 * Coste: ~$1.97 para 58 recetas ($0.034/img edit medium)
 *
 * USO:
 *   node scripts/regenerar-flux-masivo.mjs          → preview
 *   node scripts/regenerar-flux-masivo.mjs --genera  → ejecutar
 *   node scripts/regenerar-flux-masivo.mjs --genera --prueba  → solo 2
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

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
if (!OPENAI_KEY) { console.error('❌ OPENAI_API_KEY no configurada'); process.exit(1) }

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const GENERA = process.argv.includes('--genera')
const PRUEBA = process.argv.includes('--prueba')

const SALIDA_DIR = '/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/salidas/revision-imagenes'

function nombreToSlug(n) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fuzzyMatch(slug, nombre) {
    const sw = new Set(slug.split('-').filter(w => w.length > 2))
    const ws = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(w => w.length > 2)
    const nw = new Set(ws)
    if (sw.size === 0 || nw.size === 0) return 0
    let ov = 0
    for (const w of sw) {
        if (nw.has(w)) { ov++; continue }
        for (const n of nw) { if (n.startsWith(w) || w.startsWith(n)) { ov++; break } }
    }
    return ov / Math.max(sw.size, nw.size)
}

const PRIORIDAD = ['og_image', 'flux_img2img', 'ai_gen', 'flux_txt2img']

// Prompt image edit minimal — refinar para que parezca foto real de cocina
function buildPromptEdit(nombre) {
    return `Esta imagen es una version generada por IA de "${nombre}".
Refina la imagen para que parezca una foto real de cocina casera:
1. Elimina cualquier textura artificial, brillos falsos o aspecto generado.
2. Manten exactamente la misma composicion y los mismos alimentos.
3. La iluminacion debe ser natural, como luz de cocina casera.
4. El plato debe verse real, con texturas naturales de comida verdadera.
5. Nada de bodegon, nada de estudio. Que parezca que alguien lo cocino y fotografio rapidamente.
El resultado debe ser la misma comida, pero con aspecto de foto real y autentica, sin rastro de IA.`
}

// Image edit con GPT-4o
async function gptImageEdit(imageBuffer, prompt, filename) {
    const form = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/webp' })
    form.append('image', blob, filename.replace(/\.\w+$/, '.png'))
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
    throw new Error('Respuesta vacia de OpenAI imagen')
}

async function main() {
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

    // Load disk files
    const archivos = readdirSync(SALIDA_DIR)
    const porSlug = {}
    for (const f of archivos) {
        for (const metodo of PRIORIDAD) {
            const prefix = metodo + '--'
            if (!f.startsWith(prefix)) continue
            const slug = f.slice(prefix.length).replace(/\.(webp|jpg|png|jpeg)$/, '')
            if (!porSlug[slug]) porSlug[slug] = []
            porSlug[slug].push({ metodo, archivo: f })
            break
        }
    }

    // Get all recetas
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen, receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
        .order('nombre')
    if (error) { console.error('Error:', error.message); process.exit(1) }

    // Find recetas whose best image is flux_txt2img
    const pendientes = []
    for (const r of recetas) {
        const slug = nombreToSlug(r.nombre)
        let bestSlug = slug
        let bestFiles = porSlug[slug] || []
        if (bestFiles.length === 0) {
            let bestScore = 0
            for (const s of Object.keys(porSlug)) {
                const score = fuzzyMatch(s, r.nombre)
                if (score > bestScore) { bestScore = score; bestSlug = s }
            }
            if (bestScore >= 0.5) bestFiles = porSlug[bestSlug] || []
        }
        bestFiles.sort((a, b) => PRIORIDAD.indexOf(a.metodo) - PRIORIDAD.indexOf(b.metodo))
        const mejor = bestFiles.length > 0 ? bestFiles[0] : null

        if (mejor && mejor.metodo === 'flux_txt2img') {
            pendientes.push({ receta: r, fluxFile: mejor.archivo, fluxSlug: bestSlug })
        }
    }

    const coste = (pendientes.length * 0.034).toFixed(2)
    console.log('========================================')
    console.log('  REFINAR FLUX_TXT2IMG -> AI_GEN (GPT-4o image edit)')
    console.log('========================================')
    console.log('Recetas a refinar: ' + pendientes.length)
    console.log('Coste estimado: ~$' + coste + ' (medium $0.034/img edit)')
    console.log('Metodo: image edit desde flux_txt2img existente -> mas natural\n')

    pendientes.forEach((r, i) => {
        console.log('  ' + String(i + 1).padStart(2) + '. ' + r.receta.nombre + ' (base: ' + r.fluxFile + ')')
    })

    if (!GENERA) {
        console.log('\nPREVIEW - anade --genera para ejecutar')
        return
    }

    const lista = PRUEBA ? pendientes.slice(0, 2) : pendientes

    console.log('\nRefinando con image edit (desde flux_txt2img -> foto real)...\n')
    let ok = 0, errores = 0

    for (let i = 0; i < lista.length; i++) {
        const { receta, fluxFile } = lista[i]
        const slug = nombreToSlug(receta.nombre)
        const outName = 'ai_gen--' + slug + '.jpg'
        const outPath = join(SALIDA_DIR, outName)
        const fluxPath = join(SALIDA_DIR, fluxFile)

        process.stdout.write('[' + (i + 1) + '/' + lista.length + '] ' + receta.nombre + ' ... ')

        if (existsSync(outPath)) {
            console.log('ya existe')
            ok++
            continue
        }

        if (!existsSync(fluxPath)) {
            console.log('no se encuentra flux_txt2img base')
            errores++
            continue
        }

        try {
            const inputBuffer = readFileSync(fluxPath)
            const prompt = buildPromptEdit(receta.nombre)
            const outputBuffer = await gptImageEdit(inputBuffer, prompt, fluxFile)
            writeFileSync(outPath, outputBuffer)
            console.log('' + (outputBuffer.length / 1024).toFixed(0) + 'KB')
            ok++
        } catch (err) {
            console.log(err.message)
            errores++
        }

        if (i < lista.length - 1) await new Promise(r => setTimeout(r, 2000))
    }

    console.log('\n')
    console.log('  Generadas: ' + ok)
    console.log('  Errores: ' + errores)
    console.log('  Coste real: ~$' + (ok * 0.034).toFixed(2))
    console.log('')
    console.log('  -> Revisar: salidas/revision-imagenes/ai_gen--*.jpg')
    console.log('  -> Subir: node scripts/subir-imagenes-aprobadas.mjs\n')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

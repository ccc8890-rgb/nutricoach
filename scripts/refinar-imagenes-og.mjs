/**
 * refinar-imagenes-og.mjs
 *
 * Usa GPT-4o imagen (gpt-image-1) para refinar las fotos reales de Instagram/TikTok:
 *   - Elimina texto, watermarks y títulos superpuestos
 *   - Elimina personas y manos, deja solo el plato
 *   - Homogeniza el estilo: misma cocina mediterránea, misma luz, mismo ambiente
 *
 * El resultado es flux_img2img--*.webp (nombre legacy, máxima prioridad en el uploader).
 *
 * USO:
 *   node scripts/refinar-imagenes-og.mjs                    → lote de prueba (5 imágenes)
 *   node scripts/refinar-imagenes-og.mjs --todas            → todas las og_images
 *   node scripts/refinar-imagenes-og.mjs --slug "kebaprol"  → solo esa receta
 *
 * DESPUÉS:
 *   node scripts/subir-imagenes-aprobadas.mjs               → sube refinadas a Supabase
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')

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

const OPENAI_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_KEY) {
    console.error('❌ OPENAI_API_KEY no configurada en .env.local')
    console.error('   Añade: OPENAI_API_KEY=sk-...')
    process.exit(1)
}

// ──────────────────────────────────────────────
// Prompt homogeneizador — misma instrucción para todas
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// GPT-4o imagen — image edit
// ──────────────────────────────────────────────
async function gptImageEdit(imageBuffer, prompt, filename) {
    // FormData nativo de Node.js 18+ — compatible con fetch nativo
    const form = new FormData()
    const blob = new Blob([imageBuffer], { type: 'image/webp' })
    form.append('image', blob, filename.replace('.webp', '.png'))
    form.append('model', 'gpt-image-1.5')       // 09-05-2026: actualizado desde gpt-image-1
    form.append('prompt', prompt)
    form.append('n', '1')
    form.append('size', '1024x1024')
    form.append('quality', 'medium')            // low=$0.009 | medium=$0.034 | high=$0.133
    form.append('input_fidelity', 'high')       // preserva composición y colores originales

    const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        // NO Content-Type manual — fetch lo pone solo con el boundary correcto
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
    // gpt-image-1 devuelve b64_json o url según response_format
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')

    const url = data.data?.[0]?.url
    if (url) {
        const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) })
        return Buffer.from(await imgRes.arrayBuffer())
    }

    throw new Error('Respuesta vacía de OpenAI imagen')
}

function slugToNombre(slug) {
    return slug
        .replace(/^og_image--/, '')
        .replace(/\.webp$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
    const args = process.argv.slice(2)
    const todasMode = args.includes('--todas')
    const slugIdx = args.indexOf('--slug')
    const slugFiltro = slugIdx !== -1 ? args[slugIdx + 1] : null

    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

    const todosOgFiles = readdirSync(SALIDA_DIR)
        .filter(f => f.startsWith('og_image--') && f.endsWith('.webp'))

    if (todosOgFiles.length === 0) {
        console.log('❌ No hay imágenes og_image en salidas/revision-imagenes/')
        return
    }

    let archivos
    if (slugFiltro) {
        archivos = todosOgFiles.filter(f => f.includes(slugFiltro))
        if (archivos.length === 0) {
            console.error(`❌ No se encontró og_image con slug "${slugFiltro}"`)
            return
        }
    } else if (todasMode) {
        archivos = todosOgFiles
    } else {
        // Lote de prueba: 5 imágenes representativas (variedad de casos)
        const prueba = [
            'og_image--brownie-de-avellana.webp',                        // texto grande + mano
            'og_image--smashed-burger-tacos.webp',                       // texto con kcal
            'og_image--cookie-skillet-de-proteínas-individual.webp',     // texto inferior
            'og_image--bowl-de-carne-y-verduras.webp',                   // mano vertiendo
            'og_image--ensalada-de-pollo-con-yogur-y-queso-feta.webp',   // foto limpia
        ]
        archivos = prueba.filter(f => todosOgFiles.includes(f))
        if (archivos.length === 0) archivos = todosOgFiles.slice(0, 5)
    }

    const costeEstimado = (archivos.length * 0.034).toFixed(2)
    console.log(`\n🎨 gpt-image-1.5 — refinando ${archivos.length} fotos`)
    console.log(`   Coste estimado: ~$${costeEstimado} (gpt-image-1.5 medium $0.034/img)`)
    console.log(`   Salida: flux_img2img--*.webp\n`)

    let ok = 0, errores = 0

    for (let i = 0; i < archivos.length; i++) {
        const filename = archivos[i]
        const nombre = slugToNombre(filename)
        const outputFilename = filename.replace('og_image--', 'flux_img2img--')

        console.log(`[${i + 1}/${archivos.length}] ${nombre}`)

        // Saltar si ya existe la versión refinada
        if (existsSync(join(SALIDA_DIR, outputFilename))) {
            console.log(`   ⏭️  Ya refinada, saltando\n`)
            ok++
            continue
        }

        try {
            const inputBuffer = readFileSync(join(SALIDA_DIR, filename))
            const prompt = buildPrompt(nombre)

            console.log(`   🤖 GPT-4o imagen editando...`)
            const outputBuffer = await gptImageEdit(inputBuffer, prompt, filename)

            writeFileSync(join(SALIDA_DIR, outputFilename), outputBuffer)
            console.log(`   ✅ ${outputFilename} (${(outputBuffer.length / 1024).toFixed(0)}KB)\n`)
            ok++
        } catch (err) {
            console.error(`   ❌ ${err.message}\n`)
            errores++
        }

        if (i < archivos.length - 1) {
            await new Promise(r => setTimeout(r, 3000))
        }
    }

    console.log(`═══════════════════════════`)
    console.log(`  ✅ Refinadas:  ${ok}`)
    console.log(`  ❌ Errores:    ${errores}`)
    console.log(`  💰 Coste real: ~$${(ok * 0.034).toFixed(2)}`)
    console.log(`\n  ➡️  Siguiente: node scripts/subir-imagenes-aprobadas.mjs\n`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

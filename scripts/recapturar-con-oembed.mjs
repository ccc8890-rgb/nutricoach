/**
 * recapturar-con-oembed.mjs
 *
 * Reemplaza las screenshots de Instagram (22-37KB) por thumbnails reales
 * obtenidos vía Instagram oEmbed API, luego re-refina con GPT-4o.
 *
 * USO: node scripts/recapturar-con-oembed.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
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
        process.env[k] = v
    }
}
loadEnv()

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
const OPENAI_KEY = process.env.OPENAI_API_KEY

// ── Obtener thumbnail real de Instagram via oEmbed ──
async function getInstagramThumbnail(url) {
    try {
        const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&format=json`
        const res = await fetch(oembedUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) {
            console.log(`     ❌ oEmbed ${res.status}`)
            return null
        }
        const data = await res.json()
        const thumbnailUrl = data.thumbnail_url
        if (!thumbnailUrl) {
            console.log(`     ❌ Sin thumbnail_url en respuesta oEmbed`)
            return null
        }
        console.log(`     🔗 Thumbnail URL: ${thumbnailUrl.substring(0, 80)}`)

        // Descargar el thumbnail
        const imgRes = await fetch(thumbnailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
            },
            signal: AbortSignal.timeout(15000),
        })
        if (!imgRes.ok) {
            console.log(`     ❌ No se pudo descargar thumbnail: ${imgRes.status}`)
            return null
        }
        const buf = Buffer.from(await imgRes.arrayBuffer())
        if (buf.length < 5000) {
            console.log(`     ❌ Thumbnail demasiado pequeño: ${buf.length} bytes`)
            return null
        }
        console.log(`     ✅ Descargado: ${(buf.length / 1024).toFixed(0)}KB`)
        return buf
    } catch (err) {
        console.log(`     ❌ Error: ${err.message}`)
        return null
    }
}

// ── Prompt GPT-4o (mismo que Claude) ──
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
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' })
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

// ── Recetas a re-capturar ──
const RECETAS = [
    { nombre: 'Café con leche y aceite', slug: 'café-con-leche-y-aceite', url: 'https://www.instagram.com/reel/DXvfW77vYup/' },
    { nombre: 'Ensalada crujiente con aderezo cremoso de sésamo y jengibre', slug: 'ensalada-crujiente-con-aderezo-cremoso-de-sésamo-y-jengibre', url: 'https://www.instagram.com/reel/DYDjWXnxhed/' },
    { nombre: 'Ensalada de brócoli asado con aderezo de miso césar', slug: 'ensalada-de-brócoli-asado-con-aderezo-de-miso-césar', url: 'https://www.instagram.com/reel/DXmYoAljy9c/' },
    { nombre: 'Pan de ajo relleno de queso', slug: 'pan-de-ajo-relleno-de-queso', url: 'https://www.instagram.com/reel/DXpIyZHjRJb/' },
    { nombre: 'Pan relleno de carne y queso al horno', slug: 'pan-relleno-de-carne-y-queso-al-horno', url: 'https://www.instagram.com/reel/DYC3gVZtVfv/' },
    { nombre: 'Pollo frito coreano', slug: 'pollo-frito-coreano', url: 'https://www.instagram.com/reel/DXVUqxzjgB2/' },
    { nombre: 'Pollo marinado con yogur y limón', slug: 'pollo-marinado-con-yogur-y-limón', url: 'https://www.instagram.com/reel/DYNVyw8obog/' },
    { nombre: 'Receta sin título', slug: 'receta-sin-título', url: 'https://www.instagram.com/reel/DWvyfkPM3V3/' },
    { nombre: 'Salsa Deluxe Fit', slug: 'salsa-deluxe-fit', url: 'https://www.instagram.com/reel/DXyrt0iM7ZX/' },
    { nombre: 'Sándwich de pavo con salsa de yogur y ensalada', slug: 'sándwich-de-pavo-con-salsa-de-yogur-y-ensalada', url: 'https://www.instagram.com/reel/DXlzuNagn8X/' },
    { nombre: 'Smash Burger Kebab en Tortilla', slug: 'smash-burger-kebab-en-tortilla', url: 'https://www.instagram.com/reel/DU9WsZgkW3g/' },
    { nombre: 'Tartar de solomillo con boquerones y piparra', slug: 'tartar-de-solomillo-con-boquerones-y-piparra', url: 'https://www.instagram.com/reel/DXvu1u-ttiY/' },
]

async function main() {
    if (!OPENAI_KEY) {
        console.error('❌ OPENAI_API_KEY no configurada')
        process.exit(1)
    }

    console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 Re-captura con Instagram oEmbed                     ║
║  Reemplaza screenshots por thumbnails reales             ║
║  + Re-refinado con GPT-4o                               ║
╚══════════════════════════════════════════════════════════╝
`)

    let recapturadas = 0
    let refinadas = 0
    let errores = 0

    for (let i = 0; i < RECETAS.length; i++) {
        const r = RECETAS[i]
        const ogFilename = `og_image--${r.slug}.webp`
        const fluxFilename = `flux_img2img--${r.slug}.webp`
        const ogPath = join(SALIDA_DIR, ogFilename)
        const fluxPath = join(SALIDA_DIR, fluxFilename)

        console.log(`\n[${i + 1}/${RECETAS.length}] ${r.nombre}`)
        console.log(`     🔗 ${r.url}`)

        // ── FASE 1: Obtener thumbnail real via oEmbed ──
        console.log(`     📱 Instagram oEmbed...`)
        const thumbnail = await getInstagramThumbnail(r.url)

        if (!thumbnail) {
            console.log(`     ❌ No se pudo obtener thumbnail, se queda la screenshot`)
            errores++
            continue
        }

        // Guardar como og_image (sobrescribe screenshot mala)
        writeFileSync(ogPath, thumbnail)
        console.log(`     💾 og_image sobrescrita: ${ogFilename}`)
        recapturadas++

        // ── FASE 2: Re-refinar con GPT-4o ──
        console.log(`     🎨 GPT-4o re-refinando...`)
        try {
            const prompt = buildPrompt(r.nombre)
            const refined = await gptImageEdit(thumbnail, prompt, ogFilename)
            writeFileSync(fluxPath, refined)
            console.log(`     ✅ Re-refinada: ${fluxFilename} (${(refined.length / 1024).toFixed(0)}KB)`)
            refinadas++
        } catch (err) {
            console.error(`     ❌ Error refinado: ${err.message}`)
            errores++
        }

        if (i < RECETAS.length - 1) {
            await new Promise(r => setTimeout(r, 3000))
        }
    }

    console.log(`\n${'═'.repeat(55)}`)
    console.log(`  RESUMEN`)
    console.log(`${'═'.repeat(55)}`)
    console.log(`  📸 Re-capturadas: ${recapturadas}/${RECETAS.length}`)
    console.log(`  🎨 Re-refinadas:  ${refinadas}/${RECETAS.length}`)
    console.log(`  ❌ Errores:       ${errores}`)
    console.log(`  💰 Coste GPT-4o: ~$${(refinadas * 0.034).toFixed(2)}`)
    console.log(`\n  ➡️  Para subir: node scripts/subir-imagenes-aprobadas.mjs\n`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

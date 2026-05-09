/**
 * subir-imagenes-aprobadas.mjs
 *
 * Sube automáticamente todas las imágenes generadas en disco a Supabase Storage
 * y actualiza imagen_url en la tabla recetas.
 *
 * Elige la mejor imagen por receta según orden de prioridad:
 *   agent_browser > flux_img2img > flux_txt2img
 *
 * USO:
 *   node scripts/subir-imagenes-aprobadas.mjs
 *   node scripts/subir-imagenes-aprobadas.mjs --dry-run  → solo muestra qué haría
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'fs'
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'recetas'

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados en .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const DRY_RUN = process.argv.includes('--dry-run')
const FORZAR = process.argv.includes('--forzar')

// Prioridad de métodos: cuanto menor índice, mejor
const PRIORIDAD = ['flux_img2img', 'og_image', 'agent_browser', 'playwright', 'bing_images', 'flux_txt2img']

function priIdx(metodo) {
    const i = PRIORIDAD.indexOf(metodo)
    return i === -1 ? 999 : i
}

async function main() {
    if (!existsSync(SALIDA_DIR)) {
        console.error(`❌ No existe ${SALIDA_DIR}. Ejecuta primero el script de imágenes.`)
        process.exit(1)
    }

    const files = readdirSync(SALIDA_DIR).filter(f => f.endsWith('.webp'))
    if (files.length === 0) {
        console.log('❌ No hay imágenes en el directorio de salida')
        return
    }

    console.log(`\n📦 ${files.length} imágenes en disco`)
    if (DRY_RUN) console.log('   (modo dry-run — no se subirá nada)\n')

    // Agrupar por receta: { slug → [{ metodo, filename }] }
    const grupos = {}
    for (const f of files) {
        const match = f.match(/^([a-z0-9_]+)--(.+)\.webp$/)
        if (!match) continue
        const [, metodo, slug] = match
        if (!grupos[slug]) grupos[slug] = []
        grupos[slug].push({ metodo, filename: f })
    }

    // Por cada slug, ordenar por prioridad y quedarse con la mejor
    const mejores = Object.entries(grupos).map(([slug, imgs]) => {
        imgs.sort((a, b) => priIdx(a.metodo) - priIdx(b.metodo))
        return { slug, mejor: imgs[0] }
    })

    console.log(`📊 ${mejores.length} recetas únicas detectadas\n`)

    let subidas = 0
    let errores = 0
    let saltadas = 0

    for (const { slug, mejor } of mejores) {
        const nombreBuscar = slug.replace(/-/g, ' ')

        // Buscar receta en BD por nombre aproximado
        const { data: recetas } = await supabase
            .from('recetas')
            .select('id, nombre, imagen_url')
            .ilike('nombre', `%${nombreBuscar.slice(0, 20)}%`)
            .limit(3)

        if (!recetas || recetas.length === 0) {
            console.log(`  ⚠️  Sin match en BD: ${slug}`)
            saltadas++
            continue
        }

        // Tomar la receta sin imagen, o la primera si todas tienen
        const receta = recetas.find(r => !r.imagen_url) || recetas[0]

        if (receta.imagen_url && !DRY_RUN && !FORZAR) {
            console.log(`  ⏭️  Ya tiene imagen: ${receta.nombre}`)
            saltadas++
            continue
        }

        const filePath = join(SALIDA_DIR, mejor.filename)
        const buffer = readFileSync(filePath)
        const storagePath = `${receta.id}/auto_${Date.now()}.webp`

        console.log(`  📤 ${receta.nombre} (${mejor.metodo}) → ${storagePath}`)

        if (DRY_RUN) {
            subidas++
            continue
        }

        // Subir a Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, buffer, { contentType: 'image/webp', upsert: true })

        if (uploadError) {
            console.error(`     ❌ Upload error: ${uploadError.message}`)
            errores++
            continue
        }

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)

        // Actualizar receta
        const { error: updateError } = await supabase
            .from('recetas')
            .update({ imagen_url: publicUrl })
            .eq('id', receta.id)

        if (updateError) {
            console.error(`     ❌ Update error: ${updateError.message}`)
            errores++
        } else {
            console.log(`     ✅ Subida y actualizada`)
            subidas++
        }

        // Pequeña pausa para no saturar
        await new Promise(r => setTimeout(r, 200))
    }

    console.log(`\n═══════════════════════════`)
    console.log(`  ✅ Subidas:  ${subidas}`)
    console.log(`  ⏭️  Saltadas: ${saltadas}`)
    console.log(`  ❌ Errores:  ${errores}`)
    if (DRY_RUN) console.log(`\n  (dry-run: nada se subió realmente)`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

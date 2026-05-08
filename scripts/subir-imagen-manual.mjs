i/**
 * subir-imagen-manual.mjs — Subir una imagen local a una receta
 *
 * Sirve para cuando tengas una captura de pantalla o foto de la receta original
 * y quieras subirla directamente a Supabase Storage sin usar IA.
 *
 * USO:
 *   node scripts/subir-imagen-manual.mjs <ruta_imagen> <id_receta>
 *
 * EJEMPLO:
 *   node scripts/subir-imagen-manual.mjs ~/Desktop/brownie.jpg 123
 *
 * También puedes buscar receta por nombre:
 *   node scripts/subir-imagen-manual.mjs ~/Desktop/brownie.jpg "Brownie"
 *
 * OPCIONES:
 *   --list             Lista recetas sin imagen por si no sabes el ID
 *   --search <texto>   Buscar recetas por nombre
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar .env.local
function loadEnv() {
    const envPath = resolve(__dirname, '..', '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim()
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function listarSinImagen() {
    const { data, error } = await supabase
        .from('recetas')
        .select('id, nombre')
        .is('imagen_url', null)
        .eq('estado', 'aprobada')
        .order('nombre')

    if (error) throw error
    console.log(`\n📋 Recetas sin imagen (${data.length}):\n`)
    data.forEach(r => console.log(`   [${r.id}] ${r.nombre}`))
    console.log('')
}

async function buscar(texto) {
    const { data, error } = await supabase
        .from('recetas')
        .select('id, nombre, imagen_url, estado')
        .ilike('nombre', `%${texto}%`)
        .limit(10)

    if (error) throw error
    console.log(`\n🔍 Resultados para "${texto}":\n`)
    data.forEach(r => {
        const estado = r.imagen_url ? '✅ con imagen' : '❌ sin imagen'
        console.log(`   [${r.id}] ${r.nombre} — ${estado}`)
    })
    console.log('')
}

async function subir(imagenPath, recetaIdONombre) {
    // Resolver si es ID o nombre
    let recetaId = parseInt(recetaIdONombre)
    let receta

    if (isNaN(recetaId)) {
        // Buscar por nombre
        const { data, error } = await supabase
            .from('recetas')
            .select('id, nombre')
            .ilike('nombre', `%${recetaIdONombre}%`)
            .limit(1)

        if (error) throw error
        if (!data || data.length === 0) {
            console.error(`❌ No se encontró receta con nombre "${recetaIdONombre}"`)
            console.error('   Usa --search para buscar o --list para ver todas')
            process.exit(1)
        }
        receta = data[0]
        recetaId = receta.id
    } else {
        const { data, error } = await supabase
            .from('recetas')
            .select('id, nombre')
            .eq('id', recetaId)
            .single()

        if (error) {
            console.error(`❌ No se encontró receta con ID ${recetaId}`)
            process.exit(1)
        }
        receta = data
    }

    // Leer imagen local
    const fullPath = resolve(imagenPath.replace(/^~/, process.env.HOME || '/Users/carloscasanova'))
    if (!existsSync(fullPath)) {
        console.error(`❌ No se encuentra el archivo: ${fullPath}`)
        process.exit(1)
    }

    const buffer = readFileSync(fullPath)
    const ext = basename(fullPath).split('.').pop()?.toLowerCase() || 'jpg'
    const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
    const contentType = mimeMap[ext] || 'image/jpeg'

    // Sanitizar nombre
    const safeName = receta.nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 80)

    const fileName = `manual/${safeName}-${Date.now()}.${ext}`

    console.log(`\n📤 Subiendo imagen a receta [${recetaId}] "${receta.nombre}"...`)
    console.log(`   Archivo: ${fullPath} (${(buffer.length / 1024).toFixed(0)} KB)`)

    // Subir a Storage
    let result = await supabase.storage.from('recetas').upload(fileName, buffer, {
        contentType, upsert: true,
    })

    if (result.error?.message?.includes('bucket')) {
        await supabase.storage.createBucket('recetas', { public: true })
        result = await supabase.storage.from('recetas').upload(fileName, buffer, {
            contentType, upsert: true,
        })
    }

    if (result.error) {
        console.error(`❌ Error de storage: ${result.error.message}`)
        process.exit(1)
    }

    const { data: pub } = supabase.storage.from('recetas').getPublicUrl(fileName)
    const publicUrl = pub.publicUrl

    // Actualizar BD
    const { error: updateError } = await supabase
        .from('recetas')
        .update({ imagen_url: publicUrl })
        .eq('id', recetaId)

    if (updateError) {
        console.error(`❌ Error actualizando BD: ${updateError.message}`)
        process.exit(1)
    }

    console.log(`   ✅ Imagen subida y vinculada`)
    console.log(`   🔗 URL: ${publicUrl}`)
    console.log(`   🌐 Abre http://localhost:3008/recetas/${recetaId} para verlo`)
}

// ── CLI ───────────────────────────────────────────────
const args = process.argv.slice(2)

if (args.includes('--list')) {
    listarSinImagen().catch(err => { console.error(err); process.exit(1) })
} else if (args.includes('--search')) {
    const idx = args.indexOf('--search')
    const texto = args[idx + 1]
    if (!texto) { console.error('❌ Usa: --search <texto>'); process.exit(1) }
    buscar(texto).catch(err => { console.error(err); process.exit(1) })
} else if (args.length >= 2) {
    subir(args[0], args[1]).catch(err => { console.error(err); process.exit(1) })
} else {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  SUBIR IMAGEN MANUAL A RECETA                           ║
╠══════════════════════════════════════════════════════════╣
║                                                        ║
║  Para subir una imagen (captura de pantalla, foto,     ║
║  descarga de Instagram, etc.) a una receta:            ║
║                                                        ║
║    node scripts/subir-imagen-manual.mjs <ruta> <id>    ║
║                                                        ║
║  Ejemplo con ID:                                       ║
║    node scripts/subir-imagen-manual.mjs                ║
║      ~/Desktop/brownie.jpg 42                          ║
║                                                        ║
║  Ejemplo con nombre:                                   ║
║    node scripts/subir-imagen-manual.mjs                ║
║      ~/Desktop/brownie.jpg "Brownie"                   ║
║                                                        ║
║  OPCIONES:                                             ║
║    --list         Ver recetas sin imagen               ║
║    --search <txt> Buscar recetas por nombre            ║
║                                                        ║
╚══════════════════════════════════════════════════════════╝
`)
}

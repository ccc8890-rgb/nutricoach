/**
 * subir-imagenes-pendientes.mjs
 *
 * Sube las imágenes del directorio salidas/revision-imagenes/ a Supabase Storage
 * y actualiza las recetas correspondientes con la URL pública.
 *
 * Uso: node scripts/subir-imagenes-pendientes.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
const envPath = resolve(RAÍZ, '.env.local')
if (existsSync(envPath)) {
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')

function safeName(nombre) {
    return nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
}

function sanitizeKey(name) {
    // Normalizar (quitar acentos) y dejar solo ASCII seguro para Storage
    return name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9\/._-]/g, '-')
        .replace(/-+/g, '-')
        .toLowerCase()
}

async function subirImagen(filePath, fileName) {
    const buffer = readFileSync(filePath)
    const storageKey = sanitizeKey(`recetas/${fileName}`)

    // Subir a Storage
    let result = await supabase.storage
        .from('recetas')
        .upload(storageKey, buffer, {
            contentType: 'image/webp',
            upsert: true,
        })

    // Crear bucket si no existe
    if (result.error?.message?.includes('not found')) {
        console.log('   Creando bucket recetas...')
        await supabase.storage.createBucket('recetas', { public: true })
        result = await supabase.storage
            .from('recetas')
            .upload(storageKey, buffer, {
                contentType: 'image/webp',
                upsert: true,
            })
    }

    if (result.error) {
        console.error(`   ❌ Error subiendo: ${result.error.message}`)
        return null
    }

    const { data: pub } = supabase.storage
        .from('recetas')
        .getPublicUrl(storageKey)

    return pub.publicUrl
}

async function main() {
    console.log(`
╔══════════════════════════════════════════════╗
║  SUBIR IMÁGENES PENDIENTES A SUPABASE        ║
║  salidas/revision-imagenes/ → Storage        ║
╚══════════════════════════════════════════════╝
`)

    if (!existsSync(SALIDA_DIR)) {
        console.log('  ❌ No existe el directorio de salida')
        return
    }

    const files = readdirSync(SALIDA_DIR).filter(f => f.endsWith('.webp'))
    if (files.length === 0) {
        console.log('  ❌ No hay imágenes webp en el directorio')
        return
    }

    console.log(`  📊 ${files.length} imágenes encontradas\n`)

    let subidas = 0
    let errores = 0

    for (const f of files) {
        const match = f.match(/^(\w+)--(.+)\.webp$/)
        if (!match) continue
        const [, metodo, nombreSlug] = match

        // Reconstruir nombre de receta desde el slug
        const nombreBuscado = nombreSlug.replace(/-/g, ' ')

        console.log(`  📝 ${f}`)
        console.log(`     Buscando receta: "${nombreBuscado}"...`)

        // Buscar la receta en Supabase — primero intento exacto, luego parcial
        let receta = null

        // Intentar búsqueda exacta
        const { data: exactas } = await supabase
            .from('recetas')
            .select('id, nombre, imagen_url')
            .is('imagen_url', null)
            .eq('estado', 'aprobada')
            .ilike('nombre', nombreBuscado)
            .limit(1)

        if (exactas && exactas.length > 0) {
            receta = exactas[0]
        }

        if (!receta) {
            // Búsqueda por palabras clave
            const palabras = nombreBuscado.split(' ').filter(w => w.length > 2)
            let query = supabase
                .from('recetas')
                .select('id, nombre, imagen_url')
                .is('imagen_url', null)
                .eq('estado', 'aprobada')

            for (const p of palabras) {
                query = query.ilike('nombre', `%${p}%`)
            }

            const { data: parciales } = await query.limit(1)
            if (parciales && parciales.length > 0) {
                receta = parciales[0]
            }
        }

        if (!receta) {
            console.log(`     ⚠️  No se encontró receta sin imagen para: ${nombreBuscado}`)
            continue
        }

        console.log(`     ✅ Receta encontrada: "${receta.nombre}" (${receta.id})`)

        // Subir imagen
        const filePath = join(SALIDA_DIR, f)
        const storageName = `${metodo}/${safeName(receta.nombre)}-${Date.now()}.webp`
        const publicUrl = await subirImagen(filePath, storageName)

        if (!publicUrl) {
            errores++
            continue
        }

        // Actualizar la receta
        const { error: updateError } = await supabase
            .from('recetas')
            .update({
                imagen_url: publicUrl,
                updated_at: new Date().toISOString(),
            })
            .eq('id', receta.id)

        if (updateError) {
            console.error(`     ❌ Error actualizando BD: ${updateError.message}`)
            errores++
        } else {
            console.log(`     ✅ Imagen URL: ${publicUrl}`)
            subidas++
        }
    }

    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  ✅ ${subidas} imágenes subidas correctamente`)
    if (errores > 0) console.log(`  ❌ ${errores} errores`)
    console.log(`═══════════════════════════════════════════`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

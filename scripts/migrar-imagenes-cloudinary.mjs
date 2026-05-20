import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// Cargar .env.local
const envPath = resolve(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const DRY_RUN = process.argv.includes('--dry-run')
const LIMITE = (() => {
  const idx = process.argv.indexOf('--limite')
  return idx !== -1 ? parseInt(process.argv[idx + 1]) : 9999
})()

async function descargarImagen(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

async function subirACloudinary(buffer, recetaId) {
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

// Obtener recetas con imagen en Supabase Storage (contienen 'supabase' en la URL)
const { data: recetas, error } = await supabase
  .from('recetas')
  .select('id, nombre, imagen_url')
  .not('imagen_url', 'is', null)
  .ilike('imagen_url', '%supabase%')
  .limit(LIMITE)

if (error) { console.error('Error BD:', error.message); process.exit(1) }

console.log()
if (DRY_RUN) console.log('🔍 MODO DRY RUN — no se sube nada ni se actualiza la BD\n')

let ok = 0, errores = 0, saltadas = 0

for (let i = 0; i < recetas.length; i++) {
  const r = recetas[i]
  const num = i + 1

  // Si ya está en Cloudinary, saltar
  if (r.imagen_url?.includes('cloudinary')) {
    console.log(`[${num}/${recetas.length}] ${r.nombre} ⏭️ ya en Cloudinary`)
    saltadas++
    continue
  }

  if (DRY_RUN) {
    console.log(`[${num}/${recetas.length}] ${r.nombre} 🔍 se migraría`)
    continue
  }

  // Descargar imagen de Supabase
  const buffer = await descargarImagen(r.imagen_url)
  if (!buffer) {
    console.log(`[${num}/${recetas.length}] ${r.nombre} ❌ no se pudo descargar`)
    errores++
    continue
  }

  // Subir a Cloudinary
  try {
    const cloudUrl = await subirACloudinary(buffer, r.id)

    // Actualizar BD
    const { error: updErr } = await supabase
      .from('recetas')
      .update({ imagen_url: cloudUrl })
      .eq('id', r.id)

    if (updErr) throw new Error(updErr.message)

    console.log(`[${num}/${recetas.length}] ${r.nombre} ✅ migrada`)
    ok++
  } catch (err) {
    console.log(`[${num}/${recetas.length}] ${r.nombre} ❌ ${err.message}`)
    errores++
  }

  // Pausa anti rate-limit
  await new Promise(r => setTimeout(r, 200))
}

console.log('\n' + '='.repeat(50))
console.log(`✅ Migradas: ${ok}`)
console.log(`❌ Errores: ${errores}`)
console.log(`⏭️  Saltadas: ${saltadas}`)
if (!DRY_RUN && ok > 0) {
  console.log('\n🎉 Migración completada.')
  console.log('Siguiente paso: borrar bucket recetas en Supabase Storage Dashboard')
}

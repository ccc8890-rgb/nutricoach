/**
 * borrar-bucket-supabase.mjs
 * Vacía y elimina el bucket 'recetas' de Supabase Storage.
 * Las imágenes ya están en Cloudinary — este bucket ya no se necesita.
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Cargar .env.local
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && !key.startsWith('#')) process.env[key.trim()] = rest.join('=').trim()
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET       = 'recetas'

const headers = {
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY,
}

async function listarArchivos(prefix = '') {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  })
  if (!res.ok) throw new Error(`list ${res.status}: ${await res.text()}`)
  return await res.json()
}

async function borrarArchivos(paths) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ prefixes: paths }),
  })
  if (!res.ok) throw new Error(`delete ${res.status}: ${await res.text()}`)
  return await res.json()
}

async function borrarBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error(`delete bucket ${res.status}: ${await res.text()}`)
  return await res.json()
}

async function recopilarTodosLosArchivos(prefix = '') {
  const items = await listarArchivos(prefix)
  if (!items || items.length === 0) return []

  const archivos = []
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null) {
      // Es una carpeta — listar recursivamente
      const sub = await recopilarTodosLosArchivos(fullPath)
      archivos.push(...sub)
    } else {
      archivos.push(fullPath)
    }
  }
  return archivos
}

async function main() {
  console.log(`\n🗑️  Vaciando bucket '${BUCKET}' en Supabase Storage...\n`)

  let totalBorrados = 0

  // Recopilar todos los archivos (recursivo)
  const todos = await recopilarTodosLosArchivos('')
  console.log(`Total archivos encontrados: ${todos.length}`)

  // Borrar en lotes de 100
  for (let i = 0; i < todos.length; i += 100) {
    const lote = todos.slice(i, i + 100)
    await borrarArchivos(lote)
    totalBorrados += lote.length
    console.log(`  ✅ ${totalBorrados}/${todos.length} borrados`)
  }

  console.log(`\n🗑️  Eliminando bucket '${BUCKET}'...`)
  const result = await borrarBucket()
  console.log('✅ Bucket eliminado:', result.message ?? JSON.stringify(result))
  console.log(`\n🎉 Listo. ${totalBorrados} archivos eliminados de Supabase Storage.`)
  console.log('   El egress de Supabase ya no acumulará cargos por imágenes.\n')
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})

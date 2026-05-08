import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local manualmente ──
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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { data, count, error } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, estado', { count: 'exact' })

if (error) { console.error(error); process.exit(1) }

const conImagen = data.filter(r => r.imagen_url).length
const sinImagen = data.filter(r => !r.imagen_url).length
const aprobadas = data.filter(r => r.estado === 'aprobada').length
const sinUrl = data.filter(r => !r.imagen_url)

console.log(JSON.stringify({ total: count, conImagen, sinImagen, aprobadas }, null, 2))
console.log('\n--- Sin imagen (' + sinUrl.length + ') ---')
sinUrl.forEach(r => console.log(r.id + ': ' + r.nombre))

/**
 * Auditoría completa: ¿el nombre de la receta menciona al menos alguno de
 * sus ingredientes reales? Usa `nombre_libre` (el texto que introdujo quien
 * creó la receta / el esqueleto determinista) como verdad, NO el `alimento`
 * vinculado (que tiene su propio bug de auto-match ya documentado aparte).
 *
 * Root cause confirmado (30-09-2026): el generador por esqueletos
 * (scripts/generar-recetas-desde-esqueletos.ts) pide a DeepSeek que escriba
 * nombre/descripción libremente a partir de la lista de ingredientes, con
 * "variación N — usa una preparación diferente" — en la práctica DeepSeek
 * a veces cambia también la PROTEÍNA/PLATO entero (ej. nombra "Salmón al
 * horno" a una receta cuyos ingredientes reales son pechuga de pollo).
 *
 * Uso:
 *   node scripts/audit-nombre-vs-ingredientes-v2.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
  const p = resolve(ROOT, '.env.local')
  for (const line of readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const STOP = new Set([
  'fresco', 'fresca', 'frescas', 'frescos', 'crudo', 'cruda', 'picado', 'picada',
  'asado', 'asada', 'cocido', 'cocida', 'natural', 'entero', 'entera', 'blanco',
  'blanca', 'integral', 'verde', 'verdes', 'polvo', 'virgen', 'extra', 'maduro',
  'madura', 'virgenextra', 'molido', 'molida', 'seco', 'seca', 'liquido', 'liquida',
])
function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim()
}
function palabras(s) {
  return norm(s).split(/\s+/).filter(w => w.length > 3 && !STOP.has(w))
}

async function main() {
  const todas = []
  let page = 0
  while (true) {
    const { data, error } = await sb.from('recetas').select('id, nombre').eq('estado', 'aprobada').range(page * 200, page * 200 + 199)
    if (error) { console.error(error.message); break }
    if (!data || data.length === 0) break
    todas.push(...data)
    page++
  }
  console.log(`Recetas aprobadas totales: ${todas.length}\n`)

  const sospechosas = []
  for (const r of todas) {
    const { data: ings } = await sb.from('receta_ingredientes').select('nombre_libre, cantidad_gramos').eq('receta_id', r.id)
    if (!ings || ings.length === 0) continue
    const nombreN = norm(r.nombre)
    const ingredientesTexto = ings.map(i => i.nombre_libre).filter(Boolean)
    if (ingredientesTexto.length === 0) continue

    let coincide = false
    for (const texto of ingredientesTexto) {
      if (palabras(texto).some(w => nombreN.includes(w))) { coincide = true; break }
    }
    if (!coincide) {
      sospechosas.push({ id: r.id, nombre: r.nombre, ingredientes: ingredientesTexto })
    }
  }

  console.log(`Sospechosas (ningún ingrediente real mencionado en el nombre): ${sospechosas.length}\n`)
  for (const s of sospechosas) console.log(`- ${s.nombre}  →  [${s.ingredientes.join(', ')}]`)

  writeFileSync(resolve(ROOT, 'salidas/nombre-vs-ingredientes-sospechosas.json'), JSON.stringify(sospechosas, null, 2))
  console.log(`\nGuardado en salidas/nombre-vs-ingredientes-sospechosas.json`)
}

main().catch(console.error)

/**
 * Audita las recetas generadas por el pipeline de esqueletos
 * (scripts/generar-recetas-desde-esqueletos.ts) — su nombre/descripción los
 * escribe DeepSeek en texto libre a partir de la lista de ingredientes,
 * pero el prompt no obliga a que ese texto refleje esos ingredientes
 * exactos. Se ha confirmado con ejemplos reales que a veces el nombre habla
 * de un pescado/proteína que no aparece en absoluto en los ingredientes
 * reales insertados (que sí son fiables, vienen del esqueleto determinista).
 *
 * Heurística: para cada receta, mira si alguna palabra significativa de
 * sus 2 ingredientes de más peso aparece en el nombre. Si no, la marca
 * como sospechosa para revisión/regeneración.
 *
 * Uso:
 *   node scripts/audit-esqueleto-nombre-vs-ingredientes.mjs   (solo diagnóstico)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
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

const STOP = new Set(['fresco', 'fresca', 'frescas', 'frescos', 'crudo', 'cruda', 'picado', 'picada', 'asado', 'asada', 'cocido', 'cocida', 'natural', 'entero', 'entera', 'blanco', 'blanca', 'integral', 'verde', 'verdes'])

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim()
}
function palabras(s) {
  return norm(s).split(/\s+/).filter(w => w.length > 3 && !STOP.has(w))
}

async function main() {
  const perfiles = ['perdida_grasa', 'rendimiento', 'patologia']
  const ids = new Set()
  const recetasPorId = new Map()
  for (const perfil of perfiles) {
    const { data } = await sb.from('recetas').select('id, nombre').eq('estado', 'aprobada').contains('tags', [perfil])
    for (const r of data ?? []) { ids.add(r.id); recetasPorId.set(r.id, r.nombre) }
  }
  console.log(`Recetas candidatas (esqueletos perdida_grasa/rendimiento/patologia): ${ids.size}\n`)

  const sospechosas = []
  for (const id of ids) {
    const nombre = recetasPorId.get(id)
    const { data: ings } = await sb.from('receta_ingredientes')
      .select('nombre_libre, cantidad_gramos, alimento:alimentos(nombre)')
      .eq('receta_id', id)
      .order('cantidad_gramos', { ascending: false })
      .limit(2)
    if (!ings || ings.length === 0) continue

    const nombreN = norm(nombre)
    let coincide = false
    const top = []
    for (const ing of ings) {
      const alimN = Array.isArray(ing.alimento) ? ing.alimento[0]?.nombre : ing.alimento?.nombre
      top.push(alimN ?? ing.nombre_libre)
      for (const w of palabras(alimN ?? ing.nombre_libre ?? '')) {
        if (nombreN.includes(w)) { coincide = true; break }
      }
      if (coincide) break
    }
    if (!coincide) sospechosas.push({ id, nombre, top_ingredientes: top })
  }

  console.log(`Sospechosas (nombre no menciona ninguno de sus 2 ingredientes principales): ${sospechosas.length}\n`)
  for (const s of sospechosas) console.log(`- ${s.nombre}  →  [${s.top_ingredientes.join(', ')}]`)

  const fs = await import('fs')
  fs.writeFileSync(resolve(ROOT, 'salidas/esqueleto-nombre-sospechosas.json'), JSON.stringify(sospechosas, null, 2))
  console.log(`\nGuardado en salidas/esqueleto-nombre-sospechosas.json`)
}

main().catch(console.error)

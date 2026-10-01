/**
 * Completa campos que faltan en recetas aprobadas: rol de ingrediente (clasificador
 * del proyecto) y lista las recetas sin franja para revisión manual.
 * Simula por defecto; --apply para escribir.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { inferirRolIngrediente } from '../lib/ingredient-roles'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: sinRol, error } = await db.from('receta_ingredientes')
    .select('id, nombre_libre, receta:recetas!receta_ingredientes_receta_id_fkey(nombre, estado), alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, categoria)')
    .is('rol_ingrediente', null)
  if (error) throw error
  const aprobadas = (sinRol ?? []).filter((r: any) => r.receta?.estado === 'aprobada' && r.alimento)
  console.log(`Ingredientes sin rol en recetas aprobadas: ${aprobadas.length}`)
  for (const r of aprobadas as any[]) {
    // El clasificador toma la leche por "verdura" por sus pocas kcal
    const esLacteo = /\b(leche|yogur|kefir)\b/i.test(r.alimento.nombre) && !/coco|almendra|avena|soja|arroz/i.test(r.alimento.nombre)
    const rol = esLacteo ? 'lacteo_complemento' : inferirRolIngrediente(r.alimento, r.nombre_libre ?? '')
    console.log(`  ${r.receta.nombre.slice(0, 45).padEnd(47)} "${r.nombre_libre}" [${r.alimento.nombre}] → ${rol}`)
    if (APPLY) {
      const { error: e } = await db.from('receta_ingredientes').update({ rol_ingrediente: rol }).eq('id', r.id)
      if (e) throw e
    }
  }

  // Nombres visibles heredados de otra plantilla (patrón T43): el alimento vinculado es el correcto
  const RENOMBRAR: [string, string][] = [
    ['89ee6cfd-8fc8-4e2d-b801-471c8912ca6f', 'arroz blanco'],
    ['946c2d82-f6ad-4719-9332-70181883069e', 'aceite de coco virgen'],
  ]
  for (const [id, nombre] of RENOMBRAR) {
    console.log(`  renombrar ingrediente ${id.slice(0, 8)} → "${nombre}"`)
    if (APPLY) {
      const { error: e } = await db.from('receta_ingredientes').update({ nombre_libre: nombre }).eq('id', id)
      if (e) throw e
    }
  }

  const { data: sinFranja } = await db.from('recetas').select('id, nombre, categoria').eq('estado', 'aprobada').is('tipo_plato', null)
  console.log(`\nRecetas aprobadas sin franja (revisión manual): ${sinFranja?.length}`)
  for (const r of sinFranja ?? []) console.log(`  ${r.id.slice(0, 8)} ${r.nombre} (categoría: ${r.categoria ?? '—'})`)
  if (!APPLY) console.log('\nSimulación: nada escrito. Usa --apply.')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })

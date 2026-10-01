// Corrige el ingrediente "Overnight oats de proteína y vainilla" (40 g) de 31 recetas: es el scoop de
// proteína de vainilla, no un plato. Relinka a "Proteína en polvo sabor vainilla" y recalcula macros.
// Simula por defecto; --apply escribe y guarda copia en salidas/. Uso: npx tsx scripts/fix-ingrediente-overnight-oats.ts [--apply]
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const NOMBRE_NUEVO = 'Proteína en polvo de vainilla'

async function main() {
  const { data: malos } = await db.from('alimentos').select('id, nombre').ilike('nombre', 'overnight oats de proteína y vainilla')
  const { data: buenos } = await db.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas').eq('nombre', 'Proteína en polvo sabor vainilla').eq('es_comestible', true)
  const bueno = (buenos ?? []).find(a => a.id.startsWith('9076c191'))
  if (!bueno) throw new Error('No se encuentra el alimento destino')
  const idsMalos = (malos ?? []).map(a => a.id)
  console.log('alimentos origen:', (malos ?? []).map(a => `${a.id.slice(0, 8)} ${a.nombre}`), '→ destino:', bueno.nombre, bueno.calorias, 'kcal')

  const { data: filas } = await db.from('receta_ingredientes').select('id, receta_id, nombre_libre, cantidad_gramos, alimento_id, rol_ingrediente').in('alimento_id', idsMalos)
  const recetaIds = [...new Set((filas ?? []).map(f => f.receta_id))]
  const { data: recetas } = await db.from('recetas').select('id, nombre, estado, porciones, kcal, proteinas, carbohidratos, grasas, fibra').in('id', recetaIds)
  const aprobadas = recetas ?? []
  console.log(`filas ${filas?.length} · recetas ${recetas?.length} (aprobadas ${aprobadas.length})\n`)

  const copia: unknown[] = []
  for (const r of aprobadas) {
    const mias = (filas ?? []).filter(f => f.receta_id === r.id)
    const { data: todas } = await db.from('receta_ingredientes').select('id, cantidad_gramos, alimento_id, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)').eq('receta_id', r.id)
    const por = Math.max(1, Number(r.porciones ?? 1))
    const t = { kcal: 0, p: 0, c: 0, g: 0, f: 0 }
    for (const i of (todas ?? []) as unknown as { id: string; cantidad_gramos: number; alimento_id: string | null; alimento: { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null } | null }[]) {
      const a = idsMalos.includes(i.alimento_id ?? '') ? bueno as unknown as { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null } : i.alimento
      if (!a) continue
      const f = Number(i.cantidad_gramos) / 100
      t.kcal += a.calorias * f; t.p += a.proteinas * f; t.c += a.carbohidratos * f; t.g += a.grasas * f; t.f += (a.fibra ?? 0) * f
    }
    const rd = (v: number) => Math.round((v / por) * 10) / 10
    const nuevo = { kcal: Math.round(t.kcal / por), proteinas: rd(t.p), carbohidratos: rd(t.c), grasas: rd(t.g), fibra: rd(t.f) }
    console.log(`${r.nombre.slice(0, 48).padEnd(49)} ${String(Math.round(r.kcal)).padStart(4)} → ${String(nuevo.kcal).padStart(4)} kcal · P ${Math.round(r.proteinas)} → ${Math.round(nuevo.proteinas)}`)
    copia.push({ receta: { id: r.id, kcal: r.kcal, proteinas: r.proteinas, carbohidratos: r.carbohidratos, grasas: r.grasas, fibra: r.fibra }, filas: mias })
    if (APPLY) {
      for (const f of mias) {
        const { error } = await db.from('receta_ingredientes').update({ alimento_id: bueno.id, nombre_libre: NOMBRE_NUEVO, rol_ingrediente: 'proteina_principal' }).eq('id', f.id)
        if (error) throw error
      }
      const { error } = await db.from('recetas').update(nuevo).eq('id', r.id)
      if (error) throw error
    }
  }
  // Copias ya materializadas en comidas de planes (misma confusión de alimento)
  const { data: enPlanes } = await db.from('comida_alimentos').select('id, comida_id, cantidad_gramos').in('alimento_id', idsMalos)
  console.log(`\nfilas en comidas de planes: ${enPlanes?.length ?? 0}`)
  if (APPLY && (enPlanes?.length ?? 0) > 0) {
    const { error } = await db.from('comida_alimentos').update({ alimento_id: bueno.id }).in('id', (enPlanes ?? []).map(x => x.id))
    if (error) throw error
    copia.push({ comida_alimentos_previos: enPlanes, alimentos_origen: idsMalos })
  }
  if (APPLY) {
    writeFileSync(join(__dirname, '..', 'salidas', 'copia-fix-overnight-oats-2026-10-01.json'), JSON.stringify(copia, null, 1))
    console.log('\n✅ aplicado. Copia en salidas/copia-fix-overnight-oats-2026-10-01.json')
  } else console.log('\nSimulación: nada escrito. Usa --apply.')
}
main().catch(e => { console.error(e.message ?? e); process.exit(1) })

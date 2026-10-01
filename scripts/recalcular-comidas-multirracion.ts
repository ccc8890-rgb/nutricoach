// Recalcula las comidas de planes activos cuya receta es de 3+ raciones (aplicadas con el escalado antiguo, que
// usaba la receta entera). Simula por defecto; --apply escribe. Uso: npx tsx scripts/recalcular-comidas-multirracion.ts [--apply]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { aplicarRecetaAComida } from '../lib/recetas/aplicar-receta-comida'
import { repartoFranja } from '../lib/nutricion/semana-dieta'
import type { SlotComida } from '../lib/tipos-comida'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')

const kcalDe = (filas: { cantidad_gramos: number; alimento: { calorias: number } | null }[]) =>
  Math.round(filas.reduce((a, f) => a + (f.alimento?.calorias ?? 0) * f.cantidad_gramos / 100, 0))

async function main() {
  console.log(APPLY ? 'MODO: aplicar\n' : 'MODO: simulación\n')
  const { data: planes } = await db.from('planes_nutricion').select('id, nombre, cliente_id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo').eq('activo', true).not('cliente_id', 'is', null)
  let total = 0
  for (const plan of planes ?? []) {
    const { data: comidas } = await db.from('comidas').select('id, nombre, dia_semana, receta_id, receta:recetas(nombre, porciones)').eq('plan_id', plan.id).not('receta_id', 'is', null)
    const afectadas = (comidas ?? []).filter(c => Number((c as any).receta?.porciones ?? 1) >= 3 && c.dia_semana)
    console.log(`${plan.nombre} (cliente ${plan.cliente_id.slice(0, 8)}): ${afectadas.length} comidas de ${(comidas ?? []).length} con recetas de 3+ raciones`)
    for (const c of afectadas) {
      const antes = kcalDe(((await db.from('comida_alimentos').select('cantidad_gramos, alimento:alimentos(calorias)').eq('comida_id', c.id)).data ?? []) as any)
      const share = await repartoFranja(db, plan.id, c.nombre as SlotComida)
      const obj = (v: number | null) => (v ? v * share : undefined)
      if (APPLY) await aplicarRecetaAComida(db, { comidaId: c.id, recetaId: c.receta_id!, clienteId: plan.cliente_id, planId: plan.id, comidaSlot: c.nombre, targetKcal: obj(plan.kcal_objetivo), targetProteinas: obj(plan.proteinas_objetivo), targetCarbohidratos: obj(plan.carbohidratos_objetivo), targetGrasas: obj(plan.grasas_objetivo), reemplazar: true })
      const despues = APPLY ? kcalDe(((await db.from('comida_alimentos').select('cantidad_gramos, alimento:alimentos(calorias)').eq('comida_id', c.id)).data ?? []) as any) : null
      console.log(`   ${String(c.dia_semana).padEnd(10)} ${c.nombre.padEnd(12)} ${String((c as any).receta?.nombre).slice(0, 38).padEnd(39)} ${String((c as any).receta?.porciones).padStart(2)} rac · ${antes} kcal → ${despues ?? `objetivo ${Math.round((plan.kcal_objetivo ?? 0) * share)}`}`)
      total++
    }
  }
  console.log(`\n${total} comidas ${APPLY ? 'recalculadas' : 'a recalcular'}`)
}
main().catch(e => { console.error(e.message ?? e); process.exit(1) })

// Solo lectura: compara objetivos de cada plan de nutrición activo con la suma real de sus comidas por día.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { comidasDelDia } from '../lib/nutricion/comidas-dia'

for (const linea of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
type Macro = { kcal: number; p: number; c: number; g: number }
const pct = (real: number, obj: number | null) => (obj ? Math.round(((real - obj) / obj) * 100) : null)

async function main() {
  const { data: planes, error } = await db
    .from('planes_nutricion')
    .select(`id, nombre, cliente_id, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo,
      comidas(id, nombre, dia_semana, orden, receta_id,
        comida_alimentos(cantidad_gramos, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas)))`)
    .eq('activo', true)
    .not('cliente_id', 'is', null)
  if (error) throw error

  for (const plan of planes ?? []) {
    const comidas = (plan.comidas ?? []) as any[]
    const totalDia = (dia: number): Macro => {
      const t = { kcal: 0, p: 0, c: 0, g: 0 }
      for (const comida of comidasDelDia(comidas, dia)) {
        for (const ca of comida.comida_alimentos ?? []) {
          const a = ca.alimento
          if (!a) continue
          const f = (ca.cantidad_gramos ?? 0) / 100
          t.kcal += (a.calorias ?? 0) * f
          t.p += (a.proteinas ?? 0) * f
          t.c += (a.carbohidratos ?? 0) * f
          t.g += (a.grasas ?? 0) * f
        }
      }
      return t
    }
    const dias = DIAS.map((d, i) => ({ d, ...totalDia(i) })).filter(x => x.kcal > 0)
    const avg = (k: keyof Macro) => (dias.length ? dias.reduce((s, x) => s + x[k], 0) / dias.length : 0)
    const sinAlimento = comidas.flatMap(c => c.comida_alimentos ?? []).filter((ca: any) => !ca.alimento).length

    console.log(`\n${plan.nombre} (${plan.id.slice(0, 8)}) · ${comidas.length} comidas · ${dias.length} días con comida${sinAlimento ? ` · ${sinAlimento} alimentos sin vincular` : ''}`)
    console.log(`  objetivo  kcal ${plan.kcal_objetivo} · P ${plan.proteinas_objetivo} · C ${plan.carbohidratos_objetivo} · G ${plan.grasas_objetivo}`)
    console.log(`  real/día  kcal ${Math.round(avg('kcal'))} (${pct(avg('kcal'), plan.kcal_objetivo)}%) · P ${Math.round(avg('p'))} (${pct(avg('p'), plan.proteinas_objetivo)}%) · C ${Math.round(avg('c'))} (${pct(avg('c'), plan.carbohidratos_objetivo)}%) · G ${Math.round(avg('g'))} (${pct(avg('g'), plan.grasas_objetivo)}%)`)
    if (!dias.length && comidas.length) {
      const valores = [...new Set(comidas.map(c => JSON.stringify(c.dia_semana)))].join(', ')
      const conAlimentos = comidas.filter(c => (c.comida_alimentos ?? []).length > 0).length
      console.log(`  ⚠️ dia_semana encontrados: ${valores} · comidas con alimentos: ${conAlimentos}/${comidas.length}`)
    }
    const kcals = dias.map(x => Math.round(x.kcal))
    if (kcals.length > 1) console.log(`  rango kcal entre días: ${Math.min(...kcals)}–${Math.max(...kcals)}`)
    if (kcals.length > 1 && Math.max(...kcals) - Math.min(...kcals) > 300) {
      DIAS.forEach((d, i) => {
        const nombres = comidasDelDia(comidas, i).map(c => c.nombre).join(', ')
        console.log(`    ${d.padEnd(9)} ${String(Math.round(totalDia(i).kcal)).padStart(5)} kcal · ${nombres || '—'}`)
      })
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })

// Solo lectura: simula el optimizador de factores sobre los planes activos y lo compara con su estado actual.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { optimizarFactoresReceta } from '../lib/recetas/optimizar-factores'
import { redondearGramajePractico } from '../lib/recetas/aplicar-receta-comida'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
type M = { kcal: number; p: number; c: number; g: number }
const cero = (): M => ({ kcal: 0, p: 0, c: 0, g: 0 })
const suma = (a: M, b: M) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, g: a.g + b.g })
const pct = (r: number, o: number) => `${r >= o ? '+' : ''}${Math.round(((r - o) / o) * 100)}%`
const fmt = (m: M, o: M) => `kcal ${pct(m.kcal, o.kcal)} · P ${pct(m.p, o.p)} · C ${pct(m.c, o.c)} · G ${pct(m.g, o.g)}`

async function main() {
  const { data: planes, error } = await db.from('planes_nutricion')
    .select(`id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo,
      comidas(id, nombre, dia_semana, receta_id, comida_alimentos(cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas)))`)
    .eq('activo', true).not('cliente_id', 'is', null)
  if (error) throw error

  for (const plan of planes ?? []) {
    const comidas = ((plan.comidas ?? []) as any[]).filter(c => !c.dia_semana)
    if (!comidas.length) { console.log(`\n${plan.nombre}: semana con días concretos, se omite`); continue }
    const objetivo: M = { kcal: plan.kcal_objetivo, p: plan.proteinas_objetivo, c: plan.carbohidratos_objetivo, g: plan.grasas_objetivo }
    const macrosComida = (c: any): M => (c.comida_alimentos ?? []).reduce((acc: M, ca: any) => {
      const a = ca.alimento; if (!a) return acc; const f = ca.cantidad_gramos / 100
      return suma(acc, { kcal: a.calorias * f, p: a.proteinas * f, c: a.carbohidratos * f, g: a.grasas * f })
    }, cero())
    const actualPorComida = comidas.map(macrosComida)
    const actual = actualPorComida.reduce(suma, cero())

    let nuevo = cero()
    for (let i = 0; i < comidas.length; i++) {
      const c = comidas[i]
      const share = actual.kcal > 0 ? actualPorComida[i].kcal / actual.kcal : 1 / comidas.length
      if (!c.receta_id) { nuevo = suma(nuevo, actualPorComida[i]); continue }
      const { data: ings } = await db.from('receta_ingredientes')
        .select('cantidad_gramos, rol_ingrediente, es_cantidad_fija, alimento:alimentos(calorias, proteinas, carbohidratos, grasas)')
        .eq('receta_id', c.receta_id)
      const validos = (ings ?? []).filter((x: any) => x.alimento && x.cantidad_gramos > 0) as any[]
      const r = optimizarFactoresReceta(validos.map(x => ({
        rol: x.rol_ingrediente, gramos: x.cantidad_gramos, fija: x.es_cantidad_fija === true,
        por100: { kcal: x.alimento.calorias, p: x.alimento.proteinas, c: x.alimento.carbohidratos, g: x.alimento.grasas },
      })), { kcal: objetivo.kcal * share, p: objetivo.p * share, c: objetivo.c * share, g: objetivo.g * share })
      validos.forEach((x, idx) => {
        const gramos = x.es_cantidad_fija ? x.cantidad_gramos : redondearGramajePractico(x.cantidad_gramos * r.factores[idx])
        const f = gramos / 100
        nuevo = suma(nuevo, { kcal: x.alimento.calorias * f, p: x.alimento.proteinas * f, c: x.alimento.carbohidratos * f, g: x.alimento.grasas * f })
      })
    }
    console.log(`\n${plan.nombre} (${plan.id.slice(0, 8)}) · objetivo ${objetivo.kcal} kcal / ${objetivo.p} P / ${objetivo.c} C / ${objetivo.g} G`)
    console.log(`  AHORA  ${fmt(actual, objetivo)}`)
    console.log(`  NUEVO  ${fmt(nuevo, objetivo)}`)
  }
}
main().catch(e => { console.error(e); process.exit(1) })

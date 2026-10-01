// Solo lectura: se pide a cada receta SU PROPIA ración como objetivo (la respuesta correcta es factor 1 sobre una
// ración) y se compara el escalado usando las cantidades de la receta ENTERA (como hace hoy el código) frente
// a las de UNA RACIÓN (cantidad / porciones).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { optimizarFactoresReceta } from '../lib/recetas/optimizar-factores'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

async function main() {
  const recetas: any[] = []
  for (let f = 0; ; f += 500) {
    const { data } = await db.from('recetas').select('id, nombre, porciones, kcal, proteinas, carbohidratos, grasas, receta_ingredientes!receta_ingredientes_receta_id_fkey(cantidad_gramos, rol_ingrediente, es_cantidad_fija, alimento:alimentos(calorias, proteinas, carbohidratos, grasas))').eq('estado', 'aprobada').range(f, f + 499)
    recetas.push(...(data ?? [])); if ((data ?? []).length < 500) break
  }
  const cubos: Record<string, { n: number; errEntera: number; errRacion: number; malos: number }> = {}
  const peores: { n: string; por: number; ent: number; rac: number; obj: number }[] = []
  for (const r of recetas) {
    const por = Math.max(1, Number(r.porciones ?? 1))
    const OBJ = { kcal: r.kcal, p: r.proteinas, c: r.carbohidratos, g: r.grasas }
    const ings = r.receta_ingredientes.filter((i: any) => i.alimento && i.cantidad_gramos > 0)
    if (!ings.length) continue
    const run = (div: number) => {
      const base = ings.map((i: any) => ({ rol: i.rol_ingrediente, gramos: i.cantidad_gramos / div, fija: i.es_cantidad_fija === true, por100: { kcal: i.alimento.calorias, p: i.alimento.proteinas, c: i.alimento.carbohidratos, g: i.alimento.grasas } }))
      const { factores } = optimizarFactoresReceta(base, OBJ)
      return base.reduce((a: number, b: any, k: number) => a + b.por100.kcal * b.gramos * factores[k] / 100, 0)
    }
    const ent = run(1), rac = run(por)
    const k = por <= 1 ? '1' : por === 2 ? '2' : por <= 4 ? '3-4' : por <= 8 ? '5-8' : '9+'
    const c = (cubos[k] ??= { n: 0, errEntera: 0, errRacion: 0, malos: 0 })
    c.n++; c.errEntera += Math.abs(ent - OBJ.kcal) / OBJ.kcal; c.errRacion += Math.abs(rac - OBJ.kcal) / OBJ.kcal
    if (Math.abs(ent - OBJ.kcal) / OBJ.kcal > 0.1) c.malos++
    if (por >= 4) peores.push({ n: r.nombre, por, ent: Math.round(ent), rac: Math.round(rac), obj: Math.round(r.kcal) })
  }
  console.log('Objetivo: la ración de la propia receta (resultado ideal: 0% de error)\n')
  console.log('raciones | recetas | error medio HOY | error medio por ración | recetas con >10% de error HOY')
  for (const k of ['1', '2', '3-4', '5-8', '9+']) { const c = cubos[k]; if (c) console.log(`${k.padEnd(8)} | ${String(c.n).padStart(7)} | ${(100 * c.errEntera / c.n).toFixed(1).padStart(14)}% | ${(100 * c.errRacion / c.n).toFixed(1).padStart(21)}% | ${c.malos}`) }
  console.log('\nEjemplos (≥4 raciones): receta · raciones · objetivo · kcal que sale')
  for (const p of peores.sort((a, b) => Math.abs(b.ent - b.obj) - Math.abs(a.ent - a.obj)).slice(0, 8)) console.log(`  ${p.n.slice(0, 46).padEnd(47)} ${p.por} · objetivo ${p.obj} · HOY ${p.ent} → por ración ${p.rac}`)
}
main().catch(e => { console.error(e); process.exit(1) })

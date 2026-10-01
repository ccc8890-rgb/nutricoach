/**
 * Corrige vínculos de ingredientes a alimentos equivocados detectados al auditar
 * etiquetas de dieta (01-10-2026). Todos los usos de cada alimento erróneo eran
 * el mismo ingrediente mal emparejado. Dry-run por defecto; --apply para escribir.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const DRY = !process.argv.includes('--apply')
for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// [alimento erróneo, alimento correcto] por nombre exacto + prefijo de id
const RELINKS = [
  [['Bebida láctea desnatada +Proteínas sabor açaí plátano Hacendado 0% MG proteínas', '19f67e13'], ['Plátano', '1131a576']],
  [['Cacahuete frito con miel', '9860c4f5'], ['Miel', '8619b09f']],
  [['Yogur líquido desnatado Piña y Coco Hacendado 0% MG 0% azúcares añadidos', '03f34ba0'], ['Coco rallado', 'c7de73e8']],
  [['Sopa Deshidratada Thaï Fideos, Setas y Coco', 'a08ff94f'], ['Champiñón', '3afe2356']],
  [['Galletas canela', 'cceedcb1'], ['Canela molida', '57a8bd13']],
  [['Mayonesa Francesa con Toque de Mostaza', '45e80e38'], ['Mostaza', '6284b407']],
  [['Natillas con chocolate +Proteínas Hacendado 1, MG proteínas', 'b448b4ac'], ['Proteína en polvo sabor chocolate', 'db0db4aa']],
  [['Mantequilla Tarrina', 'b09368c0'], ['Crema de cacahuete (sin azúcar)', '8694be48']],
]

async function resolver([nombre, prefijo]) {
  const { data, error } = await sb.from('alimentos').select('id, nombre').eq('nombre', nombre)
  if (error) throw error
  const c = (data ?? []).filter(a => a.id.startsWith(prefijo))
  if (c.length !== 1) throw new Error(`"${nombre}" (${prefijo}): ${c.length} coincidencias`)
  return c[0]
}

async function recalcularMacros(recetaId) {
  const { data: receta } = await sb.from('recetas').select('nombre, porciones, kcal').eq('id', recetaId).single()
  const porciones = receta?.porciones || 1
  const { data: ings } = await sb.from('receta_ingredientes')
    .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
    .eq('receta_id', recetaId)
  let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
  for (const i of ings ?? []) {
    const g = i.cantidad_gramos || 0, a = i.alimentos
    if (!a) continue
    kcal += (a.calorias || 0) * g / 100; prot += (a.proteinas || 0) * g / 100
    carb += (a.carbohidratos || 0) * g / 100; gras += (a.grasas || 0) * g / 100; fib += (a.fibra || 0) * g / 100
  }
  const pesoTotal = (ings ?? []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
  const r = v => Math.round(v / porciones * 10) / 10
  const macros = {
    kcal: r(kcal), proteinas: r(prot), carbohidratos: r(carb), grasas: r(gras), fibra: r(fib),
    kcal_100g: pesoTotal > 0 ? Math.round(kcal / pesoTotal * 1000) / 10 : 0,
    peso_total_g: Math.round(pesoTotal),
  }
  console.log(`   ${receta?.nombre}: ${receta?.kcal} → ${macros.kcal} kcal | P ${macros.proteinas} C ${macros.carbohidratos} G ${macros.grasas}`)
  if (!DRY) {
    const { error } = await sb.from('recetas').update(macros).eq('id', recetaId)
    if (error) throw error
  }
}

async function main() {
  console.log(`🔧 Fix vínculos 01-10-2026 — ${DRY ? 'SIMULACIÓN' : 'APLICAR'}\n`)
  const afectadas = new Set()
  for (const [malo, bueno] of RELINKS) {
    const [aMalo, aBueno] = [await resolver(malo), await resolver(bueno)]
    const { data: filas, error } = await sb.from('receta_ingredientes')
      .select('id, receta_id, nombre_libre').eq('alimento_id', aMalo.id)
    if (error) throw error
    for (const f of filas ?? []) {
      console.log(`  "${f.nombre_libre}": ${aMalo.nombre} → ${aBueno.nombre}`)
      if (!DRY) {
        const { error: e } = await sb.from('receta_ingredientes').update({ alimento_id: aBueno.id }).eq('id', f.id)
        if (e) throw e
      }
      afectadas.add(f.receta_id)
    }
  }
  console.log(`\n📊 Macros de ${afectadas.size} recetas${DRY ? ' (simuladas con los vínculos actuales)' : ''}:`)
  for (const id of afectadas) await recalcularMacros(id)
  if (DRY) console.log('\nSimulación: nada escrito. Usa --apply.')
}

main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })

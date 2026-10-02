// Aplica una propuesta de reconstrucción (salidas/propuestas/<id>.json) a una receta: sustituye sus ingredientes,
// recalcula macros y actualiza los pasos. Simula por defecto; --apply escribe y guarda copia de seguridad.
// Uso: npx tsx scripts/aplicar-propuesta-receta.ts <receta_id> [--apply]
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { inferirRolIngrediente } from '../lib/ingredient-roles'

for (const l of readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const id = process.argv[2]

// Correcciones manuales de vinculación: nombre propuesto (minúsculas) → prefijo de id del alimento correcto,
// o null para no incluir ese ingrediente. Se rellenan tras revisar cada propuesta.
const OVERRIDES: Record<string, Record<string, string | null>> = {
  '3fde0638-2d85-46ed-97f6-298ea8f5bbc1': { // Rollitos de verduras con obleas de arroz
    'aceite de oliva virgen extra o girasol': 'efdb0f46', 'vinagre de arroz o manzana': '0179587d', 'sal': 'SAL',
  },
  'b5b585c7-f067-4837-b986-b9bd1ed1a70b': { // Adobos de pollo con especias
    'especias': null,
  },
  '310578b0-7fd0-4418-be3e-5ab882d32f54': { // Ensalada de patatas aplastadas crujientes
    'patatas pequeñas': '0b223775', 'albahaca fresca': '20f15ab2', 'cebollino fresco': '03f57b8d', 'sal': 'SAL', 'nata agria': '894e649b', 'crema agria': '894e649b',
  },
  'a9aaeb13-26e8-4a80-816e-1a7f256428e9': { // Healthy Shrimp Tacos con Mango y Chipotle
    'chalota': 'e6e90355', 'chile chipotle en polvo': '67d8123e', 'pimentón ahumado': '21a40eb5', 'cilantro fresco': '0e40c366', 'lima (zumo y ralladura)': '65756599', 'zumo de lima fresco': '65756599', 'ralladura y zumo de lima': null, 'cilantro fresco picado': '0e40c366', 'nata agria': '894e649b', 'aguacate maduro': '91ad5545',
  },
}

type Al = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number | null; categoria: string | null }
const CAMPOS = 'id, nombre, calorias, proteinas, carbohidratos, grasas, fibra, categoria'

async function alimentoPorPrefijo(pref: string): Promise<Al> {
  if (pref === 'SAL') {
    const { data } = await db.from('alimentos').select(CAMPOS).ilike('nombre', 'sal').limit(5)
    if (!data?.[0]) throw new Error('Alimento "Sal" no encontrado')
    return data[0] as Al
  }
  // Los 8 primeros caracteres del UUID son su primer grupo: se busca por rango
  const { data } = await db.from('alimentos').select(CAMPOS)
    .gte('id', `${pref}-0000-0000-0000-000000000000`).lte('id', `${pref}-ffff-ffff-ffff-ffffffffffff`).limit(5)
  const a = (data ?? []).find(x => x.id.startsWith(pref))
  if (!a) throw new Error(`Alimento ${pref} no encontrado`)
  return a as Al
}

async function main() {
  const ruta = join(__dirname, '..', 'salidas', 'propuestas', `${id}.json`)
  if (!existsSync(ruta)) throw new Error(`Sin propuesta para ${id}`)
  const prop = (JSON.parse(readFileSync(ruta, 'utf8')) as any[]).find(p => p.receta_id === id)
  if (!prop) throw new Error('La propuesta no contiene esta receta')
  const over = OVERRIDES[id] ?? {}

  // Resolver cada ingrediente propuesto
  const filas: { nombre: string; gramos: number; alimento: Al }[] = []
  const sinVincular: string[] = []
  for (const ing of prop.ingredientes as { nombre: string; gramos: number; alimento_id: string | null }[]) {
    const clave = ing.nombre.toLowerCase().trim()
    if (clave in over) {
      if (over[clave] === null) continue
      filas.push({ nombre: ing.nombre, gramos: ing.gramos, alimento: await alimentoPorPrefijo(over[clave]!) })
    } else if (ing.alimento_id) {
      const { data } = await db.from('alimentos').select(CAMPOS).eq('id', ing.alimento_id).single()
      filas.push({ nombre: ing.nombre, gramos: ing.gramos, alimento: data as Al })
    } else sinVincular.push(ing.nombre)
  }
  if (sinVincular.length) throw new Error(`Ingredientes sin vincular (añade un override): ${sinVincular.join(', ')}`)

  const { data: r } = await db.from('recetas').select('id, nombre, porciones, kcal, proteinas, carbohidratos, grasas, fibra, instrucciones').eq('id', id).single()
  const { data: previos } = await db.from('receta_ingredientes').select('*').eq('receta_id', id)
  const por = Math.max(1, Number(r!.porciones ?? 1))
  const t = filas.reduce((a, f) => { const x = f.gramos / 100; return { kcal: a.kcal + f.alimento.calorias * x, p: a.p + f.alimento.proteinas * x, c: a.c + f.alimento.carbohidratos * x, g: a.g + f.alimento.grasas * x, f: a.f + (f.alimento.fibra ?? 0) * x } }, { kcal: 0, p: 0, c: 0, g: 0, f: 0 })
  const rd = (v: number) => Math.round((v / por) * 10) / 10
  const nuevo = { kcal: Math.round(t.kcal / por), proteinas: rd(t.p), carbohidratos: rd(t.c), grasas: rd(t.g), fibra: rd(t.f) }

  console.log(`${r!.nombre} · ${por} raciones`)
  console.log(`kcal/ración ${Math.round(r!.kcal)} → ${nuevo.kcal} · P ${Math.round(r!.proteinas)}→${Math.round(nuevo.proteinas)} · C ${Math.round(r!.carbohidratos)}→${Math.round(nuevo.carbohidratos)} · G ${Math.round(r!.grasas)}→${Math.round(nuevo.grasas)}`)
  for (const f of filas) console.log(`   ${String(f.gramos).padStart(6)} g  ${f.nombre.padEnd(34)} → ${f.alimento.nombre}`)
  console.log('   se sustituyen', previos?.length, 'ingredientes anteriores')
  if (prop.instrucciones) console.log('\nNUEVOS PASOS:\n' + prop.instrucciones)
  else console.log('\n(el original no describe pasos: se conservan los actuales)')

  if (!APPLY) { console.log('\nSimulación: nada escrito. Usa --apply.'); return }
  writeFileSync(join(__dirname, '..', 'salidas', `copia-receta-${id}.json`), JSON.stringify({ receta: r, ingredientes: previos }, null, 1))
  const { error: e1 } = await db.from('receta_ingredientes').delete().eq('receta_id', id)
  if (e1) throw e1
  const { error: e2 } = await db.from('receta_ingredientes').insert(filas.map((f, orden) => ({
    receta_id: id, alimento_id: f.alimento.id, nombre_libre: f.nombre, cantidad_gramos: f.gramos, es_cantidad_fija: false, orden,
    rol_ingrediente: inferirRolIngrediente(f.alimento, f.nombre),
  })))
  if (e2) { await db.from('receta_ingredientes').insert((previos ?? []).map(({ id: _id, ...x }: any) => x)); throw new Error('Fallo al insertar; ingredientes anteriores restaurados: ' + e2.message) }
  const { error: e3 } = await db.from('recetas').update({ ...nuevo, ...(prop.instrucciones ? { instrucciones: prop.instrucciones } : {}) }).eq('id', id)
  if (e3) throw e3
  console.log('\n✅ aplicado. Copia en salidas/copia-receta-' + id + '.json')
}
main().catch(e => { console.error('❌', e.message ?? e); process.exit(1) })

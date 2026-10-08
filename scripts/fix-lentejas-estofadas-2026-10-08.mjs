// Corrige «Lentejas estofadas con verduras» (a7710219): llevaba una papilla de bebé de +8 meses, agua con gas y salsa de tomate
// donde las instrucciones piden lentejas secas, agua y tomate triturado. Simula por defecto; --apply escribe (con copia previa).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

for (const l of readFileSync(join(import.meta.dirname, '..', '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const RECETA = 'a7710219-4159-4955-bc93-ee78d2c2aacd'

const CAMBIOS = [
  { cuando: /Papilla lentejas/i, alimento: 'ff64faff-89ec-4e6a-a7cc-7ce217feb3d4', nombre: 'Lentejas secas', gramos: 300 },
  { cuando: /Agua mineral/i, alimento: 'c125af5a-afe3-4ffc-a9d5-185817b6a9db', nombre: 'Agua', gramos: 1000 },
  { cuando: /Salsa de tomate/i, alimento: '1390b7a4-693d-47c4-9a54-cf03649b8033', nombre: 'Tomate triturado', gramos: 150 },
  { cuando: /^Sal de ajo/i, alimento: 'bdc11c5a-66bc-4325-bf35-5ab0ba52e3f2', nombre: 'Ajo', gramos: 10 },
]

const { data: receta } = await db.from('recetas').select('*').eq('id', RECETA).single()
const { data: ings } = await db.from('receta_ingredientes').select('*').eq('receta_id', RECETA)
console.log(`${receta.nombre}: ${Math.round(receta.kcal)} kcal/ración, P ${receta.proteinas} (antes)`)
const aplicar = []
for (const i of ings) {
  const c = CAMBIOS.find(x => x.cuando.test(i.nombre_libre))
  if (c) { console.log(`  «${i.nombre_libre}» ${i.cantidad_gramos} g → ${c.nombre} ${c.gramos} g`); aplicar.push({ id: i.id, c }) }
}
if (aplicar.length !== CAMBIOS.length) throw new Error(`Se esperaban ${CAMBIOS.length} cambios y hay ${aplicar.length}`)
if (!APPLY) { console.log('Simulación: nada escrito. Usa --apply.'); process.exit(0) }
writeFileSync(join(import.meta.dirname, '..', 'salidas', `copia-receta-${RECETA}.json`), JSON.stringify({ receta, ingredientes: ings }, null, 2))
for (const { id, c } of aplicar) {
  const { error } = await db.from('receta_ingredientes').update({ alimento_id: c.alimento, nombre_libre: c.nombre, cantidad_gramos: c.gramos }).eq('id', id)
  if (error) throw error
}
const { data: despues } = await db.from('recetas').select('kcal,proteinas,carbohidratos,grasas').eq('id', RECETA).single()
console.log('Después (por ración):', despues)

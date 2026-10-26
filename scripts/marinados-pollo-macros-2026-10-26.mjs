import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ID = '392195a9-b0e1-481d-8994-e49a4686a42a'
const { data: r } = await db.from('recetas').select('porciones').eq('id', ID).single()
const { data: ings } = await db.from('receta_ingredientes').select('cantidad_gramos, alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id', ID)
const t = { k: 0, p: 0, c: 0, g: 0, f: 0, peso: 0 }
for (const i of ings) { const f = i.cantidad_gramos / 100, a = i.alimentos; t.k += a.calorias * f; t.p += a.proteinas * f; t.c += a.carbohidratos * f; t.g += a.grasas * f; t.f += (a.fibra ?? 0) * f; t.peso += i.cantidad_gramos }
const N = r.porciones, d = v => Math.round(v * 100) / 100
const upd = { kcal: d(t.k / N), proteinas: d(t.p / N), carbohidratos: d(t.c / N), grasas: d(t.g / N), fibra: d(t.f / N), peso_total_g: d(t.peso),
  kcal_100g: d(t.k / t.peso * 100), proteinas_100g: d(t.p / t.peso * 100), carbohidratos_100g: d(t.c / t.peso * 100), grasas_100g: d(t.g / t.peso * 100), fibra_100g: d(t.f / t.peso * 100),
  descripcion_porcion: '1 ración (150 g de pollo con su marinado)' }
console.log(upd)
const { error } = await db.from('recetas').update(upd).eq('id', ID); if (error) throw error

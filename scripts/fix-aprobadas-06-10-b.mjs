/**
 * fix-aprobadas-06-10-b.mjs — últimos enlaces erróneos de la auditoría 06-10-2026 + alimentos de uso común marcados "no comestible".
 *   node scripts/fix-aprobadas-06-10-b.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
for (const l of readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const A = async n => { const { data } = await db.from('alimentos').select('id').eq('nombre', n).eq('es_comestible', true).limit(1); if (!data?.length) throw new Error('No existe ' + n); return data[0].id }
const C = [
  ['Pan de ajo relleno de queso', 'Masa de pizza', { a: 'Masa fresca pizza' }],
  ['Tiramisú proteico', 'yogur', { n: 'Yogur griego natural 0%', a: 'Yogur griego natural (0%)' }],
  ['Sorbete de mango con limón', 'Limón (su zumo)', { a: 'Limón exprimido' }],
  ['Vasitos de yogur griego con compota de fresa sin azúcar', 'ralladura de limón', { a: 'Limón, ralladura' }],
  ['Pecan caramel bites', 'Nueces pecan', { a: 'Nuez Pecana Hacendado pelada' }],
  ['Bowl de queso fresco con melocotón y pistachos', 'miel', { a: 'Miel' }],
  ['Tartaculan de chocolate', 'Cacao en polvo', { a: 'Cacao puro en polvo' }],
  ['Yogur cremoso con frutos rojos y nueces crujientes', 'frutos rojos', { a: 'Frutos rojos congelados' }],
  ['Crema melosa de yogur griego con frutos rojos y avena crujiente', 'frutos rojos', { a: 'Frutos rojos congelados' }],
  ['Yogur cremoso con avena y frutos rojos', 'frutos rojos', { a: 'Frutos rojos congelados' }],
  ['Ñoquis crujientes con Gula del Norte y tomates cherry', 'Tomates cherry', { a: 'Tomate cherry' }],
  ['Ñoquis crujientes con Gula del Norte y tomates cherry', 'Zumo de limón', { g: 20 }],
  ['Turbo Poolish para Pizza Rápida', 'Levadura', { a: 'Levadura de panadería' }],
]
const tocadas = new Set(), backup = []
for (const [rec, buscar, set] of C) {
  const { data: rs } = await db.from('recetas').select('id,nombre').eq('nombre', rec)
  for (const r of rs) {
    const { data: ings } = await db.from('receta_ingredientes').select('id,nombre_libre,cantidad_gramos,alimento_id').eq('receta_id', r.id)
    const hit = ings.find(i => norm(i.nombre_libre).startsWith(norm(buscar)))
    if (!hit) { console.log('⚠', rec, '→ no encuentro', buscar); continue }
    const upd = {}; if (set.g !== undefined) upd.cantidad_gramos = set.g; if (set.n) upd.nombre_libre = set.n; if (set.a) upd.alimento_id = await A(set.a)
    console.log(`- ${rec} | ${hit.nombre_libre} → ${JSON.stringify({ ...upd, alimento_id: set.a })}`)
    backup.push({ id: hit.id, antes: hit })
    if (APPLY) await db.from('receta_ingredientes').update(upd).eq('id', hit.id)
    tocadas.add(r.id)
  }
}
// Turbo Poolish: masa para ~6 raciones (600 g de harina)
{ const { data: t } = await db.from('recetas').select('id,porciones').eq('nombre', 'Turbo Poolish para Pizza Rápida').single()
  console.log(`- Turbo Poolish: porciones ${t.porciones} → 6`); backup.push({ receta: t.id, porciones: t.porciones }); if (APPLY) await db.from('recetas').update({ porciones: 6 }).eq('id', t.id); tocadas.add(t.id) }
// alimentos usados en recetas marcados es_comestible=false → true
let rows = []
for (let f = 0; ; f += 1000) { const { data } = await db.from('receta_ingredientes').select('alimento_id,alimentos(nombre,es_comestible)').not('alimento_id', 'is', null).range(f, f + 999); rows = rows.concat(data); if (data.length < 1000) break }
const nc = new Map(); rows.filter(r => r.alimentos?.es_comestible === false).forEach(r => nc.set(r.alimento_id, r.alimentos.nombre))
console.log(`\nAlimentos usados en recetas marcados NO comestibles: ${nc.size}`); console.log([...nc.values()].slice(0, 70).join(' · '))
backup.push({ alimentos_es_comestible_false: [...nc.keys()] })
if (APPLY && nc.size) { const { error } = await db.from('alimentos').update({ es_comestible: true }).in('id', [...nc.keys()]); if (error) console.log('❌', error.message) }
// recalcular macros
for (const id of tocadas) {
  const { data: rec } = await db.from('recetas').select('nombre,porciones,kcal').eq('id', id).single()
  const { data: ings } = await db.from('receta_ingredientes').select('cantidad_gramos, alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id', id)
  let k = 0, p = 0, c = 0, g = 0, fi = 0, peso = 0
  for (const i of ings) { const q = i.cantidad_gramos || 0; peso += q; const a = i.alimentos; if (!a) continue; k += (a.calorias || 0) * q / 100; p += (a.proteinas || 0) * q / 100; c += (a.carbohidratos || 0) * q / 100; g += (a.grasas || 0) * q / 100; fi += (a.fibra || 0) * q / 100 }
  const pr = rec.porciones || 1, rd = v => Math.round(v / pr * 10) / 10
  const m = { kcal: rd(k), proteinas: rd(p), carbohidratos: rd(c), grasas: rd(g), fibra: rd(fi), kcal_100g: peso > 0 ? Math.round(k / peso * 1000) / 10 : 0, peso_total_g: Math.round(peso) }
  if (APPLY) { await db.from('recetas').update(m).eq('id', id); if (Math.abs(m.kcal - rec.kcal) > 1) console.log(`  ${rec.nombre}: ${Math.round(rec.kcal)} → ${m.kcal} kcal/ración`) }
}
if (APPLY) writeFileSync('salidas/06-10-2026_backup-aprobadas-b.json', JSON.stringify(backup, null, 1)); else console.log('\nSIMULACIÓN. Añade --apply.')

/**
 * fix-vinculos-sistemicos-06-10.mjs — corrige patrones de vinculación mal hechos en TODAS las recetas (06-10-2026):
 * yogur natural ↔ yogur de mango/fresa, ingredientes "cocidos" ↔ alimento crudo (y al revés), frutos rojos ↔ barritas, etc.
 *   node scripts/fix-vinculos-sistemicos-06-10.mjs            → simulación
 *   node scripts/fix-vinculos-sistemicos-06-10.mjs --apply    → aplica y recalcula macros de las recetas tocadas
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// nl: regex sobre nombre_libre (sin tildes) · de: regex sobre el alimento vinculado actual · a: alimento destino exacto
const REGLAS = [
  { nl: /yogur griego natural.*entero|yogur natural entero/, de: /^yogur griego (con mango|con fresa)/, a: 'Yogur griego natural (entero)' },
  { nl: /yogur griego natural|yogur natural/, de: /^yogur griego (con mango|con fresa)/, a: 'Yogur griego natural (0%)' },
  { nl: /frutos rojos|frutos del bosque/, de: /^barritas de muesli/, a: 'Frutos rojos congelados' },
  { nl: /nueces/, de: /^bebida lactea omega/, a: 'Nueces' },
  { nl: /pan proteico/, de: /^postre proteico/, a: 'Pan integral' },
  { nl: /avena en polvo|harina de avena/, de: /^galleta digestive/, a: 'Harina de avena' },
  { nl: /avena en copos|copos de avena/, de: /^galleta digestive/, a: 'Avena' },
  { nl: /gelatina neutra/, de: /^gelatina 0%/, a: 'Gelatina neutra' },
  { nl: /arroz cocido/, de: /^cereales copos/, a: 'Arroz cocido redondo Sabroz' },
  { nl: /chocolate blanco/, de: /^fresas chocolate/, a: 'Chocolate blanco fundir' },
  { nl: /arroz integral en crudo/, de: /vaso pack/, a: 'Arroz integral largo' },
  { nl: /arroz integral cocido/, de: /vaso pack/, a: 'Arroz cocido integral Sabroz' },
  { nl: /quinoa cocida/, de: /^quinoa( 100% paquete)?$/, a: 'Quinoa cocida blanca y roja Sabroz' },
  { nl: /alubias rojas cocidas/, de: /^alubias rojas paquete/, a: 'Alubia Roja Cocida Frasco' },
  { nl: /limon o lima/, de: /^caramelo/, a: 'Limones' },
  { nl: /proteina de suero sabor chocolate|proteina whey chocolate/, de: /^yogur de proteina/, a: 'Proteína en polvo sabor chocolate' },
]
const cache = {}
async function A(nombre) {
  if (cache[nombre]) return cache[nombre]
  const { data } = await db.from('alimentos').select('id,nombre').eq('nombre', nombre).eq('es_comestible', true).limit(1)
  if (!data?.length) throw new Error(`Alimento no encontrado: "${nombre}"`)
  return (cache[nombre] = data[0])
}

const todas = []
for (let f = 0; ; f += 1000) {
  const { data } = await db.from('receta_ingredientes')
    .select('id,receta_id,nombre_libre,cantidad_gramos,alimento_id,alimentos(nombre),recetas!receta_ingredientes_receta_id_fkey(nombre,estado)').range(f, f + 999)
  todas.push(...data)
  if (data.length < 1000) break
}
console.log(`Ingredientes revisados: ${todas.length}`)
const cambios = []
for (const x of todas) {
  const nl = norm(x.nombre_libre), de = norm(x.alimentos?.nombre)
  const regla = REGLAS.find(r => r.nl.test(nl) && r.de.test(de))
  if (regla) cambios.push({ x, regla })
}
const por = {}
cambios.forEach(c => { const k = `${c.x.recetas.estado}`; por[k] = (por[k] || 0) + 1 })
console.log(`Cambios: ${cambios.length}`, por)
cambios.forEach(({ x, regla }) => console.log(`- [${x.recetas.estado}] ${x.recetas.nombre} | ${x.nombre_libre} ${x.cantidad_gramos ?? '?'}g: ${x.alimentos?.nombre} → ${regla.a}`))
if (!APPLY) { console.log('\nSIMULACIÓN. Añade --apply.'); process.exit(0) }

writeFileSync('salidas/06-10-2026_backup-vinculos-sistemicos.json', JSON.stringify(cambios.map(c => ({ id: c.x.id, receta_id: c.x.receta_id, alimento_id_anterior: c.x.alimento_id })), null, 1))
const tocadas = new Set()
for (const { x, regla } of cambios) {
  const { error } = await db.from('receta_ingredientes').update({ alimento_id: (await A(regla.a)).id }).eq('id', x.id)
  if (error) console.log('❌', error.message); else tocadas.add(x.receta_id)
}
console.log('\n📊 Macros recalculadas:')
for (const id of tocadas) {
  const { data: rec } = await db.from('recetas').select('nombre,porciones,kcal').eq('id', id).single()
  const porciones = rec.porciones || 1
  const { data: ings } = await db.from('receta_ingredientes').select('cantidad_gramos, alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id', id)
  let k = 0, p = 0, c = 0, g = 0, fi = 0, peso = 0
  for (const i of ings) { const q = i.cantidad_gramos || 0; peso += q; const a = i.alimentos; if (!a) continue; k += (a.calorias || 0) * q / 100; p += (a.proteinas || 0) * q / 100; c += (a.carbohidratos || 0) * q / 100; g += (a.grasas || 0) * q / 100; fi += (a.fibra || 0) * q / 100 }
  const rd = v => Math.round(v / porciones * 10) / 10
  const m = { kcal: rd(k), proteinas: rd(p), carbohidratos: rd(c), grasas: rd(g), fibra: rd(fi), kcal_100g: peso > 0 ? Math.round(k / peso * 1000) / 10 : 0, peso_total_g: Math.round(peso) }
  console.log(`  ${rec.nombre}: ${Math.round(rec.kcal)} → ${m.kcal} kcal/ración`)
  await db.from('recetas').update(m).eq('id', id)
}

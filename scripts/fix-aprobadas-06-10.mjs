/**
 * fix-aprobadas-06-10.mjs — errores reales de vinculación/cantidad en recetas ya aprobadas, detectados en la auditoría del 06-10-2026.
 *   node scripts/fix-aprobadas-06-10.mjs            → simulación
 *   node scripts/fix-aprobadas-06-10.mjs --apply    → aplica (copia previa en salidas/) y recalcula macros
 * Parte A: reglas globales (cebolla "en polvo" de 30-150 g, extracto de vainilla de 30 g, queso fresco batido ↔ cottage).
 * Parte B: correcciones concretas por receta (ingredientes desplazados, nombres de producto en vez de ingrediente, cantidades de tanda).
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
const cache = {}
async function A(nombre) {
  if (cache[nombre]) return cache[nombre]
  const { data } = await db.from('alimentos').select('id,nombre').eq('nombre', nombre).eq('es_comestible', true).limit(1)
  if (!data?.length) throw new Error(`Alimento no encontrado: "${nombre}"`)
  return (cache[nombre] = data[0])
}

// Parte B: por nombre exacto de receta (puede haber copias). [buscar nombre_libre (empieza por), {g,n,a}]
const B = [
  { rec: ['Brócoli al vapor con salmón a la plancha y pimiento asado'], ings: [['brócoli', { a: 'Brócoli Manojo' }], ['pimiento asado', { a: 'Pimiento rojo' }], ['salmón fresco', { a: 'Filete salmon' }]] },
  { rec: ['Salmón fresco a la plancha con espinacas salteadas y quinoa melosa al limón', 'Salmón a la plancha con espinacas salteadas y quinoa melosa al limón'], ings: [['quinoa', { a: 'Quinoa' }], ['espinacas salteadas', { a: 'Espinacas frescas' }]] },
  { rec: ['Calabacín meloso con pollo a la plancha y tomate'], ings: [['calabacín', { a: 'Calabacín crudo' }]] },
  { rec: ['Pollo salteado con espinacas y lentejas al vinagre de Módena'], ings: [['arroz blanco', { n: 'Espinacas frescas' }], ['brócoli', { n: 'Lentejas cocidas' }]] },
  { rec: ['Merluza al vapor con patata y zanahoria'], ings: [['zanahoria cocida', { a: 'Zanahoria' }]] },
  { rec: ['Arroz vaporizado con pollo y calabacín al aceite de oliva'], ings: [['calabacín', { a: 'Calabacín crudo' }]] },
  { rec: ['Pollo Shawarma Crujiente'], ings: [['Daqui pii', { g: 20, n: 'Salsa de soja', a: 'Salsa de soja' }]] },
  { rec: ['Donuts Saludables Rellenos de Crema Kinder'], ings: [['Dulzante', { g: 10 }], ['Gotitas de sabor', { g: 3 }]] },
  { rec: ['Tiramisú Fit con Queso Fresco y Café'], ings: [['Soja texturizada', { g: 20 }]] },
  { rec: ['Salteado de pimiento, huevo y setas enoki'], ings: [['Setas enoki', { a: 'Setas' }]] },
  { rec: ['Ensalada de quinoa con aguacate y granada'], ings: [['Golosinas', { n: 'Granada', a: 'Granada' }]] },
  { rec: ['Mini sándwich de pavo y queso fresco en pan integral'], ings: [['Placas para canelones', { n: 'Pavo en lonchas', a: 'Pechuga de pavo finas lonchas' }]] },
  { rec: ['Blondis saludables'], ings: [['Pasta de maní', { n: 'Crema de cacahuete natural' }]] },
  { rec: ['Bollos de patata dulce saludables'], ings: [['Patata dulce', { n: 'Boniato cocido' }]] },
  { rec: ['Waffle de Papa Crujiente con Huevo Frito y Aguacate'], ings: [['Papa', { n: 'Patata' }]] },
  { rec: ['Healthy Shrimp Tacos con Mango y Chipotle'], ings: [['Camarones', { n: 'Gambas', a: 'Gambas' }]] },
  { rec: ['Mayonesa de camarón', 'Mayonesa de camarones'], porciones: 10, ings: [] },
  { rec: ['Donuts caseros esponjosos'], ings: [['Aceite de girasol', { g: 60 }]] },
]

const backup = []
const tocadas = new Set()
const log = []
const w = async (tabla, upd, id) => { if (APPLY) { const { error } = await db.from(tabla).update(upd).eq('id', id); if (error) console.log('   ❌', error.message) } }

// ---- Parte A: reglas globales
const todas = []
for (let f = 0; ; f += 1000) {
  const { data } = await db.from('receta_ingredientes')
    .select('id,receta_id,nombre_libre,cantidad_gramos,alimento_id,alimentos(nombre),recetas!receta_ingredientes_receta_id_fkey(nombre,estado)').range(f, f + 999)
  todas.push(...data)
  if (data.length < 1000) break
}
console.log('# Parte A — reglas globales')
for (const x of todas) {
  const nl = norm(x.nombre_libre), al = x.alimentos?.nombre || '', g = x.cantidad_gramos ?? 0
  const upd = {}
  if (/^cebolla en polvo$/.test(nl) && g >= 20) {
    if (/^cebolla/i.test(al) && !/polvo/i.test(al)) { upd.nombre_libre = al.replace(/ malla| peso.*/i, '') }
    else { upd.nombre_libre = 'Cebolla'; upd.alimento_id = (await A('Cebolla')).id }
  } else if (/^extracto de vainilla$|^esencia de vainilla$/.test(nl) && g > 20) upd.cantidad_gramos = 5
  else if (/queso (fresco|crema) batido/.test(nl) && /^cottage/i.test(al)) upd.alimento_id = (await A('Queso fresco batido 0%')).id
  if (Object.keys(upd).length) {
    const s = `[${x.recetas.estado}] ${x.recetas.nombre} | ${x.nombre_libre} ${g}g (${al}) → ${JSON.stringify({ ...upd, alimento_id: upd.alimento_id ? '(queso/cebolla genérico)' : undefined })}`
    console.log('- ' + s); log.push(s)
    backup.push({ tabla: 'receta_ingredientes', id: x.id, antes: { nombre_libre: x.nombre_libre, cantidad_gramos: x.cantidad_gramos, alimento_id: x.alimento_id } })
    await w('receta_ingredientes', upd, x.id); tocadas.add(x.receta_id)
  }
}

// ---- Parte B
console.log('\n# Parte B — correcciones concretas')
for (const b of B) {
  const { data: recs } = await db.from('recetas').select('id,nombre,estado,porciones').in('nombre', b.rec)
  for (const rec of recs) {
    const ings = todas.filter(i => i.receta_id === rec.id)
    for (const [buscar, set] of b.ings) {
      const hit = ings.find(i => norm(i.nombre_libre).startsWith(norm(buscar)))
      if (!hit) { console.log(`⚠ ${rec.nombre}: no encuentro "${buscar}"`); continue }
      const upd = {}
      if (set.g !== undefined) upd.cantidad_gramos = set.g
      if (set.n) upd.nombre_libre = set.n
      if (set.a) upd.alimento_id = (await A(set.a)).id
      const s = `[${rec.estado}] ${rec.nombre} | ${hit.nombre_libre} ${hit.cantidad_gramos}g (${hit.alimentos?.nombre}) → ${set.n ?? hit.nombre_libre} ${set.g ?? hit.cantidad_gramos}g${set.a ? ' [' + set.a + ']' : ''}`
      console.log('- ' + s); log.push(s)
      backup.push({ tabla: 'receta_ingredientes', id: hit.id, antes: { nombre_libre: hit.nombre_libre, cantidad_gramos: hit.cantidad_gramos, alimento_id: hit.alimento_id } })
      await w('receta_ingredientes', upd, hit.id)
    }
    if (b.porciones && rec.porciones !== b.porciones) {
      const s = `[${rec.estado}] ${rec.nombre} | porciones ${rec.porciones} → ${b.porciones}`
      console.log('- ' + s); log.push(s)
      backup.push({ tabla: 'recetas', id: rec.id, antes: { porciones: rec.porciones } })
      await w('recetas', { porciones: b.porciones }, rec.id)
    }
    tocadas.add(rec.id)
  }
}

// ---- Recalcular macros
console.log('\n📊 Macros recalculadas:')
for (const id of tocadas) {
  const { data: rec } = await db.from('recetas').select('nombre,porciones,kcal').eq('id', id).single()
  const porciones = APPLY ? rec.porciones || 1 : (B.find(b => b.rec.includes(rec.nombre))?.porciones ?? rec.porciones ?? 1)
  const { data: ings } = await db.from('receta_ingredientes').select('cantidad_gramos, alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id', id)
  let k = 0, p = 0, c = 0, g = 0, fi = 0, peso = 0
  for (const i of ings) { const q = i.cantidad_gramos || 0; peso += q; const a = i.alimentos; if (!a) continue; k += (a.calorias || 0) * q / 100; p += (a.proteinas || 0) * q / 100; c += (a.carbohidratos || 0) * q / 100; g += (a.grasas || 0) * q / 100; fi += (a.fibra || 0) * q / 100 }
  const rd = v => Math.round(v / porciones * 10) / 10
  const m = { kcal: rd(k), proteinas: rd(p), carbohidratos: rd(c), grasas: rd(g), fibra: rd(fi), kcal_100g: peso > 0 ? Math.round(k / peso * 1000) / 10 : 0, peso_total_g: Math.round(peso) }
  if (APPLY && Math.abs(m.kcal - rec.kcal) > 1) console.log(`  ${rec.nombre}: ${Math.round(rec.kcal)} → ${m.kcal} kcal/ración`)
  if (APPLY) await db.from('recetas').update(m).eq('id', id)
}
if (APPLY) {
  writeFileSync('salidas/06-10-2026_backup-aprobadas-antes-de-fix.json', JSON.stringify(backup, null, 1))
  writeFileSync('salidas/06-10-2026_log-fix-aprobadas.txt', log.join('\n'))
  console.log(`\nCambios: ${log.length} · copia previa: salidas/06-10-2026_backup-aprobadas-antes-de-fix.json`)
} else console.log(`\nSIMULACIÓN: ${log.length} cambios. Añade --apply.`)

/**
 * fix-revision-06-10.mjs — corrige las recetas en revisión con datos reales mal (06-10-2026).
 *   node scripts/fix-revision-06-10.mjs            → simulación (no escribe)
 *   node scripts/fix-revision-06-10.mjs --apply    → aplica
 * Cada operación: cambia cantidad/nombre/alimento vinculado de un ingrediente (por nombre_libre), añade ingredientes
 * que faltaban, descarta duplicados/no-recetas, y recalcula macros por ración. Guarda copia previa en salidas/.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APPLY = process.argv.includes('--apply')
const cache = {}
async function A(nombre) {
  if (cache[nombre]) return cache[nombre]
  const { data } = await db.from('alimentos').select('id,nombre').eq('nombre', nombre).eq('es_comestible', true).limit(1)
  if (!data?.length) throw new Error(`Alimento no encontrado: "${nombre}"`)
  return (cache[nombre] = data[0])
}

// i(buscar, { g: gramos, n: nombre_libre nuevo, a: alimento exacto })  ·  add(...)  ·  r.porciones / r.estado
const R = [
  { id: 'c88ec2df-85e1-42b1-92b4-eee731f7693a', nota: 'Ensalada de cuscús: cantidades por defecto de Instagram → realistas (1 ración)', ings: [
    ['Sal', { g: 2 }], ['Aguacate', { g: 80 }], ['Pimiento verde', { g: 50 }], ['Tomate', { g: 80 }], ['Cuscús', { g: 60 }],
    ['Maíz', { g: 50, n: 'Maíz dulce', a: 'Maíz dulce' }], ['Queso feta', { g: 30 }], ['Almendras', { g: 15 }], ['Pepino', { g: 40 }],
    ['Vinagre', { g: 8 }], ['Aceite de oliva virgen extra', { g: 10 }], ['Pimentón de la Vera', { g: 2 }] ] },
  { id: 'b06fe806-23c7-4378-870c-efb687b2959a', nota: 'Yema curada: sal y azúcar del curado casi no se ingieren', ings: [['Sal', { g: 2 }], ['Azúcar', { g: 2 }]] },
  { id: '7d0779eb-0c74-4035-8a99-b5002d025c2b', nota: 'Focaccia: cantidades de masa realistas, 4 raciones, levadura y romero bien vinculados', porciones: 4, ings: [
    ['Agua', { g: 190 }], ['Sal', { g: 5 }], ['Harina', { g: 250, n: 'Harina de trigo', a: 'Harina de trigo' }],
    ['Levadura', { g: 4, n: 'Levadura de panadería', a: 'Levadura de panadería' }], ['Flor de sal', { g: 2 }],
    ['Aceite de oliva', { g: 30 }], ['Romero fresco', { g: 4, a: 'Romero' }] ] },
  { id: '2660f1d0-e51c-4eea-acdf-a6de0d4c0d32', nota: 'Ensalada templada: lechugas bien vinculadas', ings: [['Mezcla de lechugas', { a: 'Lechuga iceberg cortada y lavada' }]] },
  { id: '032b7c79-3863-4679-857a-1120cf558c71', nota: 'Yogur bowl: yogur griego natural real', ings: [['Yogur griego natural 0%', { a: 'Yogur griego natural (0%)' }]] },
  { id: '0509ce01-fdc5-4888-a4fd-5608fd47c25f', nota: 'Brownie fit: vinculaciones genéricas correctas', ings: [
    ['Batata cocida', { n: 'Boniato cocido en puré', a: 'Boniato' }], ['Cacao puro', { a: 'Cacao puro en polvo' }], ['Crema de cacahuete', { a: 'Crema de cacahuete (sin azúcar)' }] ] },
  { id: '58797359-72af-41df-ba0c-35f1e2a440a6', nota: 'Cheesecake proteico: dátiles ≠ hueso vacuno, yogur natural real', ings: [
    ['Queso fresco batido', { a: 'Queso fresco batido 0%' }], ['Yogur griego natural 0%', { a: 'Yogur griego natural (0%)' }],
    ['Dátiles', { a: 'Dátiles medjool' }], ['Ralladura de limón', { a: 'Limón, ralladura' }] ] },
  { id: 'feeef635-f061-4544-a2cd-8509ca9bda55', nota: 'Tiramisú fit: yogur y café reales, bizcocho proteico', ings: [
    ['Queso fresco batido', { a: 'Queso fresco batido 0%' }], ['Café', { a: 'Café solo' }],
    ['Yogur griego natural 0%', { a: 'Yogur griego natural (0%)' }], ['Bizcochos', { a: 'Bizcocho de soja (producto proteico)' }] ] },
  { id: 'd45e50f3-0dce-41e6-8a2d-dda7d40a5fd7', nota: 'Lasaña: nuez moscada ≠ nuez con cáscara, tomate y queso fresco genéricos', ings: [
    ['Nuez moscada', { a: 'Nuez moscada molida' }], ['Tomate triturado', { a: 'Tomate triturado' }], ['Queso fresco batido', { a: 'Queso fresco batido 0%' }] ] },
  { id: 'ead0e91a-f2ec-4275-af3e-be626eb44c8f', nota: 'Ensalada pollo especiado: cantidades de 1 ración, arroz cocido y ketchup reales', ings: [
    ['Aguacate', { g: 80 }], ['Zumo de limón', { g: 20 }], ['Yogur natural', { g: 60 }],
    ['Arroz ya cocido', { g: 100, n: 'Arroz cocido', a: 'Arroz cocido redondo Sabroz' }], ['Canónigos', { g: 40 }], ['Pepino', { g: 40 }],
    ['Salsa de soja', { g: 10 }], ['Ketchup', { g: 15, a: 'Ketchup Cero Mas' }], ['Aceite de oliva', { g: 8 }] ] },
  { id: 'f597d946-b3bb-4f06-9c5e-90655397c273', nota: 'Wrap pavo: el nombre largo del hummus (con "limón") disparaba el gate', ings: [['Hummus', { n: 'Hummus' }]] },
  { id: '5ef686b6-172b-4b38-b714-a265346cd063', nota: 'Wraps pollo cúrcuma: ajo/hojas de lima absurdos, tortilla de trigo', ings: [
    ['Dientes de ajo', { g: 15 }], ['Hojas de lima', { g: 3 }], ['Tortillas de harina', { g: 240, n: 'Tortillas de trigo', a: 'Tortillas de Trigo Paquete' }], ['Lima', { g: 40 }] ] },
  { id: '5a5788f7-f384-4abe-99bb-4fc67483b7fd', nota: 'Duplicado de "Wraps de pollo con cúrcuma y hoja de lima" (mismo reel)', estado: 'descartada' },
  { id: '708d6ad8-9864-4725-b51d-c5991765b95e', nota: 'Café Mont Blanc: nata montada y café reales', ings: [
    ['Nata montada', { a: 'Nata para montar' }], ['Café cold brew', { a: 'Café solo' }] ] },
  { id: '9f694a98-f4c3-4b67-8081-32ad16a39cc6', nota: 'Sándwich Rubia Gallega: ingredientes de técnica a cantidades reales y vinculaciones', ings: [
    ['Ralladura de limón', { g: 3, a: 'Limón, ralladura' }], ['Rubia Gallega', { g: 160, a: 'Ternera Gallega de Guisar' }], ['Gracila', { g: 3 }],
    ['Azúcar', { g: 10 }], ['Pan brioche', { g: 120 }], ['Semillas de mostaza', { g: 20, a: 'Mostaza' }],
    ['Vinagre de Pedro Ximénez', { g: 8, a: 'Vinagre' }], ['Vinagre de sushi', { g: 8, a: 'Vinagre' }], ['Vinagre de cereza', { g: 8, a: 'Vinagre' }],
    ['Mantequilla clarificada', { g: 20 }] ] },
  { id: '0106124b-610e-4557-86fb-74417ee4b62a', nota: 'No es una receta (litros de leche y agua sin comida)', estado: 'descartada' },
  { id: 'b698d28e-4340-4718-bc0d-8178d11de501', nota: 'Tartitas Snickers: nata de coco, tortitas de arroz y proteína reales', ings: [
    ['Nata de coco', { n: 'Nata de coco montada', a: 'Leche de coco' }], ['Tortitas de arroz', { a: 'Tortitas de Arroz Integral Paquete' }],
    ['Proteína en polvo', { a: 'Proteína en polvo sabor vainilla' }] ] },
  { id: '6cfb5dff-9931-4d7c-ad24-2472a4a8636d', nota: 'Tortilla de claras: nombres con cantidad dentro ("250 gr champiñones") → cantidades reales, 2 raciones', porciones: 2, ings: [
    ['2 ajos', { g: 6, n: 'Ajo' }], ['Aceite oliva', { g: 10, n: 'Aceite de oliva' }], ["7 a '5 claras", { g: 210, n: 'Claras de huevo' }],
    ['250 gr champi', { g: 250, n: 'Champiñones laminados' }] ] },
  { id: '79ab3ecb-58a8-4b16-9437-1ef0d2704f1b', nota: 'Shakshuka: el pan de masa madre tenía 0 kcal en la BD (se corrige el alimento)', alimentoFix: { nombre: 'Barra Pan Masa Madre', set: { calorias: 255, proteinas: 8.5, carbohidratos: 50, grasas: 1.2, fibra: 2.5, es_comestible: true } } },
  { id: '15a7e720-ddc2-4071-90ee-a736c7c76360', nota: 'Natillas de coco: leche de coco y huevos (estaban vinculados a cereales y spaghetti)', ings: [
    ['Cereales cubiertos', { n: 'Leche de coco', a: 'Leche de coco' }], ['Spaghetti huevo', { n: 'Huevos', a: 'Huevo entero, crudo' }] ] },
  { id: '8e439b80-040e-4524-b0dd-0e000d48ccc6', nota: 'Curry de garbanzos: leche de coco (estaba vinculada a cereales), cebolla real, tomate triturado', ings: [
    ['Cereales cubiertos', { g: 200, n: 'Leche de coco', a: 'Leche de coco' }], ['Cebolla en polvo', { g: 150, n: 'Cebolla', a: 'Cebolla' }],
    ['Salsa de tomate Zero', { n: 'Tomate triturado', a: 'Tomate triturado' }], ['Sal de ajo', { g: 3 }] ] },
  { id: '2bfa4929-d979-4244-8876-f9e8bd169941', nota: 'Buddha bowl: arroz COCIDO (estaba el arroz crudo, 355 kcal/100 g)', ings: [['Arroz basmati cocido', { a: 'Arroz cocido basmati Sabroz' }]] },
  { id: '7c10dc91-76d4-49da-a7cd-9c5d85d54ea8', nota: 'Burrito bowl: arroz cocido y yogur natural real', ings: [
    ['Arroz basmati cocido', { a: 'Arroz cocido basmati Sabroz' }], ['Yogur griego natural 0%', { a: 'Yogur griego natural (0%)' }] ] },
  { id: '5ad63548-1799-49db-9d3b-d8ec8c44c506', nota: 'Canelón de arroz: faltaban arroz, aceite, yogur y cebollino (extracción incompleta)', add: [
    ['Arroz', 'Arroz', 135], ['Aceite de oliva', 'Aceite de oliva', 12], ['Yogur griego natural 0%', 'Yogur griego natural (0%)', 120], ['Cebollino', 'Cebollino', 3] ] },
]

const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const backup = []
const tocadas = new Set()

for (const r of R) {
  const { data: rec } = await db.from('recetas').select('id,nombre,estado,porciones').eq('id', r.id).single()
  if (!rec) { console.log(`✗ no existe ${r.id}`); continue }
  console.log(`\n# ${rec.nombre}\n  ${r.nota}`)
  const { data: ings } = await db.from('receta_ingredientes').select('id,nombre_libre,cantidad_gramos,alimento_id,orden').eq('receta_id', r.id)
  backup.push({ receta: rec, ingredientes: ings })

  if (r.alimentoFix) {
    const { data: al } = await db.from('alimentos').select('id,calorias').eq('nombre', r.alimentoFix.nombre).single()
    console.log(`  alimento "${r.alimentoFix.nombre}": ${al.calorias} kcal → ${r.alimentoFix.set.calorias}`)
    if (APPLY) await db.from('alimentos').update(r.alimentoFix.set).eq('id', al.id)
  }
  for (const [buscar, set] of r.ings ?? []) {
    const hit = ings.find(i => norm(i.nombre_libre).startsWith(norm(buscar)))
    if (!hit) { console.log(`  ⚠ no encuentro ingrediente que empiece por "${buscar}"`); continue }
    const upd = {}
    if (set.g !== undefined) upd.cantidad_gramos = set.g
    if (set.n) upd.nombre_libre = set.n
    if (set.a) upd.alimento_id = (await A(set.a)).id
    console.log(`  · ${hit.nombre_libre} ${hit.cantidad_gramos}g → ${upd.nombre_libre ?? hit.nombre_libre} ${upd.cantidad_gramos ?? hit.cantidad_gramos}g${set.a ? ' [' + set.a + ']' : ''}`)
    if (APPLY) { const { error } = await db.from('receta_ingredientes').update(upd).eq('id', hit.id); if (error) console.log('    ❌', error.message) }
  }
  let orden = Math.max(0, ...ings.map(i => i.orden ?? 0))
  for (const [nombre, alimento, g] of r.add ?? []) {
    console.log(`  + ${nombre} ${g}g [${alimento}]`)
    if (APPLY) { const { error } = await db.from('receta_ingredientes').insert({ receta_id: r.id, alimento_id: (await A(alimento)).id, nombre_libre: nombre, cantidad_gramos: g, orden: ++orden }); if (error) console.log('    ❌', error.message) }
  }
  const upd = {}
  if (r.porciones) upd.porciones = r.porciones
  if (r.estado) upd.estado = r.estado
  if (Object.keys(upd).length) { console.log(`  receta: ${JSON.stringify(upd)}`); if (APPLY) await db.from('recetas').update(upd).eq('id', r.id) }
  if (!r.estado) tocadas.add(r.id)
}

// Recalcular macros por ración de las recetas tocadas (y que siguen vivas)
console.log('\n📊 Macros recalculadas:')
for (const id of tocadas) {
  const { data: rec } = await db.from('recetas').select('nombre,porciones,kcal').eq('id', id).single()
  const porciones = (R.find(x => x.id === id)?.porciones) || rec.porciones || 1
  const { data: ings } = await db.from('receta_ingredientes').select('cantidad_gramos, alimentos(calorias,proteinas,carbohidratos,grasas,fibra)').eq('receta_id', id)
  let k = 0, p = 0, c = 0, g = 0, f = 0, peso = 0
  for (const i of ings) { const q = i.cantidad_gramos || 0; peso += q; const a = i.alimentos; if (!a) continue; k += (a.calorias || 0) * q / 100; p += (a.proteinas || 0) * q / 100; c += (a.carbohidratos || 0) * q / 100; g += (a.grasas || 0) * q / 100; f += (a.fibra || 0) * q / 100 }
  const rd = x => Math.round(x / porciones * 10) / 10
  const macros = { kcal: rd(k), proteinas: rd(p), carbohidratos: rd(c), grasas: rd(g), fibra: rd(f), kcal_100g: peso > 0 ? Math.round(k / peso * 1000) / 10 : 0, peso_total_g: Math.round(peso) }
  console.log(`  ${rec.nombre}: ${Math.round(rec.kcal)} → ${macros.kcal} kcal/ración (P ${macros.proteinas} · C ${macros.carbohidratos} · G ${macros.grasas})`)
  if (APPLY) await db.from('recetas').update(macros).eq('id', id)
}
if (APPLY) { writeFileSync('salidas/06-10-2026_backup-revision-antes-de-fix.json', JSON.stringify(backup, null, 1)); console.log('\nCopia previa: salidas/06-10-2026_backup-revision-antes-de-fix.json') }
else console.log('\nSIMULACIÓN (no se ha escrito nada). Añade --apply.')

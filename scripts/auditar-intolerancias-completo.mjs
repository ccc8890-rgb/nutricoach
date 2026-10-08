/**
 * auditar-intolerancias-completo.mjs
 * Compara las etiquetas de `intolerancias` de CADA receta con sus ingredientes.
 *   node scripts/auditar-intolerancias-completo.mjs            # informe (no cambia nada)
 *   node scripts/auditar-intolerancias-completo.mjs --aplica   # corrige + copia en salidas/
 * Corrige solo lo seguro:
 *   1. Añade el alérgeno positivo (Huevos, Gluten…) si algún ingrediente lo contiene.
 *   2. Quita «Sin X» cuando la receta SÍ contiene X (etiqueta falsa).
 *   3. Quita «Vegano»/«Vegetariano» si hay producto animal.
 * Lo dudoso (avena, exceso de etiquetas) solo se informa.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const APLICA = process.argv.includes('--aplica')

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

// Cada regla se evalúa sobre el nombre de UN ingrediente (normalizado). `no` = exclusiones.
const LECHE_VEG = /mantequilla de (mani|cacahuete|almendra|anacardo|avellana|coco|karite|pistacho)|(leche|bebida|crema|yogur|queso|mantequilla|nata) (de |vegetal)?(almendra|avena|soja|coco|arroz|anacardo|cacahuete|avellana|vegetal|vegano)/
const REGLAS = {
  Gluten: { re: /\b(trigo|pan|panko|pan rallado|rebozador|espagueti|espaguetis|macarron|macarrones|fideo|fideos|pasta (integral|fresca|de trigo)|pasta$|cuscus|seitan|cebada|centeno|espelta|bulgur|semola|galleta|galletas|tortilla de trigo|tortilla de harina|wrap|tagliatelle|tallarines|ramen|udon|canelones|ravioli|raviolis|gnocchi|empanadilla|lasana|croissant|bizcocho|magdalena|cerveza)\b/, no: /sin gluten|konjac|shirataki|mozzarella|queso|wasabi|pan rallado de arroz|pan de arroz|noodles de arroz|harina de (arroz|almendra|coco|garbanzo|maiz|avena sin)|pan de maiz|pasta de (curry|tomate|dientes|aji|miso|sesamo|trufa|pimiento|anchoa|cacahuete|almendra|avellana)|pasta de legumbres|pasta de (arroz|lenteja|garbanzo)|noodles de arroz/ },
  Huevos: { re: /\b(huevo|huevos|clara|claras|yema|yemas|mayonesa|alioli|merengue)\b/, no: /huevo vegano|sustituto de huevo|polvo de hornear/ },
  Lácteos: { re: /\b(yogur|yogures|queso|quesos|mantequilla|nata|kefir|requeson|ricotta|mozzarella|parmesano|cheddar|gruyere|cottage|skyr|whey|suero|caseina|leche|lactosa|helado|mascarpone|burrata|feta|provolone|emmental|philadelphia)\b/, no: LECHE_VEG },
  'Frutos Secos': { re: /\b(almendra|almendras|nuez|nueces|avellana|avellanas|anacardo|anacardos|pistacho|pistachos|macadamia|pecana|pacana|pinones|frutos secos|praline|mazapan|turron)\b/, no: /nuez moscada|leche de (almendra|avellana)|bebida de (almendra|avellana)/ },
  Cacahuetes: { re: /\b(cacahuete|cacahuetes|mani|crema de cacahuete|mantequilla de cacahuete)\b/ },
  Soja: { re: /\b(soja|tofu|tempeh|edamame|miso|tamari|lecitina de soja)\b/ },
  Pescado: { re: /\b(salmon|atun|merluza|bacalao|dorada|lubina|sardina|sardinas|anchoa|anchoas|trucha|pez espada|lenguado|rodaballo|rape|boqueron|boquerones|caballa|bonito|halibut|mero|corvina|jurel|cazon|pescado|surimi|caviar|mojama)\b/ },
  Crustáceos: { re: /\b(gamba|gambas|langostino|langostinos|camaron|camarones|cangrejo|necora|bogavante|langosta|cigala|marisco|mariscos)\b/ },
  Moluscos: { re: /\b(mejillon|mejillones|almeja|almejas|berberecho|berberechos|pulpo|calamar|calamares|sepia|chipiron|vieira|vieiras|navaja|ostra|ostras|caracol)\b/ },
  Sésamo: { re: /\b(sesamo|tahini|tahin|ajonjoli|hummus)\b/ },
  Mostaza: { re: /\b(mostaza)\b/ },
  Sulfitos: { re: /\b(vino|vinagre de vino|vermut|sidra)\b/ },
}
const CARNE = /\b(pollo|pavo|ternera|cerdo|cordero|carne|pechuga|muslo|costilla|buey|jamon|bacon|beicon|panceta|chorizo|salchicha|salchichon|morcilla|fuet|longaniza|sobrasada|butifarra|tocino|lomo|solomillo|hamburguesa|picada|atun|salmon)\b/
const ANIMAL_NO_VEGANO = /\b(miel|gelatina|colageno)\b/
// «Sin X» legado ↔ positivo
const NEG = { 'Sin Gluten': 'Gluten', 'Sin Huevo': 'Huevos', 'Sin Lactosa': 'Lácteos', 'Sin Lácteos': 'Lácteos', 'Sin Frutos Secos': 'Frutos Secos', 'Sin Soja': 'Soja', 'Sin Pescado': 'Pescado', 'Sin Mariscos': ['Crustáceos', 'Moluscos'] }

async function todo(tabla, cols) {
  const out = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(tabla).select(cols).range(f, f + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break } return out
}
const recetas = await todo('recetas', 'id,nombre,estado,intolerancias')
const alimentos = new Map((await todo('alimentos', 'id,nombre')).map(a => [a.id, a.nombre]))
const ings = await todo('receta_ingredientes', 'receta_id,alimento_id,nombre_libre')
const porReceta = new Map()
for (const i of ings) { (porReceta.get(i.receta_id) ?? porReceta.set(i.receta_id, []).get(i.receta_id)).push(norm(i.nombre_libre || alimentos.get(i.alimento_id))) }
// Para no fiarnos solo del nombre libre, miramos también el nombre del alimento vinculado
for (const i of ings) if (i.alimento_id && i.nombre_libre) porReceta.get(i.receta_id).push(norm(alimentos.get(i.alimento_id)))

const disparos = {}
const cuenta = { add: {}, quitaSin: {}, quitaVeg: {}, avena: 0, sinIngredientes: 0 }
const cambios = []
for (const r of recetas) {
  const nombres = (porReceta.get(r.id) ?? []).filter(Boolean)
  if (!nombres.length) { cuenta.sinIngredientes++; continue }
  const actual = r.intolerancias ?? []
  let nuevo = [...actual]
  const detectado = new Set()
  for (const [tag, { re, no }] of Object.entries(REGLAS)) {
    if (nombres.some(n => re.test(n) && !(no && no.test(n)))) detectado.add(tag)
  }
  const nota = []
  for (const t of detectado) if (!nuevo.includes(t)) {
    const { re, no } = REGLAS[t]; for (const n of nombres) if (re.test(n) && !(no && no.test(n))) { const k = t + ' ← ' + n; disparos[k] = (disparos[k] || 0) + 1 }
    nuevo.push(t); nota.push('+' + t); cuenta.add[t] = (cuenta.add[t] || 0) + 1 }
  for (const [neg, pos] of Object.entries(NEG)) {
    if (nuevo.includes(neg) && [].concat(pos).some(p => detectado.has(p))) { nuevo = nuevo.filter(x => x !== neg); nota.push('-' + neg); cuenta.quitaSin[neg] = (cuenta.quitaSin[neg] || 0) + 1 }
  }
  for (const raro of ['Apto Diabéticos']) if (nuevo.includes(raro)) { nuevo = nuevo.filter(x => x !== raro); nota.push('-' + raro) } // etiqueta no estándar
  nuevo = nuevo.map(x => x.replace(/\s*\(.*\)\s*$/, '')).filter((x, i, a) => a.indexOf(x) === i)
  const hayCarne = nombres.some(n => CARNE.test(n)) || detectado.has('Pescado') || detectado.has('Crustáceos') || detectado.has('Moluscos')
  const hayAnimal = hayCarne || detectado.has('Lácteos') || detectado.has('Huevos') || nombres.some(n => ANIMAL_NO_VEGANO.test(n))
  if (nuevo.includes('Vegetariano') && hayCarne) { nuevo = nuevo.filter(x => x !== 'Vegetariano'); nota.push('-Vegetariano'); cuenta.quitaVeg.Vegetariano = (cuenta.quitaVeg.Vegetariano || 0) + 1 }
  if (nuevo.includes('Vegano') && hayAnimal) { nuevo = nuevo.filter(x => x !== 'Vegano'); nota.push('-Vegano'); cuenta.quitaVeg.Vegano = (cuenta.quitaVeg.Vegano || 0) + 1 }
  if (nombres.some(n => /\bavena\b/.test(n)) && !nuevo.includes('Gluten')) cuenta.avena++
  if (nota.length) cambios.push({ id: r.id, nombre: r.nombre, estado: r.estado, antes: actual, despues: nuevo, nota })
}
console.log('Recetas:', recetas.length, '| sin ingredientes (no analizadas):', cuenta.sinIngredientes, '| con cambios:', cambios.length)
console.log('Etiquetas a AÑADIR :', cuenta.add)
console.log('«Sin X» falsos a QUITAR:', cuenta.quitaSin)
console.log('Vegano/Vegetariano a QUITAR:', cuenta.quitaVeg)
console.log('Con avena y sin tag Gluten (solo informe):', cuenta.avena)
if (process.argv.includes('--disparos')) { for (const [k, v] of Object.entries(disparos).sort()) console.log(String(v).padStart(3), k); process.exit(0) }
console.log('\nMuestra:'); for (const c of cambios.slice(0, 40)) console.log('-', c.nombre.slice(0, 45).padEnd(46), c.nota.join(' '))
fs.mkdirSync('salidas', { recursive: true })
if (APLICA && cambios.length) {
  const copia = `salidas/copia-intolerancias-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  fs.writeFileSync(copia, JSON.stringify(cambios, null, 1))
  console.log('Copia antes/después:', copia)
  for (const c of cambios) { const { error } = await sb.from('recetas').update({ intolerancias: c.despues }).eq('id', c.id); if (error) console.log('ERROR', c.nombre, error.message) }
  console.log('\nAplicado en', cambios.length, 'recetas. ')
}

/**
 * piloto-ia-realista.mjs — piloto de fotos IA fieles a la receta y sin aspecto "IA".
 * NO toca Supabase ni Cloudinary: solo guarda en salidas/piloto-ia-realista/ + panel HTML.
 *
 *   node scripts/piloto-ia-realista.mjs            → lista las 10 recetas y el prompt (no gasta)
 *   node scripts/piloto-ia-realista.mjs --genera   → genera (~0,034 $/img, medium)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const GENERA = process.argv.includes('--genera')
const SALIDA = 'salidas/piloto-ia-realista-v3'

const NOMBRES = [
  'Tostada de pan de centeno con aguacate y tomate', 'Pollo teriyaki con arroz integral',
  'Macarrones con carne picada y tomate casero', 'Tiramisú Fit con Queso Fresco y Café',
  'Tortilla española de patata con cebolla', 'Muffin de proteína chocolate-plátano',
  'Arroz con salmón y espárragos trigueros', 'Protein Choco pudding',
  'Bowl de Queso Fresco con Arándanos y Miel', 'Verduras asadas al horno con hummus y pan integral',
]

// Plato/contexto según tipo de receta (criterio visual 21-05-2026)
function escena(r) {
  const n = r.nombre.toLowerCase()
  if (/tostada|tosta/.test(n)) return 'a slice of rustic wholegrain sourdough on a plain plate, aiming for natural uneven toppings'
  if (/muffin|bizcocho|brownie|barrita|galleta/.test(n)) return 'on baking paper on a plain plate, irregular cuts and crumbs, matte texture, slightly uneven baking'
  if (/pudding|tiramis|mousse|natilla|yogur|bowl/.test(n)) return 'in a simple glass or plain ceramic bowl, natural uneven surface, matte not glossy'
  if (/macarron|arroz|pollo|tortilla|verdura/.test(n)) return 'on a plain home plate (white or grey ceramic), generous home portion, slightly messy sauce edges'
  return 'on a plain home plate'
}

// Descripción visual explícita cuando el nombre/ingredientes confunden a la IA
function visual(r) {
  const n = r.nombre.toLowerCase()
  if (/tiramis/.test(n)) return 'Presented as a tiramisu in a clear glass: visible layers of pale cream and a darker coffee-soaked base, dusted with cocoa on top. Not minced meat, not cottage cheese.'
  if (/muffin/.test(n)) return 'Two or three real muffins with domed tops, in a paper muffin liner, one broken open to show a moist crumb with banana pieces.'
  if (/tortilla/.test(n)) return 'A wedge of Spanish potato omelette, golden outside, soft and slightly juicy inside, visible layers of sliced potato and onion bound with egg (not rice-like).'
  if (/teriyaki/.test(n)) return 'Glazed chicken pieces with teriyaki sauce next to whole-grain brown rice (long, separate, slightly tan grains, clearly rice, not couscous), a few sesame seeds.'
  if (/bowl de queso fresco/.test(n)) return 'Smooth creamy fresh cheese (soft, white, spoonable like thick yogurt, not crumbled feta) topped with blueberries, a drizzle of honey and a spoon of almond paste.'
  return ''
}

// Toque final de emplatado: una decoración pequeña, comestible y coherente con el plato
function decoracion(r) {
  const n = r.nombre.toLowerCase()
  if (/tiramis|pudding|mousse|natilla|brownie|tarta|chocolate|choco|muffin|bizcocho|donut|galleta/.test(n)) return 'finishing touch: fine dark chocolate shavings or curls over the top (and a light dusting of cocoa), tastefully applied'
  if (/bowl.*(queso|yogur|arándano)|yogur|queso fresco|overnight|porridge|smoothie/.test(n)) return 'finishing touch: a few mint leaves or a sprinkle of toasted almond flakes, tastefully applied'
  if (/tostada|tosta|aguacate/.test(n)) return 'finishing touch: a sprinkle of mixed black and white sesame seeds and a small pinch of microgreens or sprouts on top'
  if (/pollo|teriyaki|salmón|salmon|arroz|atún|pescado/.test(n)) return 'finishing touch: black and white sesame seeds and a few fresh microgreens or finely sliced spring onion on top'
  if (/macarron|pasta|carne|tortilla|huevo/.test(n)) return 'finishing touch: a little chopped fresh parsley or basil and a few shavings of parmesan or a drizzle of olive oil'
  if (/verdura|ensalada|hummus/.test(n)) return 'finishing touch: a sprinkle of sesame seeds, a few sprouts and a light drizzle of olive oil'
  return 'finishing touch: a small fresh herb or seed garnish suited to the dish'
}

function prompt(r, ings) {
  return `Casual smartphone photo of "${r.nombre}", home-cooked by a Spanish person in their own kitchen.
The dish contains ONLY these ingredients, in realistic proportions (quantities are for the whole recipe; show ONE normal serving): ${ings}. Do not add any other main food or topping that is not in this list. The only exception is one small decorative garnish described below.
${visual(r)}
Garnish: ${decoracion(r)}. Keep it small and natural, like a home cook adding a final touch, not overloaded.
Served ${escena(r)}.
Level: cooked and plated by someone who really knows how to cook, at home, on a good day: careful but unfussy plating. Clean plate edges, balanced portions, sensible arrangement with height and contrast of colours, food cooked properly (well browned, correct texture, fresh and appetising), neat sauces, nice handmade-looking neutral ceramic tableware in good condition. Not restaurant fine-dining and not student-cooking sloppy.
Look: shot with a recent iPhone, slight angle (about 45 degrees), soft natural daylight from a window, accurate white balance, slight depth of field. Clean wooden table or stone counter, tidy and mostly out of focus. Real textures, matte surfaces, no glossy sheen.
Strictly avoid: studio lighting, food-magazine styling, stock-photo look, 3D render, CGI, plastic or waxy look, oversaturated colours, perfect symmetry, messy or smeared plates, burnt or raw-looking food, decorative props (no flowers, no edible flowers, napkins, cutlery staging, small bowls of ingredients, ingredient still-life behind the dish), text, logos, hands, people.
Square 1:1.`
}

async function generar(p) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1.5', prompt: p, n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
  })
  const j = await res.json()
  if (!res.ok) throw new Error(j.error?.message || `HTTP ${res.status}`)
  return Buffer.from(j.data[0].b64_json, 'base64')
}

const { data: recetas } = await db.from('recetas')
  .select('id,nombre,tipo_plato,descripcion,receta_ingredientes!receta_ingredientes_receta_id_fkey(*)')
  .in('nombre', NOMBRES)
mkdirSync(SALIDA, { recursive: true })
const filas = []
for (const r of recetas) {
  const ings = (r.receta_ingredientes || []).map(i => {
    const g = i.cantidad_gramos ?? i.cantidad
    return i.nombre_libre ? (g ? `${i.nombre_libre} (${Math.round(g)} g)` : i.nombre_libre) : null
  }).filter(Boolean).filter(x => !/^(sal|pimienta|edulcorante|levadura|comino|orégano|sal de ajo|jengibre)\b/i.test(x)).join(', ')
  const p = prompt(r, ings)
  const file = `${r.id.slice(0, 8)}.jpg`
  console.log(`\n# ${r.nombre}\n  ingredientes: ${ings}`)
  let err = null
  if (GENERA) {
    try { writeFileSync(`${SALIDA}/${file}`, await generar(p)); console.log('  ✓ generada') }
    catch (e) { err = e.message; console.log('  ✗', err); if (/billing|quota|insufficient/i.test(err)) break }
  }
  filas.push({ r, ings, file: err ? null : (GENERA ? file : null), err })
}
if (GENERA) {
  const html = `<!doctype html><meta charset=utf-8><title>Piloto IA realista</title><style>body{font:14px system-ui;margin:16px;background:#111;color:#eee}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}.c{background:#1c1c1c;padding:10px;border-radius:10px}img{width:100%;border-radius:8px}small{color:#aaa}</style><div class=g>${filas.map(f => `<div class=c>${f.file ? `<img src="${f.file}">` : `<p>${f.err}</p>`}<b>${f.r.nombre}</b><br><small>${f.ings}</small></div>`).join('')}</div>`
  writeFileSync(`${SALIDA}/panel.html`, html)
  console.log(`\nPanel: ${SALIDA}/panel.html`)
}

/**
 * generar-lote-fotos-ia.mjs — fotos IA realistas y fieles para recetas aprobadas SIN foto.
 * Genera en LOCAL (salidas/fotos-ia-lote-N/) + panel.html para aprobar. NO toca Supabase ni Cloudinary.
 * Subida de las aprobadas: scripts/subir-lote-fotos-ia.mjs
 *
 *   node scripts/generar-lote-fotos-ia.mjs --lote=1            → lista (no gasta)
 *   node scripts/generar-lote-fotos-ia.mjs --lote=1 --genera   → genera (~0,034 $/img, medium)
 *   --tam=50 (recetas por lote)  --ids=id1,id2 (regenerar concretas, sobrescribe)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'

for (const l of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const arg = (k, d) => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1] ?? d
const GENERA = process.argv.includes('--genera')
const LOTE = Number(arg('lote', 1)), TAM = Number(arg('tam', 50))
const IDS = arg('ids', '')?.split(',').filter(Boolean)
const RONDA = arg('ronda', '1'), SUF = RONDA === '1' ? '' : `-r${RONDA}`
const SALIDA = `salidas/fotos-ia-lote-${LOTE}`

// ── Tipos de plato: descripción visual + recipiente + decoración (solo comestibles neutros) ──
const DULCE = 'finishing touch: fine dark chocolate shavings or curls and a light dusting of cocoa on top'
const CATS = [
  [/palitos de|crudit|bastones|apio con/, { v: 'Raw vegetable sticks arranged neatly on a plate next to a small bowl of the dip.', e: 'on a plain plate', g: 'finishing touch: none, or a tiny pinch of paprika on the dip' }],
  [/tortitas de arroz/, { v: 'Two or three round rice cakes spread with jam and topped with yogurt and banana slices.', e: 'on a plain plate', g: 'finishing touch: none, or a light dusting of cinnamon' }],
  [/tiramis/, { v: 'Presented as a tiramisu in a clear glass: visible layers of pale cream and a darker coffee-soaked base, dusted with cocoa. Not minced meat, not cottage cheese.', e: 'in a clear glass or small glass jar', g: DULCE }],
  [/muffin|magdalena|cupcake/, { v: 'Two or three real muffins with domed tops in paper liners, one broken open to show a moist crumb.', e: 'on baking paper on a plain plate', g: DULCE }],
  [/donut|dónut|rosquilla/, { v: 'Two or three baked donuts with a hole, soft and slightly irregular, with a thin glaze.', e: 'on a plain plate', g: DULCE }],
  [/brownie|blondie|bizcocho|bizcochitos|cake|pastel|tarta de (zanahoria|manzana|calabaza)|banana bread|plum/, { v: 'A neat slice or squares with a moist, slightly irregular crumb, visible cut cross-section.', e: 'on baking paper on a plain plate', g: DULCE }],
  [/cheesecake|tarta|pie\b/, { v: 'A clean slice of tart showing its layers, on a plate.', e: 'on a plain plate', g: DULCE }],
  [/galleta|cookie|barrita|barritas|bolas|trufa|bombon|energy|bites|granola/, { v: 'Several pieces with irregular home-made shapes, matte, visible texture (oats, chocolate chunks).', e: 'on baking paper on a plain plate', g: DULCE }],
  [/mousse|pudding|natilla|flan|crema de (chocolate|cacao)|copa|vasito|gelatina/, { v: 'Smooth set dessert with a soft matte surface.', e: 'in a clear glass or small plain ceramic bowl', g: DULCE }],
  [/helado|nice cream|polo|sorbete/, { v: 'Two scoops of home-made ice cream with a creamy matte texture, slightly melting at the edge.', e: 'in a small plain bowl', g: DULCE }],
  [/tortita|pancake|gofre|waffle|crepe|crêpe|crepé/, { v: 'A neat stack of soft pancakes/waffles/crepes with a little topping.', e: 'on a plain plate', g: 'finishing touch: a light dusting of cocoa or a few fresh berries and a little chocolate shavings' }],
  [/overnight|porridge|avena|skyr|yogur|queso fresco|requesón|kefir|bowl de fruta|açaí|acai/, { v: 'Creamy base with the fruit and toppings arranged on top, spoonable texture (not crumbled).', e: 'in a plain ceramic bowl or glass jar', g: 'finishing touch: a few fresh mint leaves or a sprinkle of oat flakes or coconut flakes' }],
  [/batido|smoothie|zumo|bebida|café|latte|chocolate caliente/, { v: 'A tall glass of the drink, natural colour (not neon), a straw is optional.', e: 'in a simple tall glass', g: 'finishing touch: a few fresh berries or a dusting of cocoa on top, optional mint leaf' }],
  [/tostada|tosta\b|tostas|pan con|bruschetta|torrija/, { v: 'One or two slices of rustic wholegrain bread with the toppings arranged neatly.', e: 'on a plain plate', g: 'finishing touch: a sprinkle of mixed black and white sesame seeds and a pinch of microgreens or sprouts' }],
  [/wrap|burrito|taco|fajita|bocadillo|sándwich|sandwich|bocata|hamburguesa|burger|kebab|pita|empanada/, { v: 'The handheld item cut in half to show the filling, neatly assembled.', e: 'on a plain plate, with a small side if listed', g: 'finishing touch: a little chopped fresh parsley or a pinch of sesame seeds' }],
  [/ensalada|ensaladilla|poke|bowl/, { v: 'Fresh, colourful, ingredients arranged in sections with some height.', e: 'in a wide plain ceramic bowl', g: 'finishing touch: a sprinkle of black and white sesame seeds, a few sprouts and a light drizzle of olive oil' }],
  [/macarron|espagueti|pasta|tallar|lasa|fideo|noodle|ñoqui|canel[oó]n|rigatoni|penne|raviol/, { v: 'Cooked pasta with the sauce well mixed in, as home-cooked. If macaroni: short curved elbow macaroni.', e: 'in a wide plate or shallow pasta bowl', g: 'finishing touch: a little chopped fresh parsley or basil and a drizzle of olive oil' }],
  [/arroz|risotto|paella|cuscús|couscous|quinoa|bulgur/, { v: 'Grain dish with proteins arranged on top or side. If egg is listed, it is a whole fried egg on top, not mixed into the grain.', e: 'on a plain plate or shallow bowl', g: 'finishing touch: black and white sesame seeds and a few fresh microgreens or finely sliced spring onion' }],
  [/lenteja|garbanzo|alubia|judía|cocido|guiso|estofado|crema de (puerro|calabaza|verdura|champi|zanahoria|guisantes|espinaca|tomate)|sopa|caldo|potaje|curry|chili/, { v: 'Home-made thick stew or soup, rustic, steaming slightly.', e: 'in a deep plain ceramic bowl', g: 'finishing touch: a little chopped parsley and a drizzle of olive oil, a pinch of paprika' }],
  [/salmón|salmon|merluza|bacalao|atún|pescado|lubina|dorada|gambas|boquerones|sardina|pulpo|calamar/, { v: 'Fish cooked properly: golden-seared or roasted, flaky, with the sides arranged next to it.', e: 'on a plain plate', g: 'finishing touch: black and white sesame seeds and a few microgreens, or a thin lemon zest' }],
  [/pollo|pavo|ternera|cerdo|solomillo|carne|albóndiga|lomo|pechuga|filete|costilla|conejo|cordero/, { v: 'Meat cooked properly: well browned, juicy, sliced or whole, sauce neat, with sides arranged next to it.', e: 'on a plain plate', g: 'finishing touch: a little chopped fresh parsley and a pinch of sesame seeds or black pepper' }],
  [/tortilla|huevo|revuelto|omelette|shakshuka|poché|frittata/, { v: 'Egg dish cooked properly, golden outside and soft inside.', e: 'on a plain plate', g: 'finishing touch: a little chopped parsley or chives and a drizzle of olive oil' }],
  [/hummus|verdura|calabac|berenjena|brócoli|espárrago|patata|boniato|champi|guarnición|gajos|puré|crema de verduras|setas/, { v: 'Vegetable dish roasted or sautéed with nice colour, arranged neatly.', e: 'on a plain plate', g: 'finishing touch: a sprinkle of sesame seeds, a few sprouts and a light drizzle of olive oil' }],
]
const FALLBACK = { v: '', e: 'on a plain plate or bowl', g: 'finishing touch: a small pinch of fresh herb or seeds suited to the dish' }
const SIN_ALIMENTO = /^(sal|pimienta|edulcorante|levadura|comino|orégano|jengibre|agua|canela|vainilla|extracto|colorante)\b/i

const cat = n => (CATS.find(([re]) => re.test(n.toLowerCase())) ?? [null, FALLBACK])[1]
const hash = id => parseInt(id.replace(/-/g, '').slice(0, 8), 16)
const pick = (arr, h, k) => arr[(h >> k) % arr.length]
const PLATOS = ['a plain matte white porcelain plate', 'a dark grey stoneware plate', 'a speckled beige ceramic plate with an irregular rim', 'a wide shallow terracotta-toned glazed plate', 'a blue-grey glazed ceramic plate', 'an everyday white plate with a thin coloured rim', 'a round light wooden board with the food directly on it']
const CUENCOS = ['a white ceramic bowl', 'a dark green glazed bowl', 'a grey stoneware bowl', 'a speckled beige ceramic bowl', 'a deep blue glazed bowl']
const SUPERFICIES = ['a light oak wooden table', 'a dark walnut table', 'a white marble kitchen counter', 'a grey concrete-look counter', 'a table with a rumpled linen tablecloth', 'a beige stone counter', 'a worn light plywood table']
const LUCES = ['soft side daylight from a window on the left', 'soft side daylight from a window on the right', 'bright overcast daylight, flat and even', 'warm late-afternoon sunlight with soft shadows', 'cool morning daylight', 'mixed window light and warm kitchen light']
const ANGULOS = ['about 45 degrees', 'almost top-down (overhead)', 'low angle about 30 degrees', '45 degrees slightly from the side']
const ENCUADRES = ['the dish slightly off-centre', 'a tight crop where the plate edge is cut by the frame', 'the dish centred but not perfectly', 'a single fork or spoon resting naturally beside the plate, not staged']
function vajilla(c, h) {
  const e = c.e
  if (/glass|jar/.test(e)) return e
  if (/bowl/.test(e)) return e.replace(/in a? ?(wide |deep |small )?(plain )?(ceramic )?bowl( or [a-z ]+)?|in a deep plain ceramic bowl|in a wide plain ceramic bowl/, `in ${pick(CUENCOS, h, 3)}`)
  if (/baking paper/.test(e)) return `on baking paper on ${pick(PLATOS, h, 3)}`
  return `on ${pick(PLATOS, h, 3)}`
}
function garnish(c, r, ings, h = 0) {
  let g = c.g
  if (g === DULCE && !/chocolate|cacao|choco|café|moka/i.test(ings)) g = 'finishing touch: a few fresh fruit pieces or a light dusting of cinnamon, minimal'
  if (h % 4 === 0) g = 'finishing touch: none, just the plated food'
  const tieneFrutosSecos = /almendr|nuez|nueces|avellana|pistach|anacardo|cacahuete|crema de cacahuete/i.test(ings)
  if (/almond|nut/i.test(g) && !tieneFrutosSecos) g = FALLBACK.g
  return g
}
function prompt(r, ings) {
  const c = cat(r.nombre), h = hash(r.id)
  return `Casual smartphone photo of "${r.nombre}", home-cooked by a Spanish person in their own kitchen.
The dish contains ONLY these ingredients, in realistic proportions (quantities are for the whole recipe; show ONE normal serving): ${ings}. Do not add any other main food or topping that is not in this list. The only exception is one small decorative garnish described below.
${c.v}
Garnish: ${garnish(c, r, ings, h)}. Keep it small and natural, like a home cook adding a final touch, not overloaded.
Served ${vajilla(c, h)}.
Level: cooked and plated by someone who really knows how to cook, at home, on a good day: careful but unfussy plating. Clean plate edges, balanced portions, sensible arrangement with height and contrast of colours, food cooked properly (well browned, correct texture, fresh and appetising), neat sauces, nice handmade-looking neutral ceramic tableware in good condition. Not restaurant fine-dining and not student-cooking sloppy.
Look: unedited phone photo straight out of the camera, ${pick(ANGULOS, h, 5)}, ${pick(LUCES, h, 7)}, on ${pick(SUPERFICIES, h, 9)}, ${pick(ENCUADRES, h, 11)}. Slight sensor grain, natural slightly bright highlights, no HDR, no colour grading, background softly out of focus. Real textures, matte surfaces, no glossy sheen, small natural imperfections (a sauce smear, a few crumbs, uneven edges).
Strictly avoid: studio lighting, food-magazine styling, stock-photo look, 3D render, CGI, plastic or waxy look, oversaturated colours, perfect symmetry, messy or smeared plates, burnt or raw-looking food, decorative props (no flowers, no edible flowers, napkins, cutlery staging, small bowls of ingredients, ingredient still-life behind the dish), cheese or any food not listed, any drink, glass of juice or extra side dish that is not in the list, text, logos, hands, people.
Square 1:1.`
}

let SIN_SALDO = false
async function generar(p, n = 0) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1.5', prompt: p, n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
    signal: AbortSignal.timeout(150000),
  })
  if (!res.ok) {
    const t = await res.text()
    if (/insufficient_quota|billing|credit_balance/.test(t)) { SIN_SALDO = true; throw new Error('OpenAI sin saldo') }
    if ((res.status === 429 || res.status >= 500) && n < 3) { await new Promise(r => setTimeout(r, 20000)); return generar(p, n + 1) }
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 150)}`)
  }
  return Buffer.from((await res.json()).data[0].b64_json, 'base64')
}

// ── Selección del lote (orden estable por id; solo aprobadas sin foto) ──
let q = db.from('recetas').select('id,nombre,tipo_plato,receta_ingredientes!receta_ingredientes_receta_id_fkey(nombre_libre,cantidad_gramos)')
  .eq('estado', 'aprobada').is('imagen_url', null).order('id')
const { data: todas, error } = await q
if (error) { console.error(error.message); process.exit(1) }
const PRIMERAS = arg('primeras', '')   // --primeras=N: las N primeras pendientes actuales (ignora --lote para elegir)
const lista = IDS.length ? todas.filter(r => IDS.includes(r.id)) : PRIMERAS ? todas.slice(0, Number(PRIMERAS)) : todas.slice((LOTE - 1) * TAM, LOTE * TAM)
const filas = lista.map(r => {
  const ings = (r.receta_ingredientes || []).map(i => {
    const g = i.cantidad_gramos
    return i.nombre_libre ? (g ? `${i.nombre_libre} (${Math.round(g)} g)` : i.nombre_libre) : null
  }).filter(Boolean).filter(x => !SIN_ALIMENTO.test(x)).join(', ')
  const c = cat(r.nombre)
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const palabras = norm(r.nombre).split(/[^a-z]+/).filter(w => w.length > 4 && !/^(con|sin|tupper|mealprep|refeed|pre|post|carrera|light|proteic|casero|fit|saludable|cremos|fresc|natural|horno|plancha|vapor)/.test(w))
  const incoherente = palabras.length > 0 && !palabras.some(w => norm(ings).includes(w.slice(0, 5)))
  return { id: r.id, nombre: r.nombre, ings, garnish: garnish(c, r, ings, hash(r.id)), generica: c === FALLBACK, incoherente }
})
console.log(`Sin foto aprobadas: ${todas.length} · lote ${LOTE}: ${filas.length} recetas · ~${(filas.length * 0.034).toFixed(2)} $ · categoría genérica: ${filas.filter(f => f.generica).length} · nombre≠ingredientes: ${filas.filter(f => f.incoherente).length}`)
if (!GENERA) { filas.forEach((f, i) => console.log(`${i + 1}. ${f.nombre}${f.generica ? '  [genérica]' : ''}\n     ${f.ings}`)); process.exit(0) }

const saltadas = filas.filter(f => f.incoherente)
saltadas.forEach(f => console.log(`⚠ SALTADA (nombre≠ingredientes): ${f.nombre}`))
for (let k = filas.length - 1; k >= 0; k--) if (filas[k].incoherente) filas.splice(k, 1)
mkdirSync(SALIDA, { recursive: true })
let ok = 0, err = 0, i = 0
async function worker() {
  while (i < filas.length && !SIN_SALDO) {
    const f = filas[i++]
    const file = `${SALIDA}/${f.id}.jpg`
    if (existsSync(file) && !IDS.length) { ok++; continue }
    try {
      writeFileSync(file, await generar(prompt({ id: f.id, nombre: f.nombre }, f.ings)))
      ok++; console.log(`✓ [${ok + err}/${filas.length}] ${f.nombre}`)
    } catch (e) { err++; f.error = e.message; console.log(`✗ ${f.nombre}: ${e.message}`) }
  }
}
await Promise.all([worker(), worker(), worker()])

for (let k = filas.length - 1; k >= 0; k--) if (!existsSync(`${SALIDA}/${filas[k].id}.jpg`)) filas.splice(k, 1)
writeFileSync(`${SALIDA}/lote${SUF}.json`, JSON.stringify(filas, null, 1))
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const html = `<!doctype html><meta charset=utf-8><title>Fotos IA lote ${LOTE}</title>
<style>body{font:14px system-ui;margin:16px;background:#111;color:#eee}.bar{position:sticky;top:0;background:#111;padding:8px 0;z-index:9}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}.c{background:#1c1c1c;padding:8px;border-radius:10px;border:3px solid transparent}.c.ok{border-color:#3fb950}.c.no{border-color:#f85149}img{width:100%;border-radius:8px;cursor:zoom-in}small{color:#aaa;display:block;margin:4px 0}button{padding:6px 10px;border-radius:6px;border:0;cursor:pointer;margin-right:6px}.a{background:#3fb950}.r{background:#f85149;color:#fff}</style>
<div class=bar><b>Lote ${LOTE}${SUF}</b> — <span id=n></span> <button onclick="exp()">Descargar selección</button> <button onclick="cop()">Copiar selección</button> <small style="display:inline">Atajo: clic en la foto = ampliar</small></div><div class=g>
${filas.map(f => `<div class=c id="${f.id}"><img src="${f.id}.jpg" onclick="window.open(this.src)" onerror="this.alt='sin imagen'"><b>${esc(f.nombre)}</b>${f.incoherente ? ' <span style="color:#f0b429">⚠ ingredientes no cuadran con el nombre</span>' : ''}<small>${esc(f.ings)}</small><small>🌿 ${esc(f.garnish.replace('finishing touch: ', ''))}</small><button class=a onclick="m('${f.id}','ok')">✓ Vale</button><button class=r onclick="m('${f.id}','no')">✗ Regenerar</button></div>`).join('')}</div>
<script>const K='lote${LOTE}${SUF}';let S=JSON.parse(localStorage[K]||'{}');
function pinta(){for(const id in S){document.getElementById(id).className='c '+S[id]}document.getElementById('n').textContent=Object.values(S).filter(v=>v=='ok').length+' aprobadas · '+Object.values(S).filter(v=>v=='no').length+' a regenerar · '+(${filas.length}-Object.keys(S).length)+' sin marcar'}
function m(id,v){S[id]=S[id]==v?undefined:v;if(!S[id])delete S[id];document.getElementById(id).className='c';localStorage[K]=JSON.stringify(S);pinta()}
function d(n,o){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)]));a.download=n;a.click()}
function sel(){return{ok:Object.keys(S).filter(k=>S[k]=='ok'),no:Object.keys(S).filter(k=>S[k]=='no')}}
function exp(){d('seleccion-lote${LOTE}${SUF}.json',sel())}
function cop(){navigator.clipboard.writeText(JSON.stringify(sel())).then(()=>alert('Copiado: '+sel().ok.length+' aprobadas, '+sel().no.length+' a regenerar. Pégalo en el chat.'))}
pinta()</script>`
writeFileSync(`${SALIDA}/panel${SUF}.html`, html)
if (SIN_SALDO) console.log('\n⛔ OpenAI sin saldo: recarga en platform.openai.com/settings/organization/billing y relanza el mismo comando (salta las ya generadas).')
console.log(`\nListo: ${ok} ok · ${err} errores · ~${(ok * 0.034).toFixed(2)} $\nPanel: ${SALIDA}/panel.html`)

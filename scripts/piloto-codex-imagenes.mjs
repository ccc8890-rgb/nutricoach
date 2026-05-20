/**
 * piloto-codex-imagenes.mjs
 *
 * Genera un segundo piloto de imagenes "Codex directo" para comparar contra:
 * - imagen actual de BD
 * - candidata del piloto real-first anterior
 *
 * No actualiza Supabase ni sube imagenes.
 *
 * USO:
 *   node scripts/piloto-codex-imagenes.mjs
 *   node scripts/piloto-codex-imagenes.mjs --genera
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(__dirname, '..')
const SALIDA_DIR = resolve(RAIZ, 'salidas', 'revision-imagenes', 'piloto-20-05-2026')
const GENERA = process.argv.includes('--genera')

const PILOTO = [
  'Adobos de pollo',
  'Arroz con pollo y salsa de cilantro',
  'Bizcocho proteico con pepitas de chocolate',
  'Chuck Fudge Protein Balls',
  'Albóndigas de pollo en salsa ligera de tomate',
  'Berenjenas a la parmesana ligeras',
  'Huevos poché sobre aguacate y pan integral',
  'Lentejas estofadas con verduras',
  'Barritas Proteicas de Chocolate y Cacahuete',
  'Batido verde de manzana y espinacas',
  'Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha',
  'Tiramisu en vaso',
]

function loadEnv() {
  const envPath = resolve(RAIZ, '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function ingredientes(receta) {
  return (receta.receta_ingredientes || [])
    .map(i => i.nombre_libre || i.alimento?.nombre)
    .filter(Boolean)
    .slice(0, 10)
}

function categoriaVisual(receta) {
  const text = `${receta.nombre} ${receta.categoria || ''} ${receta.tipo_plato || ''}`.toLowerCase()
  if (/batido|smoothie|gazpacho|crema fria/.test(text)) return 'drink'
  if (/bizcocho|brownie|tarta|tiramisu|barrita|cookie|galleta|donut|muffin|chocolate|fudge/.test(text)) return 'dessert'
  if (/bowl|ensalada|poke/.test(text)) return 'bowl'
  if (/tost|bocata|sandwich|wrap|taco|burrito/.test(text)) return 'handheld'
  return 'plate'
}

function promptCodex(receta) {
  const ings = ingredientes(receta)
  const visual = categoriaVisual(receta)
  const base = [
    `Create a photorealistic square smartphone food photo of the Spanish fitness recipe: "${receta.nombre}".`,
    ings.length ? `Use only these visible ingredients when relevant: ${ings.join(', ')}.` : '',
    'The dish must look like real homemade food cooked by a Spanish fitness creator, photographed quickly before eating.',
    'Natural window light, realistic food texture, normal portion size, believable plate or bowl, home kitchen counter or simple wooden table.',
    'Composition should be clean but not professional: slight imperfection, real shadows, real crumbs or sauce texture, natural colors.',
    'No hands, no people, no text, no logos, no watermark, no packaging, no cutlery as main subject.',
    'Do not add decorative flowers, luxury props, restaurant styling, unnecessary garnishes or ingredients not in the recipe.',
    'Avoid plastic look, CGI, 3D render, hyperreal glossy food, stock-photo perfection, artificial shine, over-saturated colors, fake steam.',
  ].filter(Boolean)

  const byType = {
    drink: [
      'Serve it in a simple transparent glass or plain cup on a kitchen counter.',
      'Liquid texture must look natural, not neon, not glossy plastic. If green, keep it muted and homemade.',
    ],
    dessert: [
      'Homemade dessert presentation: slightly uneven edges, real baked texture, simple plate or baking paper.',
      'Chocolate and creams must look matte and edible, not polished plastic or luxury patisserie.',
    ],
    bowl: [
      'Use a simple bowl, overhead or 45-degree angle, ingredients visible but naturally arranged.',
      'The result should look like a real meal-prep or fitness bowl, not a restaurant advertisement.',
    ],
    handheld: [
      'Show the sandwich, wrap, taco or toast as the main subject on a simple plate or board.',
      'Filling should be visible and believable, with natural messiness.',
    ],
    plate: [
      'Serve on a simple ceramic plate, 45-degree angle or gentle overhead shot.',
      'Sauces and cooked proteins should look real, slightly imperfect, and not glossy.',
    ],
  }

  return [...base, ...byType[visual], 'Square 1:1. Photorealistic documentary iPhone-style food photo.'].join('\n')
}

async function squareJpeg(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(1024, 1024, {
      fit: 'cover',
      position: 'center',
      background: { r: 250, g: 248, b: 244, alpha: 1 },
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function fetchImage(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`download ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) return fetchImage(url)
  throw new Error('OpenAI devolvio respuesta vacia')
}

function previousCandidate(slug) {
  if (!existsSync(SALIDA_DIR)) return null
  const names = [
    `01--source_edit--${slug}.jpg`,
    `02--source_edit--${slug}.jpg`,
    `03--source_edit--${slug}.jpg`,
    `04--source_edit--${slug}.jpg`,
    `05--search_edit--${slug}.jpg`,
    `06--search_edit--${slug}.jpg`,
    `07--search_edit--${slug}.jpg`,
    `08--search_edit--${slug}.jpg`,
    `09--ai_fallback--${slug}.jpg`,
    `10--ai_fallback--${slug}.jpg`,
    `11--ai_fallback--${slug}.jpg`,
    `12--ai_fallback--${slug}.jpg`,
  ]
  return names.find(n => existsSync(join(SALIDA_DIR, n))) || null
}

function writePanel(resultados) {
  const cards = resultados.map((r, idx) => `<article class="card">
    <div class="head"><span>#${idx + 1}</span><strong>${escapeHtml(r.nombre)}</strong><em>${escapeHtml(r.tipo)}</em></div>
    <div class="grid">
      <section><h3>Actual</h3>${r.imagen_url ? `<img src="${escapeHtml(r.imagen_url)}">` : '<div class="missing">Sin actual</div>'}</section>
      <section><h3>Piloto real-first</h3>${r.prev ? `<img src="${escapeHtml(r.prev)}">` : '<div class="missing">Sin piloto anterior</div>'}</section>
      <section><h3>Codex directo</h3>${r.codex ? `<img src="${escapeHtml(r.codex)}">` : `<div class="missing">${escapeHtml(r.error || 'Sin imagen')}</div>`}</section>
    </div>
    <p><b>Ingredientes:</b> ${escapeHtml(r.ingredientes)}</p>
    <details><summary>Prompt Codex</summary><pre>${escapeHtml(r.prompt)}</pre></details>
  </article>`).join('\n')

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparativa Codex imagenes recetas</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f2ed;color:#20221f;margin:0;padding:22px}
h1{margin:0 0 5px}.sub{margin:0 0 20px;color:#666}
.card{background:#fff;border:1px solid #ddd7cb;border-radius:14px;padding:15px;margin-bottom:22px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.head{display:flex;gap:10px;align-items:center;margin-bottom:12px}.head span{background:#20221f;color:white;padding:3px 9px;border-radius:999px;font-size:12px}.head strong{font-size:18px}.head em{margin-left:auto;color:#686b62;font-size:13px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}section{background:#faf8f3;border-radius:10px;padding:9px}h3{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#656960}
img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#eee}.missing{aspect-ratio:1/1;border-radius:8px;background:#eee;display:flex;align-items:center;justify-content:center;color:#777;text-align:center;padding:12px}
p{font-size:13px;color:#444;line-height:1.45}summary{font-size:13px;cursor:pointer;color:#555}pre{white-space:pre-wrap;font-size:12px;line-height:1.45;background:#f6f4ee;padding:10px;border-radius:8px}
@media(max-width:900px){.grid{grid-template-columns:1fr}.head{flex-wrap:wrap}.head em{margin-left:0}}
</style>
</head>
<body>
<h1>Comparativa Codex directo</h1>
<p class="sub">Actual vs piloto real-first vs generacion directa con prompt Codex. No se ha actualizado la BD.</p>
${cards}
</body>
</html>`
  writeFileSync(join(SALIDA_DIR, 'comparativa-codex.html'), html)
}

async function main() {
  loadEnv()
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada')
  if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await sb
    .from('recetas')
    .select('id,nombre,categoria,tipo_plato,imagen_url,receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
    .in('nombre', PILOTO)
  if (error) throw new Error(error.message)

  const byName = new Map((data || []).map(r => [r.nombre, r]))
  const recetas = PILOTO.map(n => byName.get(n)).filter(Boolean)

  console.log(`\nPiloto Codex directo`)
  console.log(`Recetas: ${recetas.length}/${PILOTO.length}`)
  console.log(`Salida: ${SALIDA_DIR}`)
  if (!GENERA) {
    console.log('\nPreview. Para generar:')
    console.log('  node scripts/piloto-codex-imagenes.mjs --genera\n')
    recetas.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${categoriaVisual(r).padEnd(8)} ${r.nombre}`))
    return
  }

  const resultados = []
  for (let i = 0; i < recetas.length; i++) {
    const receta = recetas[i]
    const slug = slugify(receta.nombre)
    const filename = `${String(i + 1).padStart(2, '0')}--codex_direct--${slug}.jpg`
    const filepath = join(SALIDA_DIR, filename)
    const prompt = promptCodex(receta)
    process.stdout.write(`[${i + 1}/${recetas.length}] ${receta.nombre} ... `)
    try {
      let buffer
      if (existsSync(filepath)) {
        buffer = readFileSync(filepath)
      } else {
        buffer = await squareJpeg(await generateImage(prompt))
        writeFileSync(filepath, buffer)
      }
      resultados.push({
        nombre: receta.nombre,
        tipo: categoriaVisual(receta),
        imagen_url: receta.imagen_url,
        prev: previousCandidate(slug),
        codex: filename,
        ingredientes: ingredientes(receta).join(', '),
        prompt,
        bytes: buffer.length,
      })
      console.log(`OK ${(buffer.length / 1024).toFixed(0)}KB`)
    } catch (err) {
      resultados.push({
        nombre: receta.nombre,
        tipo: categoriaVisual(receta),
        imagen_url: receta.imagen_url,
        prev: previousCandidate(slug),
        ingredientes: ingredientes(receta).join(', '),
        prompt,
        error: err.message,
      })
      console.log(`ERROR ${err.message.slice(0, 120)}`)
    }
    if (i < recetas.length - 1) await new Promise(r => setTimeout(r, 1800))
  }

  writeFileSync(join(SALIDA_DIR, 'resultados-codex.json'), JSON.stringify(resultados, null, 2))
  writePanel(resultados)
  console.log(`\nPanel: ${join(SALIDA_DIR, 'comparativa-codex.html')}`)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})

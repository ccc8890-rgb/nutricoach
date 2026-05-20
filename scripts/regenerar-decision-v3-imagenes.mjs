/**
 * regenerar-decision-v3-imagenes.mjs
 *
 * Regenera solo las recetas marcadas por Carlos como "Regenerar"
 * en la decision del piloto. No actualiza Supabase ni sube imagenes.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(__dirname, '..')
const DIR = resolve(RAIZ, 'salidas', 'revision-imagenes', 'piloto-20-05-2026')
const GENERA = process.argv.includes('--genera')

const RECETAS = [
  'Huevos poché sobre aguacate y pan integral',
  'Lentejas estofadas con verduras',
  'Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha',
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
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function ingredientes(receta) {
  return (receta.receta_ingredientes || [])
    .map(i => i.nombre_libre || i.alimento?.nombre)
    .filter(Boolean)
    .slice(0, 10)
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

function promptV3(receta) {
  const ing = ingredientes(receta).join(', ')
  const nombre = receta.nombre
  if (nombre.startsWith('Huevos poché')) {
    return `Foto realista de movil de un desayuno casero: huevos poche sobre tostada integral con aguacate machacado y tomate.
Ingredientes reales: ${ing}.

Debe parecer una foto tomada en una cocina real, no de restaurante.
Pan integral visible, aguacate aplastado de textura natural, huevo poche con yema cremosa pero no perfecta.
Plato sencillo, luz natural suave, encuadre ligeramente imperfecto, colores naturales.
Sin manos, sin cubiertos protagonistas, sin flores, sin servilletas decorativas, sin texto.
Evitar aspecto plastico, brillo artificial, comida demasiado perfecta, stock photo o render 3D.
Formato cuadrado 1:1.`
  }
  if (nombre.startsWith('Lentejas')) {
    return `Foto realista de movil de un plato hondo casero de lentejas estofadas con verduras.
Ingredientes reales: ${ing}.

Debe parecer comida de cuchara hecha en casa en España, servida en plato hondo sencillo.
Textura espesa y real, lentejas visibles, zanahoria o verduras visibles, color natural marron-verdoso.
No hacerlo gourmet. No plato minimalista. No restaurante. No decoracion.
Luz natural de cocina, encuadre cercano, pequeñas imperfecciones, superficie mate.
Evitar aspecto plastico, CGI, brillo excesivo, sopa demasiado lisa, toppings artificiales.
Formato cuadrado 1:1.`
  }
  return `Foto realista de movil de bacalao casero con esparragos a la plancha, estilo receta saludable española.
Ingredientes reales: ${ing}.

Debe parecer un plato hecho en casa, no cocina de restaurante ni fotografia premium.
Bacalao en lascas o lomo blanco natural, esparragos verdes a la plancha, salsa ligera tipo pil-pil sin exceso de brillo.
Plato ceramico sencillo, luz natural suave, encuadre 45 grados o cenital cercano, textura real.
No añadir flores, microgreens, decoracion gourmet ni ingredientes que no esten en la receta.
Evitar plastico, render 3D, salsa brillante artificial, plato demasiado perfecto o de alta cocina.
Formato cuadrado 1:1.`
}

async function generate(prompt) {
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
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) return fetchImage(url)
  throw new Error('OpenAI respuesta vacia')
}

function previous(slug, kind) {
  if (!existsSync(DIR)) return null
  const files = [
    `07--codex_direct--${slug}.jpg`,
    `08--codex_direct--${slug}.jpg`,
    `11--codex_direct--${slug}.jpg`,
    `07--search_edit--${slug}.jpg`,
    `08--search_edit--${slug}.jpg`,
    `11--ai_fallback--${slug}.jpg`,
    `03--pulido_v2--${slug}.jpg`,
  ]
  return files.find(f => f.includes(kind) && existsSync(join(DIR, f)))
    || files.find(f => existsSync(join(DIR, f)))
    || null
}

function writePanel(resultados) {
  const cards = resultados.map((r, idx) => `<article class="card">
    <div class="head"><span>#${idx + 1}</span><strong>${escapeHtml(r.nombre)}</strong></div>
    <div class="grid">
      <section><h3>Actual</h3>${r.imagen_url ? `<img src="${escapeHtml(r.imagen_url)}">` : '<div class="missing">Sin actual</div>'}</section>
      <section><h3>Anterior</h3>${r.anterior ? `<img src="${escapeHtml(r.anterior)}">` : '<div class="missing">Sin anterior</div>'}</section>
      <section><h3>V3</h3>${r.v3 ? `<img src="${escapeHtml(r.v3)}">` : `<div class="missing">${escapeHtml(r.error || 'Sin v3')}</div>`}</section>
    </div>
    <details><summary>Prompt v3</summary><pre>${escapeHtml(r.prompt)}</pre></details>
  </article>`).join('\n')
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Regenerar v3 imagenes</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f2ed;color:#20221f;margin:0;padding:22px}.sub{color:#666;margin-top:0}
.card{background:#fff;border:1px solid #ddd7cb;border-radius:14px;padding:15px;margin-bottom:22px;box-shadow:0 2px 12px rgba(0,0,0,.05)}.head{display:flex;gap:10px;align-items:center;margin-bottom:12px}.head span{background:#20221f;color:white;border-radius:999px;padding:3px 9px;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}section{background:#faf8f3;border-radius:10px;padding:9px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#656960;margin:0 0 8px}
img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#eee}.missing{aspect-ratio:1/1;background:#eee;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#777;text-align:center;padding:12px}summary{font-size:13px;margin-top:10px;cursor:pointer}pre{white-space:pre-wrap;font-size:12px;background:#f6f4ee;padding:10px;border-radius:8px}
@media(max-width:900px){.grid{grid-template-columns:1fr}}
</style></head><body><h1>Regeneracion v3</h1><p class="sub">Solo las 3 marcadas para regenerar. No se ha actualizado la BD.</p>${cards}</body></html>`
  writeFileSync(join(DIR, 'comparativa-regenerar-v3.html'), html)
}

async function main() {
  loadEnv()
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.from('recetas').select('id,nombre,imagen_url,receta_ingredientes(nombre_libre, alimento:alimentos(nombre))').in('nombre', RECETAS)
  if (error) throw new Error(error.message)
  const byName = new Map((data || []).map(r => [r.nombre, r]))
  const recetas = RECETAS.map(n => byName.get(n)).filter(Boolean)
  console.log(`\nRegenerar v3: ${recetas.length}/${RECETAS.length}`)
  if (!GENERA) {
    console.log('Preview. Para generar: node scripts/regenerar-decision-v3-imagenes.mjs --genera')
    recetas.forEach((r, i) => console.log(`${i + 1}. ${r.nombre}`))
    return
  }
  const resultados = []
  for (let i = 0; i < recetas.length; i++) {
    const receta = recetas[i]
    const slug = slugify(receta.nombre)
    const file = `${String(i + 1).padStart(2, '0')}--regenerar_v3--${slug}.jpg`
    const out = join(DIR, file)
    const prompt = promptV3(receta)
    process.stdout.write(`[${i + 1}/${recetas.length}] ${receta.nombre} ... `)
    try {
      let buffer
      if (existsSync(out)) {
        buffer = readFileSync(out)
      } else {
        buffer = await squareJpeg(await generate(prompt))
        writeFileSync(out, buffer)
      }
      resultados.push({ nombre: receta.nombre, imagen_url: receta.imagen_url, anterior: previous(slug, 'codex_direct'), v3: file, prompt })
      console.log(`OK ${(buffer.length / 1024).toFixed(0)}KB`)
    } catch (err) {
      resultados.push({ nombre: receta.nombre, imagen_url: receta.imagen_url, anterior: previous(slug, 'codex_direct'), error: err.message, prompt })
      console.log(`ERROR ${err.message.slice(0, 120)}`)
    }
    if (i < recetas.length - 1) await new Promise(r => setTimeout(r, 1800))
  }
  writeFileSync(join(DIR, 'resultados-regenerar-v3.json'), JSON.stringify(resultados, null, 2))
  writePanel(resultados)
  console.log(`Panel: ${join(DIR, 'comparativa-regenerar-v3.html')}`)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})

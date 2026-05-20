/**
 * pulir-fallback-imagenes.mjs
 *
 * Segunda pasada para recetas que en el piloto salieron demasiado IA.
 * Prueba busqueda real primero y deja un fallback Codex v2 mas crudo.
 *
 * No actualiza Supabase ni sube imagenes.
 *
 * USO:
 *   node scripts/pulir-fallback-imagenes.mjs
 *   node scripts/pulir-fallback-imagenes.mjs --genera
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

const RECETAS = [
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

async function fetchImage(url, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' },
      signal: AbortSignal.timeout(timeout),
    })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    if (!ct.startsWith('image/')) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return buffer.length > 12000 ? buffer : null
  } catch {
    return null
  }
}

async function squareJpeg(buffer, fit = 'cover') {
  return sharp(buffer)
    .rotate()
    .resize(1024, 1024, { fit, position: 'center', background: { r: 250, g: 248, b: 244, alpha: 1 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

async function cookpadImage(query) {
  try {
    const res = await fetch('https://cookpad.com/es/buscar/' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'es-ES,es;q=0.9' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const urls = [...html.matchAll(/"(https:\/\/img-global\.cpcdn\.com\/recipes\/[^"]+)"/g)]
      .map(m => m[1])
      .filter((u, i, arr) => arr.indexOf(u) === i)
    return urls.find(u => u.includes('1200')) || urls.find(u => u.includes('640')) || urls[0] || null
  } catch {
    return null
  }
}

async function ogImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

async function staticRecipeImage(query) {
  const urls = [
    `https://www.recetasgratis.net/busqueda?q=${encodeURIComponent(query)}`,
    `https://www.pequerecetas.com/?s=${encodeURIComponent(query)}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(12000) })
      if (!res.ok) continue
      const html = await res.text()
      const domain = new URL(url).hostname.replace('.', '\\.')
      const href = html.match(new RegExp(`href=["'](https?://${domain}/[^"'?#]+)["']`))?.[1]
      if (!href) continue
      const img = await ogImage(href)
      if (img) return img
    } catch {}
  }
  return null
}

function searchQueries(receta) {
  const nombre = receta.nombre
  const clean = nombre
    .replace(/proteicas?|fit|saludables?|confitado a 65 °C|pil-pil de ajo negro/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  const byName = [nombre, clean].filter(Boolean)
  const manual = {
    'Barritas Proteicas de Chocolate y Cacahuete': ['barritas chocolate cacahuete avena receta', 'protein bars chocolate peanut butter homemade'],
    'Batido verde de manzana y espinacas': ['batido verde manzana espinacas receta', 'green smoothie apple spinach homemade'],
    'Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha': ['bacalao confitado esparragos receta', 'bacalao al pil pil esparragos'],
    'Tiramisu en vaso': ['tiramisu en vaso receta', 'vasitos tiramisu casero'],
  }
  return [...byName, ...(manual[nombre] || [])]
}

async function searchBase(receta) {
  for (const q of searchQueries(receta)) {
    const cookpad = await cookpadImage(q)
    if (cookpad) {
      const raw = await fetchImage(cookpad)
      if (raw) return { buffer: await squareJpeg(raw), fuente: `Cookpad: ${q}` }
    }
    const web = await staticRecipeImage(q)
    if (web) {
      const raw = await fetchImage(web)
      if (raw) return { buffer: await squareJpeg(raw), fuente: `web receta: ${q}` }
    }
  }
  return { buffer: null, fuente: 'sin foto real encontrada' }
}

function editPrompt(receta) {
  return `Edita esta foto de forma minima para "${receta.nombre}".

Conserva la comida y la composicion de la imagen base.
Quita solo texto, logos, marcas de agua, manos, dedos o personas si aparecen.
No conviertas la foto en una imagen de estudio. No embellezcas de mas.
Mantén luz natural, textura real, pequenas imperfecciones, raciones normales y colores no saturados.
Evita brillo plastico, CGI, comida perfecta, fondo de restaurante y props decorativos.
Formato cuadrado 1:1, aspecto de movil, fotorealista.`
}

function genPrompt(receta) {
  const ing = ingredientes(receta).join(', ')
  return `Foto de movil, realista y poco producida, de "${receta.nombre}".
${ing ? `Ingredientes reales de la receta: ${ing}.` : ''}

Debe parecer una foto normal de un creador fitness español en su cocina, tomada justo antes de comer.
No debe parecer foto de stock, restaurante, anuncio, render 3D ni imagen generada por IA.
Usa plato, vaso o recipiente sencillo. Encimera real, luz natural suave, sombras normales.
Texturas imperfectas: bordes irregulares, miga real, salsa no perfectamente colocada, superficie mate.
No añadir flores, hierbas decorativas innecesarias, cubiertos protagonistas, servilletas bonitas ni elementos premium.
Colores naturales y algo apagados. Cero brillo plastico. Cero perfeccion artificial.
Formato cuadrado 1:1.`
}

async function openAIEdit(buffer, receta) {
  const form = new FormData()
  form.append('image', new Blob([buffer], { type: 'image/jpeg' }), 'base.jpg')
  form.append('model', 'gpt-image-1')
  form.append('prompt', editPrompt(receta))
  form.append('n', '1')
  form.append('size', '1024x1024')
  form.append('quality', 'medium')
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`OpenAI edit ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) {
    const out = await fetchImage(url, 30000)
    if (out) return out
  }
  throw new Error('OpenAI edit vacio')
}

async function openAIGen(receta) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-image-1', prompt: genPrompt(receta), n: 1, size: '1024x1024', quality: 'medium', output_format: 'jpeg' }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`OpenAI gen ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) {
    const out = await fetchImage(url, 30000)
    if (out) return out
  }
  throw new Error('OpenAI gen vacio')
}

function previous(slug, prefix) {
  const files = [
    `${prefix}--${slug}.jpg`,
    `09--ai_fallback--${slug}.jpg`,
    `10--ai_fallback--${slug}.jpg`,
    `11--ai_fallback--${slug}.jpg`,
    `12--ai_fallback--${slug}.jpg`,
    `09--codex_direct--${slug}.jpg`,
    `10--codex_direct--${slug}.jpg`,
    `11--codex_direct--${slug}.jpg`,
    `12--codex_direct--${slug}.jpg`,
  ]
  return files.find(f => existsSync(join(SALIDA_DIR, f))) || null
}

function writePanel(resultados) {
  const cards = resultados.map((r, idx) => `<article class="card">
    <div class="head"><span>#${idx + 1}</span><strong>${escapeHtml(r.nombre)}</strong><em>${escapeHtml(r.fuente)}</em></div>
    <div class="grid">
      <section><h3>Actual</h3>${r.imagen_url ? `<img src="${escapeHtml(r.imagen_url)}">` : '<div class="missing">Sin actual</div>'}</section>
      <section><h3>Codex anterior</h3>${r.codexAnterior ? `<img src="${escapeHtml(r.codexAnterior)}">` : '<div class="missing">Sin anterior</div>'}</section>
      <section><h3>Pulido v2</h3>${r.v2 ? `<img src="${escapeHtml(r.v2)}">` : `<div class="missing">${escapeHtml(r.error || 'Sin v2')}</div>`}</section>
    </div>
    <p><b>Ingredientes:</b> ${escapeHtml(r.ingredientes)}</p>
    <details><summary>Prompt / busqueda</summary><pre>${escapeHtml(r.prompt)}</pre></details>
  </article>`).join('\n')

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pulido fallback imagenes</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f2ed;color:#20221f;margin:0;padding:22px}.sub{color:#666;margin-top:0}
.card{background:white;border:1px solid #ddd7cb;border-radius:14px;padding:15px;margin-bottom:22px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.head{display:flex;gap:10px;align-items:center;margin-bottom:12px}.head span{background:#20221f;color:#fff;border-radius:999px;padding:3px 9px;font-size:12px}.head em{margin-left:auto;color:#686b62;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
section{background:#faf8f3;border-radius:10px;padding:9px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#656960;margin:0 0 8px}img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#eee}.missing{aspect-ratio:1/1;border-radius:8px;background:#eee;display:flex;align-items:center;justify-content:center;color:#777;text-align:center;padding:12px}
p,summary{font-size:13px;color:#444;line-height:1.45}pre{white-space:pre-wrap;font-size:12px;background:#f6f4ee;padding:10px;border-radius:8px}@media(max-width:900px){.grid{grid-template-columns:1fr}.head{flex-wrap:wrap}.head em{margin-left:0}}
</style></head><body>
<h1>Pulido v2 de las recetas demasiado IA</h1>
<p class="sub">Actual vs Codex anterior vs v2. No se ha actualizado la BD.</p>
${cards}
</body></html>`
  writeFileSync(join(SALIDA_DIR, 'comparativa-pulido-v2.html'), html)
}

async function main() {
  loadEnv()
  if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.from('recetas').select('id,nombre,categoria,tipo_plato,imagen_url,receta_ingredientes(nombre_libre, alimento:alimentos(nombre))').in('nombre', RECETAS)
  if (error) throw new Error(error.message)
  const byName = new Map((data || []).map(r => [r.nombre, r]))
  const recetas = RECETAS.map(n => byName.get(n)).filter(Boolean)

  console.log(`\nPulido v2 fallback`)
  console.log(`Recetas: ${recetas.length}/${RECETAS.length}`)
  if (!GENERA) {
    console.log('\nPreview. Para generar:')
    console.log('  node scripts/pulir-fallback-imagenes.mjs --genera\n')
    recetas.forEach((r, i) => console.log(`${i + 1}. ${r.nombre}`))
    return
  }

  const resultados = []
  for (let i = 0; i < recetas.length; i++) {
    const receta = recetas[i]
    const slug = slugify(receta.nombre)
    const out = `${String(i + 1).padStart(2, '0')}--pulido_v2--${slug}.jpg`
    const outPath = join(SALIDA_DIR, out)
    process.stdout.write(`[${i + 1}/${recetas.length}] ${receta.nombre} ... `)
    try {
      let buffer
      let fuente = 'archivo existente'
      let prompt = ''
      if (existsSync(outPath)) {
        buffer = readFileSync(outPath)
      } else {
        const found = await searchBase(receta)
        if (found.buffer) {
          buffer = await squareJpeg(await openAIEdit(found.buffer, receta))
          fuente = `${found.fuente} + edit minimo`
          prompt = editPrompt(receta)
        } else {
          buffer = await squareJpeg(await openAIGen(receta))
          fuente = 'fallback Codex v2'
          prompt = genPrompt(receta)
        }
        writeFileSync(outPath, buffer)
      }
      resultados.push({
        nombre: receta.nombre,
        imagen_url: receta.imagen_url,
        codexAnterior: previous(slug, `${String(i + 9).padStart(2, '0')}--codex_direct`),
        v2: out,
        fuente,
        ingredientes: ingredientes(receta).join(', '),
        prompt,
      })
      console.log(`OK ${fuente}`)
    } catch (err) {
      resultados.push({ nombre: receta.nombre, imagen_url: receta.imagen_url, error: err.message, ingredientes: ingredientes(receta).join(', ') })
      console.log(`ERROR ${err.message.slice(0, 110)}`)
    }
    if (i < recetas.length - 1) await new Promise(r => setTimeout(r, 1800))
  }

  writeFileSync(join(SALIDA_DIR, 'resultados-pulido-v2.json'), JSON.stringify(resultados, null, 2))
  writePanel(resultados)
  console.log(`\nPanel: ${join(SALIDA_DIR, 'comparativa-pulido-v2.html')}`)
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1) })

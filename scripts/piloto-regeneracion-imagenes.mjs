/**
 * piloto-regeneracion-imagenes.mjs
 *
 * Genera un lote piloto de candidatas visuales para recetas rechazadas.
 * No actualiza Supabase ni sube imagenes: todo queda local para revision.
 *
 * USO:
 *   node scripts/piloto-regeneracion-imagenes.mjs
 *   node scripts/piloto-regeneracion-imagenes.mjs --genera
 */

import { createClient } from '@supabase/supabase-js'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path, { dirname, join, resolve } from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(__dirname, '..')
const SALIDA_DIR = resolve(RAIZ, 'salidas', 'revision-imagenes', 'piloto-20-05-2026')
const GENERA = process.argv.includes('--genera')

const PILOTO = [
  { nombre: 'Adobos de pollo', estrategia: 'source_edit' },
  { nombre: 'Arroz con pollo y salsa de cilantro', estrategia: 'source_edit' },
  { nombre: 'Bizcocho proteico con pepitas de chocolate', estrategia: 'source_edit' },
  { nombre: 'Chuck Fudge Protein Balls', estrategia: 'source_edit' },
  { nombre: 'Albóndigas de pollo en salsa ligera de tomate', estrategia: 'search_edit' },
  { nombre: 'Berenjenas a la parmesana ligeras', estrategia: 'search_edit' },
  { nombre: 'Huevos poché sobre aguacate y pan integral', estrategia: 'search_edit' },
  { nombre: 'Lentejas estofadas con verduras', estrategia: 'search_edit' },
  { nombre: 'Barritas Proteicas de Chocolate y Cacahuete', estrategia: 'ai_fallback' },
  { nombre: 'Batido verde de manzana y espinacas', estrategia: 'ai_fallback' },
  { nombre: 'Bacalao confitado a 65 °C con pil-pil de ajo negro y espárragos a la plancha', estrategia: 'ai_fallback' },
  { nombre: 'Tiramisu en vaso', estrategia: 'ai_fallback' },
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

function ingredientesTexto(receta) {
  return (receta.receta_ingredientes || [])
    .map(i => i.nombre_libre || i.alimento?.nombre)
    .filter(Boolean)
    .slice(0, 8)
    .join(', ')
}

async function fetchBuffer(url, timeout = 20000) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
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
    .resize(1024, 1024, {
      fit,
      position: 'center',
      background: { r: 250, g: 248, b: 244, alpha: 1 },
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()
}

function thumbnailYtdlp(url) {
  const tmpDir = join(os.tmpdir(), `nutricoach_thumb_${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  try {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
    }
    const outTemplate = `${tmpDir}/thumb.%(ext)s`
    execSync(
      `yt-dlp --write-thumbnail --skip-download --cookies-from-browser chrome -o ${JSON.stringify(outTemplate)} ${JSON.stringify(url)}`,
      { timeout: 60000, encoding: 'utf8', env, stdio: 'pipe' }
    )
    const files = readdirSync(tmpDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
    if (!files.length) return null
    const buffer = readFileSync(join(tmpDir, files[0]))
    return buffer.length > 12000 ? buffer : null
  } catch {
    return null
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

function imageUrlsWithAgentBrowser(url) {
  try {
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/Users/${process.env.USER}/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`,
    }
    execSync(`agent-browser open ${JSON.stringify(url)}`, { timeout: 25000, encoding: 'utf8', env, stdio: 'pipe' })
    const result = execSync(
      `agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('img')).filter(img=>img.naturalWidth>200&&img.naturalHeight>200).sort((a,b)=>(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight)).slice(0,10).map(img=>img.src))"`,
      { timeout: 20000, encoding: 'utf8', env, stdio: 'pipe' }
    )
    execSync('agent-browser close', { timeout: 5000, encoding: 'utf8', env, stdio: 'pipe' })
    const match = result.match(/\[[\s\S]*?\]/)
    return match ? JSON.parse(match[0]).filter(u => typeof u === 'string' && u.startsWith('http')) : []
  } catch {
    return []
  }
}

async function ogImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

async function sourceImage(receta) {
  if (!receta.url_origen) return { buffer: null, fuente: 'sin_url_origen' }
  const social = /instagram\.com|tiktok\.com|vm\.tiktok/i.test(receta.url_origen)
  if (social) {
    const thumb = thumbnailYtdlp(receta.url_origen)
    if (thumb) return { buffer: await squareJpeg(thumb), fuente: 'yt-dlp thumbnail' }
  }
  for (const imgUrl of imageUrlsWithAgentBrowser(receta.url_origen)) {
    const raw = await fetchBuffer(imgUrl)
    if (raw) return { buffer: await squareJpeg(raw), fuente: 'agent-browser img' }
  }
  const og = await ogImage(receta.url_origen)
  if (og) {
    const raw = await fetchBuffer(og)
    if (raw) return { buffer: await squareJpeg(raw), fuente: 'og:image' }
  }
  return { buffer: null, fuente: 'fuente_no_recuperada' }
}

async function cookpadImage(nombre) {
  try {
    const res = await fetch('https://cookpad.com/es/buscar/' + encodeURIComponent(nombre), {
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

async function staticRecipeImage(nombre) {
  const urls = [
    `https://www.recetasgratis.net/busqueda?q=${encodeURIComponent(nombre)}`,
    `https://www.pequerecetas.com/?s=${encodeURIComponent(nombre)}`,
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

async function searchImage(receta) {
  const queries = [
    receta.nombre,
    receta.nombre.replace(/proteic[oa]|saludable|fit|ligera?s?/gi, '').trim(),
  ].filter(Boolean)
  for (const q of queries) {
    const cookpad = await cookpadImage(q)
    if (cookpad) {
      const raw = await fetchBuffer(cookpad)
      if (raw) return { buffer: await squareJpeg(raw, 'cover'), fuente: `Cookpad: ${q}` }
    }
    const web = await staticRecipeImage(q)
    if (web) {
      const raw = await fetchBuffer(web)
      if (raw) return { buffer: await squareJpeg(raw, 'cover'), fuente: `web receta: ${q}` }
    }
  }
  return { buffer: null, fuente: 'busqueda_sin_resultado' }
}

function editPrompt(receta) {
  return `Edita esta imagen de forma minima para la receta "${receta.nombre}".

Mantén exactamente la misma comida, plato, angulo, composicion y colores principales.
Elimina solo texto superpuesto, logos, marcas de agua, manos, dedos o personas.
No cambies la receta. No añadas toppings, cubiertos, flores, servilletas ni decoracion.
Haz que parezca una foto real de movil hecha por un creador fitness español en una cocina de casa.
Luz natural suave, textura real de comida, pequeñas imperfecciones, nada de estudio.
Evita aspecto plastico, CGI, render 3D, exceso de brillo, comida perfecta o artificial.
Formato cuadrado 1:1, fotorealista.`
}

function generationPrompt(receta) {
  const ings = ingredientesTexto(receta)
  return `Foto realista de movil de la receta "${receta.nombre}".
${ings ? `Ingredientes visibles: ${ings}.` : ''}

Debe parecer comida real hecha en casa por un creador fitness español, no una foto de stock.
Plato o bowl sencillo, encimera de cocina o mesa de madera, luz natural suave de ventana.
Encuadre ligeramente imperfecto, textura real, colores naturales, raciones creibles.
Sin decoracion artificial, sin flores, sin props de estudio, sin manos, sin texto.
No añadir ingredientes que no esten en la receta.
Evitar aspecto plastico, CGI, render 3D, comida brillante, demasiado perfecta o de restaurante.
Formato cuadrado 1:1.`
}

async function openAIEdit(buffer, receta) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada')
  const form = new FormData()
  form.append('image', new Blob([buffer], { type: 'image/jpeg' }), 'base.jpg')
  form.append('model', 'gpt-image-1')
  form.append('prompt', editPrompt(receta))
  form.append('n', '1')
  form.append('size', '1024x1024')
  form.append('quality', 'medium')
  form.append('input_fidelity', 'high')

  let res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  })

  if (!res.ok && res.status === 400) {
    form.delete('input_fidelity')
    res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    })
  }
  if (!res.ok) throw new Error(`OpenAI edit ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) {
    const out = await fetchBuffer(url, 30000)
    if (out) return out
  }
  throw new Error('OpenAI edit: respuesta vacia')
}

async function openAIGenerate(receta) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurada')
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: generationPrompt(receta),
      n: 1,
      size: '1024x1024',
      quality: 'medium',
      output_format: 'jpeg',
    }),
    signal: AbortSignal.timeout(120000),
  })
  if (!res.ok) throw new Error(`OpenAI gen ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const data = await res.json()
  const b64 = data.data?.[0]?.b64_json
  if (b64) return Buffer.from(b64, 'base64')
  const url = data.data?.[0]?.url
  if (url) {
    const out = await fetchBuffer(url, 30000)
    if (out) return out
  }
  throw new Error('OpenAI gen: respuesta vacia')
}

async function candidateFor(receta) {
  if (receta.estrategia === 'ai_fallback') {
    const generated = await openAIGenerate(receta)
    return { buffer: await squareJpeg(generated), metodo: 'ai_fallback', fuente: 'OpenAI txt2img anti-plastico' }
  }

  const source = receta.estrategia === 'source_edit'
    ? await sourceImage(receta)
    : await searchImage(receta)

  if (source.buffer) {
    const edited = await openAIEdit(source.buffer, receta)
    return { buffer: await squareJpeg(edited), metodo: receta.estrategia, fuente: `${source.fuente} + OpenAI edit minimo` }
  }

  const generated = await openAIGenerate(receta)
  return { buffer: await squareJpeg(generated), metodo: `${receta.estrategia}_fallback_ai`, fuente: `${source.fuente} -> OpenAI txt2img` }
}

function writePanel(resultados) {
  const cards = resultados.map((r, idx) => {
    const img = r.candidatoRel ? `<img src="${escapeHtml(r.candidatoRel)}" alt="candidata">` : `<div class="missing">${escapeHtml(r.error || 'Sin candidata')}</div>`
    return `<article class="card">
      <div class="head">
        <span>#${idx + 1}</span>
        <strong>${escapeHtml(r.nombre)}</strong>
        <em>${escapeHtml(r.estrategia)}</em>
      </div>
      <div class="grid">
        <section>
          <h3>Actual</h3>
          ${r.imagen_url ? `<img src="${escapeHtml(r.imagen_url)}" alt="actual">` : '<div class="missing">Sin imagen actual</div>'}
        </section>
        <section>
          <h3>Candidata</h3>
          ${img}
        </section>
      </div>
      <p><b>Fuente:</b> ${escapeHtml(r.fuente || '-')}</p>
      <p><b>Ingredientes:</b> ${escapeHtml(r.ingredientes || '-')}</p>
      <p class="prompt"><b>Prompt:</b> ${escapeHtml(r.prompt || '-')}</p>
    </article>`
  }).join('\n')

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Piloto imagenes recetas</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f5f5f2;color:#1f2320;margin:0;padding:24px}
h1{margin:0 0 6px;font-size:28px}.sub{color:#676c66;margin:0 0 22px}
.card{background:#fff;border:1px solid #ddd8cf;border-radius:14px;margin:0 0 22px;padding:16px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
.head{display:flex;gap:12px;align-items:center;margin-bottom:14px}.head span{background:#1f2320;color:white;border-radius:999px;padding:3px 9px;font-size:12px}.head strong{font-size:18px}.head em{margin-left:auto;color:#73776f;font-size:13px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.grid section{background:#faf9f6;border-radius:10px;padding:10px}.grid h3{margin:0 0 8px;font-size:13px;color:#646860;text-transform:uppercase;letter-spacing:.04em}
img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#eee}.missing{height:280px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:8px;color:#777;text-align:center;padding:16px}
p{font-size:13px;line-height:1.45;color:#3d413b}.prompt{color:#676c66}
@media(max-width:760px){body{padding:12px}.grid{grid-template-columns:1fr}.head{align-items:flex-start}.head em{margin-left:0}.head{flex-wrap:wrap}}
</style>
</head>
<body>
<h1>Piloto regeneracion imagenes recetas</h1>
<p class="sub">Comparativa local: imagen actual vs candidata nueva. No se ha actualizado la BD.</p>
${cards}
</body>
</html>`
  writeFileSync(join(SALIDA_DIR, 'comparativa-piloto.html'), html)
}

async function main() {
  loadEnv()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltan variables Supabase en .env.local')
    process.exit(1)
  }
  if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const nombres = PILOTO.map(r => r.nombre)
  const { data, error } = await supabase
    .from('recetas')
    .select('id,nombre,categoria,tipo_plato,url_origen,imagen_url,receta_ingredientes(nombre_libre, alimento:alimentos(nombre))')
    .in('nombre', nombres)

  if (error) throw new Error(error.message)
  const byName = new Map((data || []).map(r => [r.nombre, r]))
  const recetas = PILOTO.map(p => ({ ...byName.get(p.nombre), estrategia: p.estrategia })).filter(r => r.id)

  console.log(`\nPiloto regeneracion imagenes`)
  console.log(`Recetas encontradas: ${recetas.length}/${PILOTO.length}`)
  console.log(`Salida: ${SALIDA_DIR}`)

  if (!GENERA) {
    console.log('\nPreview. Para generar candidatas ejecuta:')
    console.log('  node scripts/piloto-regeneracion-imagenes.mjs --genera\n')
    recetas.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.estrategia.padEnd(11)} ${r.nombre}`))
    return
  }

  const resultados = []
  for (let i = 0; i < recetas.length; i++) {
    const receta = recetas[i]
    const slug = slugify(receta.nombre)
    const outName = `${String(i + 1).padStart(2, '0')}--${receta.estrategia}--${slug}.jpg`
    const outPath = join(SALIDA_DIR, outName)
    process.stdout.write(`[${i + 1}/${recetas.length}] ${receta.nombre} ... `)

    const base = {
      id: receta.id,
      nombre: receta.nombre,
      estrategia: receta.estrategia,
      imagen_url: receta.imagen_url,
      ingredientes: ingredientesTexto(receta),
      prompt: receta.estrategia === 'ai_fallback' ? generationPrompt(receta) : editPrompt(receta),
    }

    try {
      let buffer
      let fuente = 'archivo existente'
      if (existsSync(outPath)) {
        buffer = readFileSync(outPath)
      } else {
        const candidate = await candidateFor(receta)
        buffer = candidate.buffer
        fuente = candidate.fuente
        writeFileSync(outPath, buffer)
      }
      resultados.push({ ...base, fuente, candidatoRel: outName, bytes: buffer.length })
      console.log(`OK ${(buffer.length / 1024).toFixed(0)}KB`)
    } catch (err) {
      resultados.push({ ...base, error: err.message })
      console.log(`ERROR ${err.message.slice(0, 110)}`)
    }

    if (i < recetas.length - 1) await new Promise(r => setTimeout(r, 1800))
  }

  writeFileSync(join(SALIDA_DIR, 'resultados.json'), JSON.stringify(resultados, null, 2))
  writePanel(resultados)
  console.log(`\nPanel: ${join(SALIDA_DIR, 'comparativa-piloto.html')}`)
}

main().catch(err => {
  console.error('FATAL:', err.message)
  process.exit(1)
})

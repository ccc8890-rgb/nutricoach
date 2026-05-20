/**
 * generar-panel-decision-imagenes.mjs
 *
 * Panel local para elegir la mejor variante por receta:
 * actual, real-first/search, Codex directo, pulido v2 o regenerar.
 *
 * No toca Supabase ni sube imagenes.
 */

import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(__dirname, '..')
const DIR = resolve(RAIZ, 'salidas', 'revision-imagenes', 'piloto-20-05-2026')

const RECETAS = [
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
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
}

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function findFile(files, slug, includes) {
  return files.find(f => f.includes(slug) && includes.every(x => f.includes(x))) || null
}

function imgBlock(label, key, src, receta) {
  const image = src
    ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(label)}">`
    : `<div class="missing">No disponible</div>`
  const disabled = src ? '' : ' disabled'
  return `<section class="variant" data-key="${key}">
    <h3>${escapeHtml(label)}</h3>
    ${image}
    <button${disabled} onclick="choose('${escapeHtml(receta)}','${key}', this)">Elegir ${escapeHtml(label)}</button>
  </section>`
}

async function main() {
  loadEnv()
  if (!existsSync(DIR)) throw new Error(`No existe ${DIR}`)
  const files = readdirSync(DIR).filter(f => f.endsWith('.jpg'))

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await sb.from('recetas').select('nombre,imagen_url').in('nombre', RECETAS)
  if (error) throw new Error(error.message)
  const byName = new Map((data || []).map(r => [r.nombre, r]))

  const cards = RECETAS.map((nombre, idx) => {
    const slug = slugify(nombre)
    const actual = byName.get(nombre)?.imagen_url || ''
    const real = findFile(files, slug, ['source_edit']) || findFile(files, slug, ['search_edit']) || findFile(files, slug, ['ai_fallback'])
    const codex = findFile(files, slug, ['codex_direct'])
    const pulido = findFile(files, slug, ['pulido_v2'])

    return `<article class="card" data-receta="${escapeHtml(nombre)}">
      <header>
        <span>#${idx + 1}</span>
        <h2>${escapeHtml(nombre)}</h2>
        <strong class="choice" id="choice-${idx}">Sin elegir</strong>
      </header>
      <div class="variants">
        ${imgBlock('Actual', 'actual', actual, nombre)}
        ${imgBlock('Real-first', 'real-first', real, nombre)}
        ${imgBlock('Codex', 'codex', codex, nombre)}
        ${imgBlock('Pulido v2', 'pulido-v2', pulido, nombre)}
        <section class="variant action">
          <h3>Regenerar</h3>
          <div class="missing">Marcar para nueva prueba</div>
          <button onclick="choose('${escapeHtml(nombre)}','regenerar', this)">Regenerar</button>
        </section>
      </div>
    </article>`
  }).join('\n')

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Decision imagenes recetas</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f1eb;color:#20221f;margin:0;padding:20px 20px 96px}
h1{margin:0 0 6px}.sub{margin:0 0 18px;color:#62665f}.card{background:white;border:1px solid #ddd7cb;border-radius:14px;padding:14px;margin:0 0 20px;box-shadow:0 2px 12px rgba(0,0,0,.05)}
header{display:flex;gap:10px;align-items:center;margin-bottom:12px}header span{background:#20221f;color:#fff;border-radius:999px;padding:3px 9px;font-size:12px}h2{font-size:18px;margin:0}.choice{margin-left:auto;font-size:13px;color:#777}.choice.done{color:#0f7b3f}
.variants{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.variant{background:#faf8f3;border-radius:10px;padding:8px}.variant h3{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#656960;margin:0 0 7px}
img,.missing{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;background:#e9e4da}.missing{display:flex;align-items:center;justify-content:center;text-align:center;color:#777;padding:10px;box-sizing:border-box}
button{width:100%;margin-top:8px;border:0;border-radius:8px;padding:9px 8px;background:#e1ddd4;color:#1f2320;font-weight:700;cursor:pointer}button:hover{background:#cfc8bb}button.selected{background:#111;color:white}button:disabled{opacity:.4;cursor:not-allowed}
.bar{position:fixed;left:16px;right:16px;bottom:16px;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border:1px solid #ddd7cb;border-radius:14px;padding:12px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 32px rgba(0,0,0,.12)}
.bar button{width:auto;margin:0;padding:11px 16px}.bar .primary{background:#111;color:white}.bar .counter{margin-right:auto;color:#555;font-size:14px}textarea{position:fixed;left:-9999px}
@media(max-width:1100px){.variants{grid-template-columns:repeat(2,1fr)}}@media(max-width:640px){body{padding:12px 12px 96px}.variants{grid-template-columns:1fr}header{align-items:flex-start;flex-wrap:wrap}.choice{margin-left:0}}
</style>
</head>
<body>
<h1>Elegir imagen ganadora</h1>
<p class="sub">Marca una opcion por receta. Se guarda en este navegador y puedes exportar resumen al final.</p>
${cards}
<div class="bar">
  <div class="counter"><span id="count">0</span> / ${RECETAS.length} elegidas</div>
  <button onclick="clearAll()">Limpiar</button>
  <button class="primary" onclick="exportSummary()">Copiar resumen</button>
</div>
<textarea id="copy"></textarea>
<script>
const recetas = ${JSON.stringify(RECETAS)};
const storageKey = 'nutricoach-imagenes-decision-v1';
let choices = JSON.parse(localStorage.getItem(storageKey) || '{}');

function choiceLabel(key){
  return ({'actual':'Actual','real-first':'Real-first','codex':'Codex','pulido-v2':'Pulido v2','regenerar':'Regenerar'})[key] || key;
}

function choose(receta, key, btn){
  choices[receta] = key;
  localStorage.setItem(storageKey, JSON.stringify(choices));
  render();
}

function render(){
  document.querySelectorAll('.card').forEach((card, idx) => {
    const receta = card.dataset.receta;
    const key = choices[receta];
    card.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    if (key) {
      const selected = [...card.querySelectorAll('button')].find(b => b.getAttribute('onclick')?.includes("'" + key + "'"));
      if (selected) selected.classList.add('selected');
    }
    const label = card.querySelector('.choice');
    label.textContent = key ? choiceLabel(key) : 'Sin elegir';
    label.classList.toggle('done', Boolean(key));
  });
  document.getElementById('count').textContent = Object.keys(choices).length;
}

function exportSummary(){
  const grouped = {};
  for (const receta of recetas) {
    const key = choices[receta] || 'sin-elegir';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(receta);
  }
  const order = ['real-first','codex','pulido-v2','actual','regenerar','sin-elegir'];
  let text = 'RESUMEN DECISION IMAGENES\\n';
  text += '─────────────────────\\n';
  for (const key of order) {
    const list = grouped[key] || [];
    text += '\\n' + choiceLabel(key) + ' (' + list.length + '):\\n';
    text += list.length ? list.map(x => '  • ' + x).join('\\n') + '\\n' : '  (ninguna)\\n';
  }
  const area = document.getElementById('copy');
  area.value = text;
  area.select();
  document.execCommand('copy');
  alert('Resumen copiado. Pegamelo en el chat.');
  console.log(text);
}

function clearAll(){
  if (!confirm('¿Limpiar todas las elecciones?')) return;
  choices = {};
  localStorage.removeItem(storageKey);
  render();
}

render();
</script>
</body>
</html>`

  const out = join(DIR, 'decision-imagenes.html')
  writeFileSync(out, html)
  console.log(out)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})

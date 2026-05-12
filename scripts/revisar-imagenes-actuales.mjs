/**
 * revisar-imagenes-actuales.mjs
 *
 * Consulta Supabase y genera un HTML con todas las recetas que tienen imagen_url,
 * para revisar visualmente el estilo actual.
 *
 * USO: node scripts/revisar-imagenes-actuales.mjs
 * SALIDA: salidas/revision-imagenes/revision-actual.html
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──
const envPath = resolve(RAÍZ, '.env.local')
if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        process.env[k] = v
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

function clasificarOrigen(url) {
    if (!url) return { tipo: 'sin_imagen', label: 'Sin imagen', color: '#86868b' }
    if (url.includes('supabase.co')) return { tipo: 'supabase_storage', label: 'Supabase Storage', color: '#34c759' }
    if (url.includes('replicate.delivery') || url.includes('replicate.com')) return { tipo: 'flux', label: 'Flux AI', color: '#ff9500' }
    if (url.includes('openai.com') || url.includes('oaidalleapiprodscus')) return { tipo: 'openai', label: 'GPT Image / DALL-E', color: '#0071e3' }
    if (url.includes('unsplash.com')) return { tipo: 'unsplash', label: 'Unsplash', color: '#5856d6' }
    if (url.includes('instagram.com')) return { tipo: 'instagram', label: 'Instagram', color: '#e1306c' }
    if (url.match(/\.(jpg|jpeg|png|webp)(\?|$)/i)) return { tipo: 'url_directa', label: 'URL directa', color: '#30b0c7' }
    return { tipo: 'otro', label: 'Otra fuente', color: '#8e8e93' }
}

async function main() {
    console.log('🔍 Consultando recetas con imagen...\n')

    // Todas las recetas
    const { data: todas, error } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, imagen_url, url_origen, created_at')
        .order('nombre')

    if (error) {
        console.error('❌ Error:', error.message)
        process.exit(1)
    }

    const conImagen = todas.filter(r => r.imagen_url)
    const sinImagen = todas.filter(r => !r.imagen_url)

    console.log(`📊 Total recetas: ${todas.length}`)
    console.log(`📸 Con imagen_url: ${conImagen.length}`)
    console.log(`  🖼️  Sin imagen: ${sinImagen.length}`)
    console.log()

    // Clasificar orígenes
    const origenes = {}
    for (const r of conImagen) {
        const info = clasificarOrigen(r.imagen_url)
        origenes[info.tipo] = (origenes[info.tipo] || 0) + 1
    }

    console.log('📈 Distribución por fuente:')
    for (const [tipo, count] of Object.entries(origenes).sort((a, b) => b[1] - a[1])) {
        console.log(`   ${tipo}: ${count}`)
    }
    console.log()

    // ── Generar HTML ──
    const cards = conImagen.map((r, i) => {
        const origen = clasificarOrigen(r.imagen_url)
        return `
        <div class="receta-card" data-tipo="${origen.tipo}">
            <div class="card-header" style="border-left: 4px solid ${origen.color}">
                <div class="receta-num">#${i + 1}</div>
                <div class="receta-info">
                    <h2>${r.nombre}</h2>
                    <div class="receta-meta">
                        <span class="badge categoria">${r.categoria || 'Sin categoría'}</span>
                        <span class="badge origen" style="background:${origen.color}">${origen.label}</span>
                    </div>
                </div>
            </div>
            <div class="img-container">
                <img src="${r.imagen_url}" alt="${r.nombre}" loading="lazy" crossorigin="anonymous"
                     onerror="this.parentElement.innerHTML='<div class=\\'img-error\\'>❌ Imagen no disponible<br><small>' + this.src.substring(0,80) + '...</small></div>'">
            </div>
            <div class="card-footer">
                <div class="receta-id" title="${r.id}">ID: ${r.id.substring(0, 8)}...</div>
                ${r.url_origen ? `<a href="${r.url_origen}" target="_blank" class="url-origen">🔗 Fuente original</a>` : '<span class="url-origen muted">Sin fuente</span>'}
                <div class="acciones">
                    <button class="btn-aprobar" data-receta-id="${r.id}" data-receta-nombre="${r.nombre.replace(/"/g, '"')}" onclick="aprobar(this)">✅ Aceptar</button>
                    <button class="btn-rechazar" onclick="rechazar(this)">❌ Regenerar</button>
                </div>
            </div>
        </div>`
    }).join('')

    // Cards para las que no tienen imagen
    const sinImagenCards = sinImagen.map((r, i) => `
        <div class="receta-card sin-imagen">
            <div class="card-header" style="border-left: 4px solid #86868b; opacity: 0.5">
                <div class="receta-num">#${conImagen.length + i + 1}</div>
                <div class="receta-info">
                    <h2>${r.nombre}</h2>
                    <div class="receta-meta">
                        <span class="badge categoria">${r.categoria || 'Sin categoría'}</span>
                        <span class="badge origen" style="background:#86868b">Pendiente</span>
                    </div>
                </div>
            </div>
            <div class="img-container no-img">
                <div class="img-placeholder">📸<br>Sin imagen</div>
            </div>
            <div class="card-footer">
                <div class="receta-id">ID: ${r.id.substring(0, 8)}...</div>
                ${r.url_origen ? `<a href="${r.url_origen}" target="_blank" class="url-origen">🔗 Fuente original</a>` : '<span class="url-origen muted">Sin fuente</span>'}
            </div>
        </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisión Visual — Imágenes de Recetas</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7; color: #1d1d1f; padding: 24px;
}
h1 { font-size: 26px; margin-bottom: 4px; display: flex; align-items: center; gap: 12px; }
.subtitle { color: #86868b; margin-bottom: 20px; }
.stats-bar {
    display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
}
.stat {
    background: white; padding: 12px 20px; border-radius: 12px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.stat .num { font-size: 28px; font-weight: 700; }
.stat .label { font-size: 13px; color: #86868b; }
.filtros {
    display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;
}
.filtro {
    padding: 6px 14px; border-radius: 20px; border: 1.5px solid #d1d1d6;
    background: white; cursor: pointer; font-size: 13px; font-weight: 500;
    transition: all 0.2s;
}
.filtro:hover { border-color: #0071e3; }
.filtro.active { background: #0071e3; color: white; border-color: #0071e3; }
.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 16px;
}
.receta-card {
    background: white; border-radius: 16px; overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06); transition: all 0.3s;
}
.receta-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.receta-card.aprobada { box-shadow: 0 0 0 3px #34c759; }
.receta-card.rechazada { opacity: 0.4; }
.card-header {
    padding: 14px; display: flex; gap: 10px; align-items: flex-start;
}
.receta-num {
    font-size: 12px; font-weight: 700; color: #86868b;
    background: #f0f0f0; width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 8px; flex-shrink: 0;
}
.receta-info { flex: 1; min-width: 0; }
.receta-info h2 { font-size: 15px; font-weight: 600; margin-bottom: 4px; line-height: 1.3; }
.receta-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
.badge.categoria { background: #f0f0f0; color: #555; }
.badge.origen { color: white; }
.img-container {
    aspect-ratio: 1; background: #f0f0f0; overflow: hidden;
}
.img-container img {
    width: 100%; height: 100%; object-fit: cover;
    transition: transform 0.3s;
}
.img-container:hover img { transform: scale(1.03); }
.img-error {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; color: #ff3b30; font-size: 14px; background: #fef2f2;
}
.img-error small { color: #86868b; font-size: 10px; margin-top: 4px; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.no-img .img-placeholder {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; color: #86868b; font-size: 24px; background: #f0f0f0;
}
.card-footer {
    padding: 10px 14px; border-top: 1px solid #f0f0f0;
    display: flex; align-items: center; gap: 8px; font-size: 11px;
}
.receta-id { color: #86868b; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url-origen { color: #0071e3; text-decoration: none; font-weight: 500; }
.url-origen.muted { color: #86868b; }
.acciones { display: flex; gap: 4px; }
.acciones button {
    padding: 4px 10px; border: none; border-radius: 8px;
    font-size: 11px; font-weight: 600; cursor: pointer;
    transition: all 0.2s;
}
.btn-aprobar { background: #e8f8ee; color: #34c759; }
.btn-aprobar:hover { background: #34c759; color: white; }
.btn-aprobar.hecho { background: #34c759; color: white; cursor: default; }
.btn-rechazar { background: #fef2f2; color: #ff3b30; }
.btn-rechazar:hover { background: #ff3b30; color: white; }
.btn-rechazar.hecho { background: #ff3b30; color: white; cursor: default; }
.sin-imagen { opacity: 0.7; }
#resumen {
    position: sticky; bottom: 0; background: rgba(255,255,255,0.95);
    backdrop-filter: blur(10px); padding: 16px 24px;
    border-radius: 16px 16px 0 0; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    margin-top: 24px; display: flex; gap: 16px; align-items: center;
    justify-content: space-between; flex-wrap: wrap;
}
#resumen .stats { display: flex; gap: 16px; font-size: 14px; }
#resumen .stats span { font-weight: 600; }
#resumen .stats .ok { color: #34c759; }
#resumen .stats .ko { color: #ff3b30; }
#resumen .stats .total { color: #1d1d1f; }
</style>
</head>
<body>

<h1>📸 Revisión visual — Imágenes de recetas</h1>
<p class="subtitle">Selecciona qué imágenes te gustan y cuáles habría que regenerar</p>

<div class="stats-bar">
    <div class="stat"><div class="num">${todas.length}</div><div class="label">Total recetas</div></div>
    <div class="stat"><div class="num" style="color:#34c759">${conImagen.length}</div><div class="label">Con imagen</div></div>
    <div class="stat"><div class="num" style="color:#ff3b30">${sinImagen.length}</div><div class="label">Sin imagen</div></div>
</div>

<div class="filtros">
    <button class="filtro active" onclick="filtrar('todas')">Todas (${todas.length})</button>
    <button class="filtro" onclick="filtrar('con_imagen')">Con imagen (${conImagen.length})</button>
    <button class="filtro" onclick="filtrar('sin_imagen')">Sin imagen (${sinImagen.length})</button>
    <button class="filtro" onclick="filtrar('supabase_storage')">Supabase Storage</button>
    <button class="filtro" onclick="filtrar('flux')">Flux AI</button>
    <button class="filtro" onclick="filtrar('openai')">GPT/DALL-E</button>
    <button class="filtro" onclick="filtrar('aprobadas')">✅ Aprobadas</button>
    <button class="filtro" onclick="filtrar('rechazadas')">❌ Rechazadas</button>
</div>

<div class="grid" id="grid">
    ${cards}
    ${sinImagenCards}
</div>

<div id="resumen">
    <div class="stats">
        <span>✅ Aceptadas: <span class="ok" id="count-aprobadas">0</span></span>
        <span>❌ Regenerar: <span class="ko" id="count-rechazadas">0</span></span>
        <span>📸 Pendientes: <span class="total" id="count-pendientes">${sinImagen.length}</span></span>
    </div>
    <div>
        <button class="btn-aprobar" style="padding: 8px 20px; font-size:13px" onclick="generarResumen()">📊 Generar resumen</button>
    </div>
</div>

<script>
let aprobadas = new Set();
let rechazadas = new Set();

function aprobar(btn) {
    const card = btn.closest('.receta-card');
    const id = btn.dataset.recetaId;
    if (aprobadas.has(id)) {
        aprobadas.delete(id);
        card.classList.remove('aprobada');
        btn.classList.remove('hecho');
        btn.textContent = '✅ Aceptar';
    } else {
        rechazadas.delete(id);
        card.classList.remove('rechazada');
        aprobadas.add(id);
        card.classList.add('aprobada');
        btn.classList.add('hecho');
        btn.textContent = '✅ Aceptada';
        // Resetear botón rechazar si estaba
        const rechazarBtn = card.querySelector('.btn-rechazar');
        if (rechazarBtn) { rechazarBtn.classList.remove('hecho'); rechazarBtn.textContent = '❌ Regenerar'; }
    }
    actualizarConteo();
}

function rechazar(btn) {
    const card = btn.closest('.receta-card');
    const id = btn.closest('.receta-card').querySelector('[data-receta-id]')?.dataset.recetaId;
    if (!id) return;
    if (rechazadas.has(id)) {
        rechazadas.delete(id);
        card.classList.remove('rechazada');
        btn.classList.remove('hecho');
        btn.textContent = '❌ Regenerar';
    } else {
        aprobadas.delete(id);
        card.classList.remove('aprobada');
        rechazadas.add(id);
        card.classList.add('rechazada');
        btn.classList.add('hecho');
        btn.textContent = '❌ Regenerar';
        const aprobarBtn = card.querySelector('.btn-aprobar');
        if (aprobarBtn) { aprobarBtn.classList.remove('hecho'); aprobarBtn.textContent = '✅ Aceptar'; }
    }
    actualizarConteo();
}

function actualizarConteo() {
    document.getElementById('count-aprobadas').textContent = aprobadas.size;
    document.getElementById('count-rechazadas').textContent = rechazadas.size;
}

function filtrar(tipo) {
    document.querySelectorAll('.filtro').forEach(f => f.classList.remove('active'));
    event.target.classList.add('active');

    document.querySelectorAll('.receta-card').forEach(card => {
        if (tipo === 'todas') { card.style.display = ''; return; }
        if (tipo === 'con_imagen') {
            card.style.display = card.classList.contains('sin-imagen') ? 'none' : '';
            return;
        }
        if (tipo === 'sin_imagen') {
            card.style.display = card.classList.contains('sin-imagen') ? '' : 'none';
            return;
        }
        if (tipo === 'aprobadas') {
            const id = card.querySelector('[data-receta-id]')?.dataset.recetaId;
            card.style.display = (id && aprobadas.has(id)) ? '' : 'none';
            return;
        }
        if (tipo === 'rechazadas') {
            const id = card.querySelector('[data-receta-id]')?.dataset.recetaId;
            card.style.display = (id && rechazadas.has(id)) ? '' : 'none';
            return;
        }
        // Filtrar por tipo de origen
        card.style.display = card.dataset.tipo === tipo ? '' : 'none';
    });
}

function generarResumen() {
    const cards = document.querySelectorAll('.receta-card:not(.sin-imagen)');
    const resumen = {
        aprobadas: [],
        rechazadas: [],
        pendientes: []
    };

    cards.forEach(card => {
        const id = card.querySelector('[data-receta-id]')?.dataset.recetaId;
        const nombre = card.querySelector('[data-receta-nombre]')?.dataset.recetaNombre || card.querySelector('h2')?.textContent || '?';
        if (id && aprobadas.has(id)) resumen.aprobadas.push(nombre);
        else if (id && rechazadas.has(id)) resumen.rechazadas.push(nombre);
        else resumen.pendientes.push(nombre);
    });

    const msg = \`📊 RESUMEN DE REVISIÓN
─────────────────────
✅ Aceptadas (\${resumen.aprobadas.length}):
\${resumen.aprobadas.map(n => '  • ' + n).join('\\n') || '  (ninguna)'}

❌ Regenerar (\${resumen.rechazadas.length}):
\${resumen.rechazadas.map(n => '  • ' + n).join('\\n') || '  (ninguna)'}

⏳ Pendientes de revisar (\${resumen.pendientes.length}):
\${resumen.pendientes.map(n => '  • ' + n).join('\\n') || '  (ninguna)'}

📸 Sin imagen en BD: ${sinImagen.length}
─────────────────────\`;

    // Mostrar en un modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
    const pre = document.createElement('pre');
    pre.style.cssText = 'background:white;padding:24px;border-radius:16px;max-width:600px;max-height:80vh;overflow:auto;font-size:13px;line-height:1.6';
    pre.textContent = msg;
    const close = document.createElement('button');
    close.textContent = 'Cerrar';
    close.style.cssText = 'margin-top:16px;padding:8px 20px;border:none;border-radius:8px;background:#0071e3;color:white;font-size:14px;cursor:pointer;display:block';
    close.onclick = () => modal.remove();
    pre.appendChild(close);
    modal.appendChild(pre);
    document.body.appendChild(modal);

    console.log(msg);
}
</script>

</body>
</html>`

    const outPath = resolve(SALIDA_DIR, 'revision-actual.html')
    writeFileSync(outPath, html)
    console.log(`✅ HTML generado: ${outPath}`)
    console.log(`   file://${outPath}`)
    console.log()
    console.log('📋 Lista de recetas CON imagen:')
    conImagen.forEach((r, i) => {
        const origen = clasificarOrigen(r.imagen_url)
        console.log(`   ${String(i + 1).padStart(3)}. ${r.nombre.padEnd(50)} ${origen.label}`)
    })
    console.log()
    console.log('📋 Lista de recetas SIN imagen:')
    sinImagen.forEach((r, i) => {
        console.log(`   ${String(i + 1).padStart(3)}. ${r.nombre.padEnd(50)} ${r.categoria || '?'}`)
    })
}

main().catch(err => { console.error('❌ Error:', err); process.exit(1) })

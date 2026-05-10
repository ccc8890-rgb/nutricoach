import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'

// Load env
const envPath = resolve(process.cwd(), '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

function nombreToSlug(n) {
    return n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fuzzyMatch(slug, nombre) {
    const sw = new Set(slug.split('-').filter(w => w.length > 2))
    const ws = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(w => w.length > 2)
    const nw = new Set(ws)
    if (sw.size === 0 || nw.size === 0) return 0
    let ov = 0
    for (const w of sw) {
        if (nw.has(w)) { ov++; continue }
        for (const n of nw) { if (n.startsWith(w) || w.startsWith(n)) { ov++; break } }
    }
    return ov / Math.max(sw.size, nw.size)
}

const PRIORIDAD = ['og_image', 'flux_img2img', 'ai_gen', 'flux_txt2img']

async function main() {
    const salidaDir = '/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/salidas/revision-imagenes'
    const archivos = readdirSync(salidaDir)

    // Group files by slug
    const porSlug = {}
    for (const f of archivos) {
        for (const metodo of PRIORIDAD) {
            const prefix = metodo + '--'
            if (!f.startsWith(prefix)) continue
            const slug = f.slice(prefix.length).replace(/\.(webp|jpg|png|jpeg)$/, '')
            if (!porSlug[slug]) porSlug[slug] = []
            const buf = readFileSync(resolve(salidaDir, f))
            const mime = f.match(/\.(jpg|jpeg)$/) ? 'image/jpeg' : 'image/webp'
            porSlug[slug].push({ metodo, archivo: f, b64: buf.toString('base64'), mime })
            break
        }
    }

    const { data: recetas } = await supabase.from('recetas').select('id, nombre, url_origen, imagen_url').order('nombre')

    const cards = []
    for (const r of recetas) {
        const slug = nombreToSlug(r.nombre)
        let bestSlug = slug
        let bestFiles = porSlug[slug] || []
        if (bestFiles.length === 0) {
            let bestScore = 0
            for (const s of Object.keys(porSlug)) {
                const score = fuzzyMatch(s, r.nombre)
                if (score > bestScore) { bestScore = score; bestSlug = s }
            }
            if (bestScore >= 0.5) bestFiles = porSlug[bestSlug] || []
        }
        bestFiles.sort((a, b) => PRIORIDAD.indexOf(a.metodo) - PRIORIDAD.indexOf(b.metodo))
        const mejor = bestFiles.length > 0 ? bestFiles[0] : null
        const estado = mejor && mejor.metodo === 'flux_txt2img' ? 'regen' : 'ok'

        cards.push({
            idx: cards.length,
            nombre: r.nombre,
            estado,
            metodo: mejor ? mejor.metodo : 'bd',
            total: bestFiles.length,
            imgSrc: mejor ? (`data:${mejor.mime};base64,${mejor.b64}`) : (r.imagenUrl || '')
        })
    }

    // Escape single quotes for JS
    const esc = s => s.replace(/'/g, "\\'")

    const items = cards.map(c =>
        `{i:${c.idx},n:'${esc(c.nombre)}',e:'${c.estado}',m:'${c.metodo}',t:${c.total},s:'${c.imgSrc}'}`
    ).join(',\n')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisar candidatas — NutriCoach</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;color:#1d1d1f;padding:16px}
h1{font-size:20px;font-weight:600}
.sub{color:#86868b;font-size:12px;margin-bottom:12px}
.stats{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.stat{background:#fff;padding:8px 14px;border-radius:8px;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
.stat strong{font-size:16px;display:block}
.stat.regen{border-left:3px solid #ff9500}
.stat.ok{border-left:3px solid #34c759}
.actions{margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap}
.actions button{padding:6px 14px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer}
.btn-approve{background:#34c759;color:#fff}
.btn-regen-all{background:#ff9500;color:#fff}
.filtros{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.filtros button{padding:4px 10px;border-radius:12px;border:1px solid #d2d2d7;background:#fff;cursor:pointer;font-size:11px}
.filtros button.on{background:#007aff;color:#fff;border-color:#007aff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.card{background:#fff;border-radius:10px;padding:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05)}
.card.regen{border-left:3px solid #ff9500}
.card.ok{border-left:3px solid #34c759}
.card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;background:#eee}
.card h3{font-size:11px;font-weight:500;margin:4px 0 2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card .tag{font-size:9px;padding:1px 5px;border-radius:6px;font-weight:600;display:inline-block;margin-bottom:3px}
.t-ok{background:#34c759;color:#fff}
.t-regen{background:#ff9500;color:#fff}
.t-bd{background:#8e8e93;color:#fff}
.t-og{background:#34c759;color:#fff}
.t-ai{background:#007aff;color:#fff}
.card .btns{display:flex;gap:3px;margin-top:4px}
.card .btns button{flex:1;padding:3px 0;border-radius:4px;border:none;font-size:10px;font-weight:500;cursor:pointer}
.btn-yes{background:#34c759;color:#fff}
.btn-no{background:#ff9500;color:#fff}
.btn-yes:disabled,.btn-no:disabled{opacity:0.3}
.empty{text-align:center;padding:30px;color:#86868b;font-size:13px}
</style>
</head>
<body>

<h1>🖼️ Candidatas finales</h1>
<p class="sub">✅ aprobadas / 🟠 flux_txt2img (regenerar con GPT-4o)</p>

<div class="stats" id="stats"></div>
<div class="actions">
  <button class="btn-approve" onclick="subir()">📤 Subir aprobadas</button>
</div>
<div class="filtros" id="filtros">
  <button data-f="all" class="on">Todas</button>
  <button data-f="ok">✅ Aprobadas</button>
  <button data-f="regen">🟠 A regenerar</button>
</div>
<div class="grid" id="grid"></div>

<script>
const DATA = [${items}];

const TAGS = {
  og_image:'📸 Real',flux_img2img:'🎨 Refine GPT',ai_gen:'🤖 GPT-4o',flux_txt2img:'⚡ Flux',bd:'📎 BD'
};
const TAGCLASS = {
  og_image:'t-og',flux_img2img:'t-ok',ai_gen:'t-ai',flux_txt2img:'t-regen',bd:'t-bd'
};

function render(f) {
  const g = document.getElementById('grid');
  let h = '';
  const st = {total:DATA.length, ok:0, regen:0};
  DATA.forEach((c,i) => {
    if (c.e === 'ok') st.ok++;
    else st.regen++;
    if (f !== 'all' && c.e !== f) return;
    const r = c.e === 'regen';
    h += '<div class="card ' + c.e + '" data-i="' + i + '">';
    h += '<img src="' + c.s + '" alt="' + c.n + '" loading="lazy">';
    h += '<div class="tag ' + (TAGCLASS[c.m]||'') + '">' + (TAGS[c.m]||c.m) + '</div>';
    h += '<h3 title="' + c.n + '">' + c.n + '</h3>';
    h += '<div class="btns">';
    if (r) {
      h += '<button class="btn-yes" onclick="ap(' + i + ')">✅ Sí</button>';
      h += '<button class="btn-no" onclick="rg(' + i + ')">♻️ No</button>';
    } else {
      h += '<button class="btn-yes" disabled>✅ Sí</button>';
      h += '<button class="btn-no" onclick="rg(' + i + ')">♻️ No</button>';
    }
    h += '</div></div>';
  });
  g.innerHTML = h || '<div class="empty">Sin resultados</div>';
  document.getElementById('stats').innerHTML =
    '<div class="stat"><strong>' + st.total + '</strong>Total</div>' +
    '<div class="stat ok"><strong>' + st.ok + '</strong>Aprobadas</div>' +
    '<div class="stat regen"><strong>' + st.regen + '</strong>A regenerar</div>';
}

function ap(i) {
  const el = document.querySelector('.card[data-i="' + i + '"]');
  if (!el) return;
  el.className = 'card ok';
  el.querySelector('.btn-yes').disabled = true;
  DATA[i].e = 'ok';
}

function rg(i) {
  const el = document.querySelector('.card[data-i="' + i + '"]');
  if (!el) return;
  el.className = 'card regen';
  el.querySelector('.btn-yes').disabled = false;
  DATA[i].e = 'regen';
}

// Filtros
document.getElementById('filtros').addEventListener('click', function(e) {
  if (e.target.tagName !== 'BUTTON') return;
  document.querySelectorAll('#filtros button').forEach(b => b.classList.remove('on'));
  e.target.classList.add('on');
  render(e.target.dataset.f);
});

function subir() {
  const n = DATA.filter(c => c.e === 'ok').length;
  if (!confirm('¿Subir ' + n + ' imágenes aprobadas a Supabase?')) return;
  fetch('http://localhost:3008/api/subir-imagenes-aprobadas', {method:'POST'})
    .then(r => r.json()).then(d => alert(d.message||'✅ Subidas')).catch(e => alert('Error: ' + e.message));
}

render('all');
</script>
</body>
</html>`

    const out = '/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/salidas/revision-imagenes/candidatas.html'
    writeFileSync(out, html)
    const sizeKB = (html.length / 1024).toFixed(0)
    console.log(`✅ candidatas.html (${sizeKB}KB) — ${cards.length} recetas`)
    console.log(`   OK: ${cards.filter(c => c.estado === 'ok').length}`)
    console.log(`   Regenerar: ${cards.filter(c => c.estado === 'regen').length} (~$${(cards.filter(c => c.estado === 'regen').length * 0.034).toFixed(2)})`)
}

main().catch(e => { console.error(e); process.exit(1) })

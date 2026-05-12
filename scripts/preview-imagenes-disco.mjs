/**
 * preview-imagenes-disco.mjs
 *
 * Genera un HTML comparativo de las imágenes en disco vs en Supabase,
 * clasificadas por tipo de fuente (og_image, flux_img2img, ai_gen, flux_txt2img).
 *
 * USO: node scripts/preview-imagenes-disco.mjs
 * SALIDA: salidas/revision-imagenes/preview-disco.html
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs'
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

const DISCO_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')

if (!existsSync(DISCO_DIR)) {
    console.error(`❌ No existe ${DISCO_DIR}`)
    process.exit(1)
}

// ── Leer archivos del disco ──
const allFiles = readdirSync(DISCO_DIR).filter(f =>
    f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.jpeg')
)

// Clasificar
function clasificarFile(filename) {
    if (filename.startsWith('og_image--')) return 'og_image'
    if (filename.startsWith('flux_img2img--')) return 'flux_img2img'
    if (filename.startsWith('ai_gen--')) return 'ai_gen'
    if (filename.startsWith('flux_txt2img--')) return 'flux_txt2img'
    if (filename.startsWith('agent_browser--')) return 'agent_browser'
    if (filename.startsWith('playwright--')) return 'playwright'
    return 'otro'
}

function extraerSlug(filename) {
    const match = filename.match(/^[a-z0-9_]+--(.+)\.(webp|jpg|jpeg)$/)
    return match ? match[1] : filename
}

// Normalizar slug a nombre para comparación
function slugToComparable(slug) {
    return slug
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ').trim()
}

const fileRecords = allFiles.map(f => ({
    filename: f,
    tipo: clasificarFile(f),
    slug: extraerSlug(f),
    fullPath: resolve(DISCO_DIR, f),
}))

// ── Obtener recetas de Supabase ──
async function main() {
    console.log('📦 Cargando recetas de Supabase...')
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen, imagen_url, estado')
        .order('nombre')

    if (error) {
        console.error('❌ Error:', error.message)
        process.exit(1)
    }

    console.log(`   ${recetas.length} recetas cargadas`)
    console.log(`   ${allFiles.length} archivos en disco\n`)

    // ── Matchear archivos con recetas ──
    const matched = fileRecords.map(f => {
        const comparable = slugToComparable(f.slug)
        const match = recetas.find(r => {
            const rName = slugToComparable(r.nombre)
            // Check if words overlap sufficiently
            const words = comparable.split(' ').filter(w => w.length > 2)
            const matchCount = words.filter(w => rName.includes(w)).length
            return matchCount >= Math.max(1, Math.floor(words.length * 0.4))
        })
        return { ...f, receta: match || null }
    })

    // ── Agrupar por receta ──
    const recetaMap = {}
    for (const r of recetas) {
        recetaMap[r.nombre] = {
            ...r,
            enDisco: [],
            mejorTipo: null,
        }
    }

    for (const m of matched) {
        if (m.receta) {
            if (!recetaMap[m.receta.nombre]) {
                recetaMap[m.receta.nombre] = { ...m.receta, enDisco: [], mejorTipo: null }
            }
            recetaMap[m.receta.nombre].enDisco.push(m)
        }
    }

    // Determinar mejor tipo para cada receta (en disco)
    const PRIORIDAD = ['og_image', 'flux_img2img', 'ai_gen', 'agent_browser', 'playwright', 'flux_txt2img']
    function mejorTipo(files) {
        let best = 999
        let bestT = null
        for (const f of files) {
            const idx = PRIORIDAD.indexOf(f.tipo)
            if (idx !== -1 && idx < best) {
                best = idx
                bestT = f.tipo
            }
        }
        return bestT
    }

    for (const r of Object.values(recetaMap)) {
        if (r.enDisco.length > 0) {
            r.mejorTipo = mejorTipo(r.enDisco)
        }
        // Determinar estado en Supabase
        r.enSupabase = !!r.imagen_url
        // Clasificar origen Supabase
        if (r.imagen_url) {
            if (r.imagen_url.includes('supabase.co')) r.origenSupabase = 'supabase_storage'
            else if (r.imagen_url.includes('replicate')) r.origenSupabase = 'flux'
            else if (r.imagen_url.includes('openai') || r.imagen_url.includes('oaidalle')) r.origenSupabase = 'openai'
            else if (r.imagen_url.includes('unsplash')) r.origenSupabase = 'unsplash'
            else if (r.imagen_url.includes('instagram')) r.origenSupabase = 'instagram'
            else r.origenSupabase = 'url_directa'
        } else {
            r.origenSupabase = null
        }
    }

    // ── Estadísticas ──
    const conImagen = Object.values(recetaMap).filter(r => r.enSupabase)
    const sinImagen = Object.values(recetaMap).filter(r => !r.enSupabase)
    const conDisco = Object.values(recetaMap).filter(r => r.enDisco.length > 0)

    const stats = {
        total: recetas.length,
        conImagenSupabase: conImagen.length,
        sinImagen: sinImagen.length,
        conDisco: conDisco.length,
        // Por tipo en disco
        porTipoDisco: {},
        // Cuántas tienen cada tipo como MEJOR imagen en disco
        mejorTipoCounts: {},
        // Cuántas tienen en Supabase pero NO tienen la mejor versión en disco
        tienenSupabaseSinMejorDisco: [],
    }

    for (const t of PRIORIDAD) {
        stats.porTipoDisco[t] = fileRecords.filter(f => f.tipo === t).length
        stats.mejorTipoCounts[t] = Object.values(recetaMap).filter(r => r.mejorTipo === t).length
    }

    // Recetas que tienen imagen en Supabase pero podrían mejorarse con disco
    for (const r of Object.values(recetaMap)) {
        if (r.enSupabase && r.enDisco.length > 0) {
            const supabaseTipo = r.origenSupabase
            const discoTipo = r.mejorTipo
            // Si en disco hay og_image o flux_img2img, es mejor que lo que sea que tenga en Supabase
            if (discoTipo === 'og_image' || discoTipo === 'flux_img2img') {
                stats.tienenSupabaseSinMejorDisco.push({
                    nombre: r.nombre,
                    enSupabase: supabaseTipo,
                    mejorEnDisco: discoTipo,
                    archivos: r.enDisco.map(f => f.tipo + '--' + f.slug + '.' + (f.filename.endsWith('.webp') ? 'webp' : 'jpg')),
                })
            }
        }
    }

    // ── Generar HTML ──
    const html = generarHTML(recetas, recetaMap, fileRecords, matched, stats)
    const outPath = resolve(SALIDA_DIR, 'preview-disco.html')
    writeFileSync(outPath, html)
    console.log(`\n📄 Preview generado: ${outPath}`)
}

// ── HTML ──
function generarHTML(recetas, recetaMap, fileRecords, matched, stats) {
    const recetasList = Object.values(recetaMap)

    const rows = recetasList.map(r => {
        const discoHtml = r.enDisco.map(f => {
            const tipoLabel = {
                'og_image': '📸 OG',
                'flux_img2img': '🎨 Claude',
                'ai_gen': '🤖 GPT-4o',
                'flux_txt2img': '⚡ Flux',
            }[f.tipo] || f.tipo
            return `<span class="disco-badge tipo-${f.tipo}">${tipoLabel}</span>`
        }).join('')

        const supabaseHtml = r.enSupabase
            ? `<span class="supabase-badge si">✅ ${r.origenSupabase || 'Storage'}</span>`
            : `<span class="supabase-badge no">❌ Sin imagen</span>`

        const claseMejor = r.mejorTipo ? `fila-mejor-${r.mejorTipo}` : ''
        const mejorLabel = r.mejorTipo ? ({
            'og_image': '📸 Original',
            'flux_img2img': '🎨 Claude (procesada)',
            'ai_gen': '🤖 GPT-4o',
            'flux_txt2img': '⚡ Flux txt2img',
        })[r.mejorTipo] || r.mejorTipo : '—'

        // Ver si la imagen en Supabase es peor que la mejor en disco
        const sePuedeMejorar = r.enSupabase && r.enDisco.length > 0
            && (r.mejorTipo === 'og_image' || r.mejorTipo === 'flux_img2img')
            && r.origenSupabase !== 'supabase_storage'

        return `
<tr class="${claseMejor}">
    <td>${r.nombre}</td>
    <td class="categoria">${r.categoria || '—'}</td>
    <td>${supabaseHtml}</td>
    <td>${discoHtml || '<span class="disco-badge none">—</span>'}</td>
    <td>${mejorLabel}</td>
    <td>${r.url_origen ? '🔗' : '—'}</td>
    <td>${sePuedeMejorar ? '⬆️' : '—'}</td>
</tr>`
    }).join('\n')

    const mejorarCount = stats.tienenSupabaseSinMejorDisco.length

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>📸 Preview — Imágenes en disco vs Supabase</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 24px;
}
h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
.subtitle { color: #86868b; font-size: 14px; margin-bottom: 20px; }

/* Stats cards */
.stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-bottom: 24px;
}
.stat-card {
    background: white; border-radius: 12px; padding: 16px; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.stat-card .num { font-size: 28px; font-weight: 700; }
.stat-card .label { font-size: 12px; color: #86868b; margin-top: 2px; }

/* Filters */
.filters {
    display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
}
.filters button {
    padding: 6px 16px; border-radius: 20px; border: 1px solid #d2d2d7;
    background: white; cursor: pointer; font-size: 13px; transition: all 0.15s;
}
.filters button:hover { background: #e8e8ed; }
.filters button.activo { background: #0071e3; color: white; border-color: #0071e3; }
.filters button.contador { position: relative; }
.filters button .count {
    font-size: 10px; background: #ff3b30; color: white;
    border-radius: 10px; padding: 1px 6px; margin-left: 4px;
}

/* Table */
.tabla-wrap {
    background: white; border-radius: 16px; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
    text-align: left; padding: 12px 14px; font-weight: 600;
    font-size: 12px; color: #86868b; text-transform: uppercase;
    letter-spacing: 0.5px; background: #fbfbfd; border-bottom: 1px solid #e8e8ed;
    position: sticky; top: 0; z-index: 1;
}
td { padding: 10px 14px; border-bottom: 1px solid #f0f0f2; }
tr:hover { background: #f8f8fa; }
tr.oculta { display: none; }
.categoria { font-size: 11px; color: #86868b; }

/* Badges */
.disco-badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 11px; font-weight: 600; margin: 1px;
}
.tipo-og_image { background: #e8f5e9; color: #2e7d32; }
.tipo-flux_img2img { background: #fff3e0; color: #e65100; }
.tipo-ai_gen { background: #e3f2fd; color: #1565c0; }
.tipo-flux_txt2img { background: #fce4ec; color: #c62828; }
.tipo-agent_browser { background: #f3e5f5; color: #6a1b9a; }
.tipo-playwright { background: #e0f2f1; color: #00695c; }
.none { background: #f5f5f5; color: #9e9e9e; }

.supabase-badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 11px; font-weight: 600;
}
.supabase-badge.si { background: #e8f5e9; color: #2e7d32; }
.supabase-badge.no { background: #fce4ec; color: #c62828; }

/* Row highlight */
.fila-mejor-og_image { border-left: 3px solid #2e7d32; }
.fila-mejor-flux_img2img { border-left: 3px solid #e65100; }
.fila-mejor-ai_gen { border-left: 3px solid #1565c0; }
.fila-mejor-flux_txt2img { border-left: 3px solid #c62828; }

/* Summary section */
.summary {
    margin-top: 20px; background: white; border-radius: 16px;
    padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.summary h2 { font-size: 16px; margin-bottom: 12px; }
.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.summary-col h3 { font-size: 13px; color: #86868b; margin-bottom: 6px; }
.summary-col ul { list-style: none; }
.summary-col li { font-size: 12px; padding: 3px 0; border-bottom: 1px solid #f0f0f2; }
</style>
</head>
<body>

<h1>📸 Imágenes en disco vs Supabase</h1>
<p class="subtitle">Comparativa de 320 archivos en disco contra ${stats.total} recetas en BD</p>

<div class="stats-grid">
    <div class="stat-card">
        <div class="num">${stats.total}</div>
        <div class="label">Recetas totales</div>
    </div>
    <div class="stat-card">
        <div class="num">${stats.conImagenSupabase}</div>
        <div class="label">Con imagen en Supabase</div>
    </div>
    <div class="stat-card">
        <div class="num">${stats.sinImagen}</div>
        <div class="label">Sin imagen en Supabase</div>
    </div>
    <div class="stat-card">
        <div class="num">${stats.conDisco}</div>
        <div class="label">Con imágenes en disco</div>
    </div>
    <div class="stat-card" style="background: #fff3e0;">
        <div class="num">${mejorarCount}</div>
        <div class="label">Mejorables con disco 🎯</div>
    </div>
</div>

<div class="stats-grid">
    <div class="stat-card" style="background: #e8f5e9;">
        <div class="num">${stats.porTipoDisco.og_image || 0}</div>
        <div class="label">📸 og_image (originales)</div>
    </div>
    <div class="stat-card" style="background: #fff3e0;">
        <div class="num">${stats.porTipoDisco.flux_img2img || 0}</div>
        <div class="label">🎨 flux_img2img (Claude)</div>
    </div>
    <div class="stat-card" style="background: #e3f2fd;">
        <div class="num">${stats.porTipoDisco.ai_gen || 0}</div>
        <div class="label">🤖 ai_gen (GPT-4o)</div>
    </div>
    <div class="stat-card" style="background: #fce4ec;">
        <div class="num">${stats.porTipoDisco.flux_txt2img || 0}</div>
        <div class="label">⚡ flux_txt2img (bodegón)</div>
    </div>
</div>

<div class="filters">
    <button class="activo" data-filtro="todas">Todas <span class="count">${recetasList.length}</span></button>
    <button data-filtro="supabase-si">Con imagen en Supabase <span class="count">${stats.conImagenSupabase}</span></button>
    <button data-filtro="supabase-no">Sin imagen en Supabase <span class="count">${stats.sinImagen}</span></button>
    <button data-filtro="mejorable">Mejorables desde disco <span class="count">${mejorarCount}</span></button>
    <button data-filtro="disco-og_image">📸 og_image <span class="count">${stats.mejorTipoCounts.og_image || 0}</span></button>
    <button data-filtro="disco-flux_img2img">🎨 Claude (procesada) <span class="count">${stats.mejorTipoCounts.flux_img2img || 0}</span></button>
    <button data-filtro="disco-ai_gen">🤖 GPT-4o <span class="count">${stats.mejorTipoCounts.ai_gen || 0}</span></button>
    <button data-filtro="disco-flux_txt2img">⚡ Flux txt2img <span class="count">${stats.mejorTipoCounts.flux_txt2img || 0}</span></button>
</div>

<div class="tabla-wrap">
<table>
<thead>
<tr>
    <th>Receta</th>
    <th>Categoría</th>
    <th>Supabase</th>
    <th>En disco</th>
    <th>Mejor tipo disco</th>
    <th>URL origen</th>
    <th>⬆️</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</div>

<div class="summary">
<h2>🎯 Recetas mejorables (tienen imagen en Supabase pero hay mejor versión en disco)</h2>
${mejorarCount > 0 ? `<ul>${stats.tienenSupabaseSinMejorDisco.map(r => `<li><strong>${r.nombre}</strong> — Supabase: ${r.enSupabase} → Disco: ${r.mejorEnDisco} (${r.archivos.join(', ')})</li>`).join('\n')}</ul>` : '<p>Ninguna — todas las imágenes en Supabase son ya la mejor versión disponible.</p>'}
</div>

<script>
// Filtros
document.querySelectorAll('[data-filtro]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filtro]').forEach(b => b.classList.remove('activo'))
        btn.classList.add('activo')
        const filtro = btn.dataset.filtro
        document.querySelectorAll('tbody tr').forEach(row => {
            const supabase = row.querySelector('.supabase-badge')?.textContent?.includes('✅')
            const discos = Array.from(row.querySelectorAll('.disco-badge')).map(b => b.textContent.trim())
            const tieneDisco = discos.length > 0 && discos[0] !== '—'
            let visible = true
            if (filtro === 'supabase-si') visible = supabase
            else if (filtro === 'supabase-no') visible = !supabase
            else if (filtro === 'mejorable') {
                visible = row.querySelector('td:last-child')?.textContent?.includes('⬆️')
            }
            else if (filtro.startsWith('disco-')) {
                const tipo = filtro.replace('disco-', '')
                visible = discos.some(d => d.toLowerCase().includes(tipo.replace('_', '-')))
            }
            row.classList.toggle('oculta', !visible)
        })
    })
})
</script>
</body>
</html>`
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

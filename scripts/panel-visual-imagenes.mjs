/**
 * panel-visual-imagenes.mjs
 *
 * Genera un HTML con las imágenes de disco y Supabase MOSTRADAS VISUALMENTE,
 * lado a lado, para que puedas ver y seleccionar cuáles te gustan.
 *
 * USO: node scripts/panel-visual-imagenes.mjs
 * SALIDA: salidas/revision-imagenes/panel-visual.html
 *
 * Después: npx serve salidas/revision-imagenes/  (para ver las imágenes)
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync, statSync } from 'fs'
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

// ── Helper: base64 encode image ──
function imageToBase64(filepath) {
    try {
        const buf = readFileSync(filepath)
        const ext = filepath.endsWith('.webp') ? 'webp' : filepath.endsWith('.jpg') || filepath.endsWith('.jpeg') ? 'jpeg' : 'png'
        return `data:image/${ext};base64,${buf.toString('base64')}`
    } catch {
        return null
    }
}

// ── Leer archivos del disco ──
const allFiles = readdirSync(DISCO_DIR).filter(f =>
    f.endsWith('.webp') || f.endsWith('.jpg') || f.endsWith('.jpeg')
)

function clasificarFile(filename) {
    if (filename.startsWith('og_image--')) return 'og_image'
    if (filename.startsWith('flux_img2img--')) return 'flux_img2img'
    if (filename.startsWith('ai_gen--')) return 'ai_gen'
    if (filename.startsWith('flux_txt2img--')) return 'flux_txt2img'
    return 'otro'
}

function extraerSlug(filename) {
    const match = filename.match(/^[a-z0-9_]+--(.+)\.(webp|jpg|jpeg)$/)
    return match ? match[1] : filename
}

function slugToComparable(slug) {
    return slug
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ').trim()
}

// Tamaño del archivo
function fileSize(filepath) {
    try {
        const bytes = statSync(filepath).size
        return (bytes / 1024).toFixed(0) + 'KB'
    } catch { return '?' }
}

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
    console.log(`   ${allFiles.length} archivos en disco`)

    // ── Matchear archivos con recetas ──
    const fileRecords = allFiles.map(f => {
        const comparable = slugToComparable(extraerSlug(f))
        const match = recetas.find(r => {
            const rName = slugToComparable(r.nombre)
            const words = comparable.split(' ').filter(w => w.length > 2)
            const matchCount = words.filter(w => rName.includes(w)).length
            return matchCount >= Math.max(1, Math.floor(words.length * 0.4))
        })
        return {
            filename: f,
            tipo: clasificarFile(f),
            slug: extraerSlug(f),
            fullPath: resolve(DISCO_DIR, f),
            receta: match || null,
        }
    })

    // ── Agrupar por receta ──
    const recetaMap = {}
    for (const r of recetas) {
        recetaMap[r.nombre] = { ...r, enDisco: [] }
    }

    for (const f of fileRecords) {
        if (f.receta) {
            recetaMap[f.receta.nombre].enDisco.push(f)
        }
    }

    // ── Estadísticas ──
    const recetasConFluxImg2img = Object.values(recetaMap).filter(r =>
        r.enDisco.some(f => f.tipo === 'flux_img2img')
    )
    const recetasConOgImage = Object.values(recetaMap).filter(r =>
        r.enDisco.some(f => f.tipo === 'og_image')
    )
    const recetasSinNada = Object.values(recetaMap).filter(r =>
        r.enDisco.length === 0
    )

    console.log(`   ${recetasConFluxImg2img.length} recetas con flux_img2img (Claude)`)
    console.log(`   ${recetasConOgImage.length} recetas con og_image (original)`)
    console.log(`   ${recetasSinNada.length} recetas sin nada en disco`)

    // ── Generar HTML ──
    // Dividir en secciones: las que tienen flux_img2img (procesadas por Claude)
    // y las que no
    const secciones = [
        {
            titulo: '🎨 Procesadas por Claude (flux_img2img)',
            descripcion: 'Estas son las imágenes que Claude procesó: sin texto, sin personas, con perfilamiento',
            recetas: recetasConFluxImg2img,
        },
        {
            titulo: '📸 Originales sin procesar (og_image)',
            descripcion: 'Estas solo tienen la imagen original descargada, sin procesar por Claude',
            recetas: recetasConOgImage.filter(r => !r.enDisco.some(f => f.tipo === 'flux_img2img')),
        },
        {
            titulo: '🤖 Generadas por IA (ai_gen / flux_txt2img)',
            descripcion: 'Generadas desde cero por GPT-4o o Flux (sin fuente original)',
            recetas: Object.values(recetaMap).filter(r =>
                r.enDisco.length > 0 &&
                !r.enDisco.some(f => f.tipo === 'flux_img2img') &&
                !r.enDisco.some(f => f.tipo === 'og_image')
            ),
        },
        {
            titulo: '❌ Sin imágenes en disco',
            descripcion: 'No hay ningún archivo en disco para estas recetas',
            recetas: recetasSinNada,
        },
    ]

    const html = generarHTML(secciones, recetaMap, DISCO_DIR)
    const outPath = resolve(SALIDA_DIR, 'panel-visual.html')
    writeFileSync(outPath, html)
    console.log(`\n📄 Panel visual generado: ${outPath}`)
    console.log(`\n📌 Para ver las imágenes, necesitas servir el directorio:`)
    console.log(`   cd ${SALIDA_DIR} && npx serve .`)
    console.log(`   O: cd ${SALIDA_DIR} && python3 -m http.server 8080\n`)
}

function generarHTML(secciones, recetaMap, discoDir) {
    const allCards = secciones.map(sec => {
        return sec.recetas.map(r => {
            const tiposDisco = ['og_image', 'flux_img2img', 'ai_gen', 'flux_txt2img']
            const imagenesDisco = tiposDisco.map(tipo => {
                const file = r.enDisco.find(f => f.tipo === tipo)
                if (!file) return null
                return {
                    tipo,
                    filename: file.filename,
                    // Reference via relative path for when served via HTTP
                    src: file.filename,
                    size: fileSize(file.fullPath),
                }
            }).filter(Boolean)

            // Supabase image
            const supabaseImg = r.imagen_url
                ? { src: r.imagen_url, tiene: true }
                : { src: null, tiene: false }

            const tieneClaude = imagenesDisco.some(i => i.tipo === 'flux_img2img')
            const tieneOriginal = imagenesDisco.some(i => i.tipo === 'og_image')

            return {
                nombre: r.nombre,
                categoria: r.categoria || '—',
                urlOrigen: r.url_origen || '',
                enSupabase: supabaseImg.tiene,
                supabaseSrc: supabaseImg.src,
                imagenesDisco,
                tieneClaude,
                tieneOriginal,
                totalEnDisco: imagenesDisco.length,
            }
        })
    })

    const flatCards = secciones.flatMap(s => s.recetas.map(r => {
        return allCards.flat().find(c => c.nombre === r.nombre)
    })).filter(Boolean)

    // Generar HTML
    const etiquetaTipo = (tipo) => {
        const map = {
            'og_image': { label: '📸 Original', color: '#2e7d32', bg: '#e8f5e9' },
            'flux_img2img': { label: '🎨 Claude', color: '#e65100', bg: '#fff3e0' },
            'ai_gen': { label: '🤖 GPT-4o', color: '#1565c0', bg: '#e3f2fd' },
            'flux_txt2img': { label: '⚡ Flux', color: '#c62828', bg: '#fce4ec' },
        }
        return map[tipo] || { label: tipo, color: '#333', bg: '#eee' }
    }

    const cardsHtml = secciones.map(sec => {
        if (sec.recetas.length === 0) return ''

        const items = sec.recetas.map(r => {
            const c = allCards.flat().find(card => card.nombre === r.nombre)
            if (!c) return ''

            const imgsHtml = c.imagenesDisco.map(img => {
                const et = etiquetaTipo(img.tipo)
                const esMejor = img.tipo === 'flux_img2img' || img.tipo === 'og_image'
                return `
<div class="img-card ${esMejor ? 'destacada' : ''}" data-tipo="${img.tipo}">
    <div class="img-label" style="background:${et.bg};color:${et.color}">
        ${et.label} <span class="size">${img.size}</span>
    </div>
    <img src="${img.src}" alt="${img.tipo}" loading="lazy"
         onerror="this.parentElement.classList.add('broken')">
    <div class="img-actions">
        <button class="btn-elegir" data-receta="${c.nombre}" data-tipo="${img.tipo}" data-src="${img.src}">✅ Elegir esta</button>
    </div>
</div>`
            }).join('\n')

            const supabaseHtml = c.enSupabase
                ? `<div class="img-card supabase">
                    <div class="img-label" style="background:#f3e5f5;color:#6a1b9a">☁️ Supabase actual</div>
                    <img src="${c.supabaseSrc}" alt="supabase" loading="lazy"
                         onerror="this.parentElement.classList.add('broken')">
                    <div class="img-actions">
                        <button class="btn-mantener" data-receta="${c.nombre}" disabled>✅ Ya está en Supabase</button>
                    </div>
                   </div>`
                : `<div class="img-card no-supabase">
                    <div class="img-label" style="background:#fce4ec;color:#c62828">❌ Sin imagen en Supabase</div>
                    <div class="no-img-placeholder">No hay imagen subida</div>
                   </div>`

            const urlOrigenHtml = c.urlOrigen
                ? `<a href="${c.urlOrigen}" target="_blank" class="url-origen">🔗 Fuente original</a>`
                : ''

            return `
<div class="receta-card" id="receta-${slugToComparable(c.nombre).replace(/\s+/g, '-')}">
    <div class="receta-header">
        <h3>${c.nombre}</h3>
        <span class="categoria-badge">${c.categoria}</span>
        ${urlOrigenHtml}
    </div>
    <div class="comparativa">
        ${supabaseHtml}
        ${imgsHtml}
    </div>
    <div class="receta-footer">
        <span class="disco-count">📦 ${c.totalEnDisco} archivos en disco</span>
        <span class="resumen-seleccion" id="sel-${slugToComparable(c.nombre).replace(/\s+/g, '-')}">${c.enSupabase ? '☁️ Usando imagen de Supabase' : '⚠️ Pendiente de elegir'}</span>
    </div>
</div>`
        }).join('\n')

        return `
<div class="seccion">
    <h2>${sec.titulo} <span class="count">${sec.recetas.length}</span></h2>
    <p class="seccion-desc">${sec.descripcion}</p>
    <div class="cards-grid">${items}</div>
</div>`
    }).join('\n')

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>🎨 Panel Visual — Imágenes de Recetas</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 24px;
}
h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
.subtitle { color: #86868b; font-size: 14px; margin-bottom: 24px; }

/* Secciones */
.seccion {
    margin-bottom: 40px;
}
.seccion h2 {
    font-size: 20px; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
}
.seccion h2 .count {
    font-size: 14px; font-weight: 500;
    background: #e8e8ed; color: #515154;
    padding: 2px 10px; border-radius: 12px;
}
.seccion-desc {
    color: #86868b; font-size: 13px; margin: 4px 0 16px;
}

/* Grid */
.cards-grid {
    display: flex; flex-direction: column; gap: 16px;
}

/* Receta card */
.receta-card {
    background: white; border-radius: 16px; padding: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    border: 1px solid #e8e8ed;
}
.receta-header {
    display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap;
}
.receta-header h3 { font-size: 16px; font-weight: 600; }
.categoria-badge {
    font-size: 11px; font-weight: 500;
    background: #f0f0f5; color: #515154;
    padding: 2px 10px; border-radius: 10px;
}
.url-origen {
    font-size: 12px; color: #0071e3; text-decoration: none; margin-left: auto;
}
.url-origen:hover { text-decoration: underline; }

/* Comparativa horizontal */
.comparativa {
    display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px;
}

/* Image card */
.img-card {
    flex: 0 0 auto; width: 240px; border-radius: 12px;
    overflow: hidden; border: 2px solid transparent;
    background: #fafafa; transition: all 0.15s;
}
.img-card.destacada { border-color: #0071e3; }
.img-card.supabase { border-color: #6a1b9a; }
.img-card.no-supabase { border-color: #fce4ec; }
.img-card.broken { opacity: 0.5; }
.img-card img {
    width: 100%; height: 240px; object-fit: cover;
    display: block; background: #f0f0f0;
}
.img-card.broken img { display: none; }
.img-card.broken::after {
    content: '⚠️ Imagen no encontrada'; display: block;
    padding: 80px 20px; text-align: center; color: #999;
}
.img-label {
    padding: 6px 10px; font-size: 12px; font-weight: 600;
    display: flex; justify-content: space-between; align-items: center;
}
.size { font-weight: 400; opacity: 0.7; }
.no-img-placeholder {
    height: 240px; display: flex; align-items: center; justify-content: center;
    color: #999; font-size: 13px;
}

.img-actions { padding: 8px; }
.btn-elegir, .btn-mantener {
    width: 100%; padding: 6px 12px; border: none; border-radius: 8px;
    font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.btn-elegir {
    background: #0071e3; color: white;
}
.btn-elegir:hover { background: #0060c0; }
.btn-elegir.seleccionado { background: #34c759; }
.btn-mantener {
    background: #f0f0f5; color: #515154; cursor: default;
}
.receta-footer {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 12px; padding-top: 12px;
    border-top: 1px solid #f0f0f2; font-size: 12px;
}
.disco-count { color: #86868b; }
.resumen-seleccion {
    font-weight: 500;
}
.resumen-seleccion.seleccionado { color: #34c759; }

/* Barra de acciones global */
.global-actions {
    position: sticky; bottom: 0; background: white;
    border-radius: 16px 16px 0 0; padding: 16px 20px;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    display: flex; gap: 12px; align-items: center;
    margin-top: 20px; flex-wrap: wrap;
}
.global-actions button {
    padding: 8px 20px; border: none; border-radius: 10px;
    font-size: 14px; font-weight: 600; cursor: pointer;
}
.btn-subir { background: #34c759; color: white; }
.btn-subir:hover { background: #2db84d; }
.btn-subir:disabled { background: #c8e6c9; color: #999; cursor: default; }
.btn-reset { background: #f0f0f5; color: #515154; }
.btn-reset:hover { background: #e0e0e5; }
.seleccion-count {
    margin-left: auto; font-size: 13px; color: #86868b;
}
</style>
</head>
<body>

<h1>🎨 Panel Visual — Imágenes de Recetas</h1>
<p class="subtitle">Compara las imágenes en disco y elige cuáles subir a Supabase. Haz clic en "✅ Elegir esta" para cada receta.</p>

${cardsHtml}

<div class="global-actions">
    <button class="btn-subir" id="btnSubir" disabled>⬆️ Subir seleccionadas a Supabase</button>
    <button class="btn-reset" id="btnReset">🔄 Resetear selección</button>
    <span class="seleccion-count" id="seleccionCount">0 seleccionadas</span>
</div>

<script>
// ── Gestión de selección ──
const seleccion = {} // { nombreReceta: { tipo, src } }

document.querySelectorAll('.btn-elegir').forEach(btn => {
    btn.addEventListener('click', () => {
        const nombre = btn.dataset.receta
        const tipo = btn.dataset.tipo
        const src = btn.dataset.src

        // Deseleccionar otros botones de la misma receta
        const mismosBotones = document.querySelectorAll(\`[data-receta="\${CSS.escape(nombre)}"]\`)
        mismosBotones.forEach(b => {
            b.classList.remove('seleccionado')
            b.textContent = b.dataset.tipo === 'og_image' ? '📸 Elegir esta' :
                            b.dataset.tipo === 'flux_img2img' ? '🎨 Elegir esta' :
                            b.dataset.tipo === 'ai_gen' ? '🤖 Elegir esta' : '⚡ Elegir esta'
        })

        // Marcar este como seleccionado
        btn.classList.add('seleccionado')
        btn.textContent = '✅ Seleccionada'

        // Guardar selección
        seleccion[nombre] = { tipo, src }

        // Actualizar resumen
        const selId = 'sel-' + nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
        const resumen = document.getElementById(selId)
        if (resumen) {
            resumen.textContent = \`✅ Elegida: \${tipo}\`
            resumen.classList.add('seleccionado')
        }

        actualizarGlobal()
    })
})

document.getElementById('btnReset').addEventListener('click', () => {
    Object.keys(seleccion).forEach(k => delete seleccion[k])
    document.querySelectorAll('.btn-elegir').forEach(b => {
        b.classList.remove('seleccionado')
        b.textContent = b.dataset.tipo === 'og_image' ? '📸 Elegir esta' :
                        b.dataset.tipo === 'flux_img2img' ? '🎨 Elegir esta' :
                        b.dataset.tipo === 'ai_gen' ? '🤖 Elegir esta' : '⚡ Elegir esta'
    })
    document.querySelectorAll('.resumen-seleccion').forEach(r => {
        r.textContent = '⚠️ Pendiente de elegir'
        r.classList.remove('seleccionado')
    })
    actualizarGlobal()
})

function actualizarGlobal() {
    const count = Object.keys(seleccion).length
    document.getElementById('seleccionCount').textContent = count + ' seleccionadas'
    const btn = document.getElementById('btnSubir')
    btn.disabled = count === 0
    btn.textContent = count > 0 ? \`⬆️ Subir \${count} seleccionadas a Supabase\` : '⬆️ Subir seleccionadas a Supabase'
}

// ── Botón subir — genera JSON con las selecciones ──
document.getElementById('btnSubir').addEventListener('click', async () => {
    const seleccionadas = Object.entries(seleccion).map(([nombre, info]) => ({
        nombre, tipo: info.tipo, src: info.src
    }))

    // Descargar JSON
    const blob = new Blob([JSON.stringify(seleccionadas, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'seleccion-imagenes.json'
    a.click()
    URL.revokeObjectURL(url)

    alert(\`✅ Selección guardada: \${seleccionadas.length} imágenes listas para subir.
    
El archivo 'seleccion-imagenes.json' se ha descargado.

Para subirlas a Supabase, ejecuta:
  node scripts/subir-seleccion.mjs\`)
})
</script>
</body>
</html>`
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

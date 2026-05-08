/**
 * comparar-sistemas-imagen.mjs
 *
 * COMPARATIVA MULTI-SISTEMA DE GENERACIÓN/BÚSQUEDA DE IMÁGENES
 * ===========================================================
 *
 * Toma 5 recetas de prueba y genera/busca imágenes con TODOS los sistemas
 * disponibles para comparar visualmente la calidad.
 *
 * SISTEMAS:
 *   1. Apify Google Images Scraper → imágenes reales del search
 *   2. Flux Pro (Replicate) → IA generativa (ya pagado)
 *   3. GPT Image 2 (OpenAI) → IA generativa estado del arte (si hay API key)
 *
 * USO:
 *   node scripts/comparar-sistemas-imagen.mjs
 *
 * SALIDA:
 *   salidas/revision-imagenes/comparativa.html → panel comparativo
 *
 * REQUISITOS:
 *   - APIFY_API_KEY en .env.local
 *   - REPLICATE_API_KEY en .env.local (ya está)
 *   - OPENAI_API_KEY opcional en .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { ApifyClient } from 'apify-client'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
const envPath = resolve(RAÍZ, '.env.local')
if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
    }
}

// ── Config ─────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

const CUANTAS_RECETAS = 5  // Prueba con 5 recetas

// API Keys
const APIFY_KEY = process.env.APIFY_API_KEY
const REPLICATE_KEY = process.env.REPLICATE_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY

// ── Utilidades ─────────────────────────────────────────
function safeName(nombre) {
    return nombre
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)
}

async function descargarBuffer(url, timeout = 15000) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(timeout),
        })
        if (!res.ok) return null
        const ct = res.headers.get('content-type') || ''
        if (!ct.startsWith('image/')) return null
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length < 1000) return null
        return buf
    } catch {
        return null
    }
}

function guardarBuffer(buffer, nombre, metodo) {
    const name = `${metodo}--${safeName(nombre)}.webp`
    const path = join(SALIDA_DIR, name)
    writeFileSync(path, buffer)
    return { nombre: name, path, tamano: buffer.length }
}

// ═══════════════════════════════════════════════════════
//  SISTEMA 1: Apify Google Images Scraper
// ═══════════════════════════════════════════════════════

async function buscarConApify(nombreReceta) {
    if (!APIFY_KEY) {
        console.log('     ⚠️  No APIFY_API_KEY configurada')
        return null
    }

    try {
        const client = new ApifyClient({ token: APIFY_KEY })

        // Usar el actor de Google Images Scraper
        const input = {
            queries: `"${nombreReceta}" receta food`,
            maxResults: 5,
            resultsPerPage: 10,
        }

        console.log(`     🔍 Apify buscando: "${nombreReceta}"`)
        const run = await client.actor('apify/google-search-scraper').call(input)
        const { items } = await client.dataset(run.defaultDatasetId).listItems()

        // Buscar imágenes en los resultados
        for (const item of items) {
            // Intentar varias fuentes de imagen
            const imgUrl = item.thumbnailUrl || item.imageUrl || null
            if (imgUrl) {
                const buf = await descargarBuffer(imgUrl)
                if (buf && buf.length > 15000) {
                    console.log(`     ✅ Apify encontró imagen (${(buf.length / 1024).toFixed(0)}KB)`)
                    return { buffer: buf, url: imgUrl, fuente: 'apify_google' }
                }
            }

            // También buscar en organicResults
            if (item.organicResults) {
                for (const r of item.organicResults) {
                    if (r.image?.url) {
                        const buf = await descargarBuffer(r.image.url)
                        if (buf && buf.length > 15000) {
                            console.log(`     ✅ Apify imagen organic (${(buf.length / 1024).toFixed(0)}KB)`)
                            return { buffer: buf, url: r.image.url, fuente: 'apify_google' }
                        }
                    }
                }
            }
        }

        console.log('     ❌ Apify no encontró imágenes')
        return null
    } catch (err) {
        console.log(`     ⚠️  Apify error: ${err.message}`)
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  SISTEMA 2: Flux Pro (Replicate)
// ═══════════════════════════════════════════════════════

const FLUX_PRO = 'black-forest-labs/flux-pro'
const REPLICATE_API = 'https://api.replicate.com/v1'

function construirPromptFlux(nombre, ingredientes) {
    const ings = (ingredientes || []).slice(0, 6).join(', ')
    return `Fotografía realista de comida casera, plano cenital o 45 grados, plato de "${nombre}" servido en plato de cerámica blanco sobre mesa de madera. Recién preparado. Ingredientes visibles: ${ings || 'los propios de la receta'}. Sin ingredientes adicionales, sin toppings decorativos, sin adornos, solo la comida tal cual en el plato. Iluminación natural de ventana lateral, texturas realistas, sin edición excesiva, estilo fotografía de blog de cocina casera, fondo desenfocado suave. Aspecto auténtico, nada de estudio, nada de inteligencia artificial evidente.`
}

async function generarConFluxPro(nombre, ingredientes) {
    if (!REPLICATE_KEY) {
        console.log('     ⚠️  No REPLICATE_API_KEY')
        return null
    }

    const prompt = construirPromptFlux(nombre, ingredientes)

    try {
        const input = {
            prompt,
            aspect_ratio: '1:1',
            output_format: 'webp',
            safety_tolerance: 2,
            num_outputs: 1,
        }

        const createRes = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${REPLICATE_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ version: FLUX_PRO, input }),
        })

        if (!createRes.ok) {
            const err = await createRes.text()
            if (createRes.status === 402) {
                console.log('     ⚠️  Crédito insuficiente en Replicate')
                return null
            }
            console.log(`     ⚠️  Replicate error ${createRes.status}`)
            return null
        }

        const prediction = await createRes.json()
        const timeout = 60000
        const start = Date.now()
        let url = prediction.urls.get

        while (Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 2000))
            const poll = await fetch(url, {
                headers: { 'Authorization': `Bearer ${REPLICATE_KEY}` },
            })
            if (!poll.ok) break
            const status = await poll.json()

            if (status.status === 'succeeded') {
                const output = status.output
                const imgUrl = Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : null)
                if (imgUrl) {
                    const buf = await descargarBuffer(imgUrl)
                    if (buf) {
                        console.log(`     ✅ Flux Pro generó (${(buf.length / 1024).toFixed(0)}KB)`)
                        return { buffer: buf, url: imgUrl, fuente: 'flux_pro' }
                    }
                }
                return null
            }
            if (status.status === 'failed') return null
            url = status.urls.get
        }
        return null
    } catch (err) {
        console.log(`     ⚠️  Flux error: ${err.message}`)
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  SISTEMA 3: GPT Image 2 (OpenAI) - si hay API key
// ═══════════════════════════════════════════════════════

async function generarConGPTImage2(nombre, ingredientes) {
    if (!OPENAI_KEY) {
        console.log('     ⚠️  No OPENAI_API_KEY configurada — saltando GPT Image 2')
        return null
    }

    const ings = (ingredientes || []).slice(0, 6).join(', ')
    const prompt = `Fotografía realista de comida casera, plano cenital o 45 grados, plato de "${nombre}" servido en plato de cerámica blanco sobre mesa de madera. Ingredientes: ${ings || 'los propios de la receta'}. Sin ingredientes adicionales, sin toppings, solo la comida tal cual. Iluminación natural, texturas realistas, estilo blog de cocina casera.`

    try {
        const res = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-image-2',
                prompt,
                n: 1,
                size: '1024x1024',
                quality: 'medium',
                response_format: 'b64_json',
            }),
        })

        if (!res.ok) {
            const err = await res.text()
            console.log(`     ⚠️  OpenAI error ${res.status}: ${err.substring(0, 100)}`)
            return null
        }

        const data = await res.json()
        if (data.data?.[0]?.b64_json) {
            const buf = Buffer.from(data.data[0].b64_json, 'base64')
            console.log(`     ✅ GPT Image 2 generó (${(buf.length / 1024).toFixed(0)}KB)`)
            return { buffer: buf, url: null, fuente: 'gpt_image2' }
        }
        return null
    } catch (err) {
        console.log(`     ⚠️  GPT Image 2 error: ${err.message}`)
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  GENERAR PANEL COMPARATIVO
// ═══════════════════════════════════════════════════════

function generarPanelComparativa(resultados) {
    const cards = resultados.map((r, idx) => {
        const rows = r.sistemas.map(s => {
            let dataUri = ''
            if (s.imagen) {
                const rutaCompleta = join(SALIDA_DIR, s.imagen.nombre)
                try {
                    const buf = readFileSync(rutaCompleta)
                    dataUri = `data:image/webp;base64,${buf.toString('base64')}`
                } catch {
                    dataUri = ''
                }
            }

            const statusIcon = s.imagen ? '✅' : '❌'
            const sizeText = s.imagen ? `${(s.imagen.tamano / 1024).toFixed(0)}KB` : ''

            return `
            <div class="sistema-col">
                <div class="sistema-header ${s.fuente}">
                    ${statusIcon} ${s.fuente.replace(/_/g, ' ').toUpperCase()}
                </div>
                <div class="sistema-img">
                    ${dataUri ? `<img src="${dataUri}" alt="${r.nombre} - ${s.fuente}" loading="lazy">` : '<div class="no-img">Sin imagen</div>'}
                </div>
                <div class="sistema-info">
                    ${sizeText ? `<span class="size">📦 ${sizeText}</span>` : ''}
                    <span class="status ${s.imagen ? 'ok' : 'fail'}">${s.imagen ? 'OK' : 'Falló'}</span>
                </div>
                <button class="btn-elegir" onclick="elegir(${idx}, '${s.fuente}')">⭐ Elegir este</button>
            </div>
            `
        }).join('')

        const elegido = r.elegido || ''

        return `
        <div class="receta-card" id="receta-${idx}">
            <h2>${r.nombre}</h2>
            <div class="sistemas-grid">
                ${rows}
            </div>
            <div class="elegido-info" id="elegido-${idx}">
                ${elegido ? `✅ Elegido: <strong>${elegido}</strong>` : '⏳ Pendiente de elegir'}
            </div>
        </div>
        `
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Comparativa Sistemas de Imagen</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7; color: #1d1d1f; padding: 20px;
}
h1 { font-size: 24px; margin-bottom: 4px; }
.subtitle { color: #86868b; margin-bottom: 8px; }
.leyenda { display: flex; gap: 16px; margin-bottom: 20px; font-size: 13px; flex-wrap: wrap; }
.leyenda span { padding: 4px 8px; border-radius: 4px; font-weight: 600; }
.receta-card {
    background: white; border-radius: 16px; padding: 20px;
    margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
h2 { font-size: 18px; margin-bottom: 12px; }
.sistemas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}
.sistema-col {
    border: 2px solid #e5e5ea; border-radius: 12px; overflow: hidden;
    background: #fafafa; transition: all 0.2s;
}
.sistema-col:hover { border-color: #0071e3; }
.sistema-col.elegido { border-color: #34c759; background: #e8f8ee; }
.sistema-header {
    padding: 8px 12px; font-size: 11px; font-weight: 700;
    color: white; text-align: center;
}
.sistema-header.apify_google { background: #34c759; }
.sistema-header.flux_pro { background: #ff9500; }
.sistema-header.gpt_image2 { background: #0071e3; }
.sistema-header.flux_txt2img { background: #ff3b30; }
.sistema-header.bing_images { background: #5856d6; }
.sistema-header.playwright { background: #30b0c7; }
.sistema-img {
    aspect-ratio: 1; background: #f0f0f0; display: flex;
    align-items: center; justify-content: center; overflow: hidden;
}
.sistema-img img { width: 100%; height: 100%; object-fit: cover; }
.no-img { color: #86868b; font-size: 14px; }
.sistema-info {
    padding: 6px 10px; display: flex; justify-content: space-between;
    font-size: 12px; align-items: center;
}
.status.ok { color: #34c759; font-weight: 700; }
.status.fail { color: #ff3b30; font-weight: 700; }
.btn-elegir {
    width: 100%; padding: 8px; border: none; font-size: 12px;
    font-weight: 600; cursor: pointer; background: #e5e5ea;
    transition: all 0.2s;
}
.btn-elegir:hover { background: #0071e3; color: white; }
.elegido-info {
    margin-top: 10px; padding: 8px 12px; background: #f0f0f0;
    border-radius: 8px; font-size: 14px; text-align: center;
}
#acciones-globales {
    position: sticky; bottom: 0; background: rgba(255,255,255,0.95);
    backdrop-filter: blur(10px); padding: 16px;
    border-radius: 16px; box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    display: flex; gap: 12px; justify-content: center;
}
.btn-subir {
    padding: 12px 32px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; cursor: pointer;
}
.btn-subir.primary { background: #0071e3; color: white; }
.btn-subir.secondary { background: #e5e5ea; color: #1d1d1f; }
.toast {
    position: fixed; top: 20px; right: 20px; padding: 12px 20px;
    border-radius: 12px; color: white; font-size: 14px; z-index: 999;
    animation: slideIn 0.3s ease;
}
.toast.success { background: #34c759; }
.toast.error { background: #ff3b30; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { opacity: 1; } }
</style>
</head>
<body>
<h1>🧪 Comparativa Sistemas de Imagen</h1>
<p class="subtitle">Cada receta se ha procesado con todos los sistemas disponibles. Elige el que prefieras para cada una.</p>
<div class="leyenda">
    <span style="background:#34c759;color:white">Apify Google (reales)</span>
    <span style="background:#ff9500;color:white">Flux Pro (IA - Replicate)</span>
    <span style="background:#0071e3;color:white">GPT Image 2 (IA - OpenAI)</span>
</div>
<div id="recetas-container">${cards}</div>
<div id="acciones-globales">
    <button class="btn-subir primary" onclick="generarResumen()">📊 Generar resumen</button>
    <button class="btn-subir secondary" onclick="autoMejor()">🤖 Auto-elegir mejor</button>
</div>
<div id="toast-container"></div>
<script>
const elecciones = {};

function elegir(idx, sistema) {
    elecciones[idx] = sistema;
    document.querySelectorAll(\`#receta-\${idx} .sistema-col\`).forEach(el => el.classList.remove('elegido'));
    document.querySelectorAll(\`#receta-\${idx} .sistema-col\`).forEach(el => {
        const header = el.querySelector('.sistema-header');
        if (header && header.textContent.trim().includes(sistema.replace(/_/g, ' ').toUpperCase())) {
            el.classList.add('elegido');
        }
    });
    document.getElementById(\`elegido-\${idx}\`).innerHTML = \`✅ Elegido: <strong>\${sistema.replace(/_/g, ' ').toUpperCase()}</strong>\`;
    mostrarToast(\`✅ Receta \${idx+1}: \${sistema.replace(/_/g, ' ')}\`, 'success');
}

function autoMejor() {
    // Por defecto prefiere: apify_google > gpt_image2 > flux_pro
    const orden = ['apify_google', 'gpt_image2', 'flux_pro', 'flux_txt2img', 'bing_images', 'playwright'];
    document.querySelectorAll('[id^="receta-"]').forEach(card => {
        const idx = parseInt(card.id.replace('receta-', ''));
        for (const sistema of orden) {
            const col = card.querySelector(\`.sistema-col:has(.sistema-header.\${sistema}) .btn-elegir\`);
            if (col) {
                col.click();
                return;
            }
        }
    });
    mostrarToast('🤖 Auto-selección completada', 'info');
}

function generarResumen() {
    const systems = {};
    Object.entries(elecciones).forEach(([idx, sistema]) => {
        systems[sistema] = (systems[sistema] || 0) + 1;
    });
    let msg = '📊 Resumen de elecciones:\\n';
    Object.entries(systems).sort((a,b) => b[1]-a[1]).forEach(([s, count]) => {
        msg += \`  \${s.replace(/_/g, ' ')}: \${count} recetas\\n\`;
    });
    msg += \`\\nTotal: \${Object.keys(elecciones).length} recetas\`;
    mostrarToast(msg, 'info');
    console.log(msg);
}

function mostrarToast(msg, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = \`toast \${tipo}\`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
</script>
</body>
</html>`

    writeFileSync(join(SALIDA_DIR, 'comparativa.html'), html)
    console.log(`\n  📄 Panel comparativo: ${join(SALIDA_DIR, 'comparativa.html')}`)
    console.log(`     file://${join(SALIDA_DIR, 'comparativa.html')}`)
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   🧪 COMPARATIVA MULTI-SISTEMA DE IMÁGENES              ║
║   Probando ${CUANTAS_RECETAS} recetas con todos los sistemas       ║
╚══════════════════════════════════════════════════════════╝
    `)

    // Comprobar sistemas disponibles
    const sistemasDisponibles = ['apify_google']
    if (REPLICATE_KEY) sistemasDisponibles.push('flux_pro')
    if (OPENAI_KEY) sistemasDisponibles.push('gpt_image2')

    console.log(`📡 Sistemas disponibles: ${sistemasDisponibles.join(', ')}`)
    if (!REPLICATE_KEY) console.log('   ⚠️  Flux Pro no disponible (sin REPLICATE_API_KEY)')
    if (!OPENAI_KEY) console.log('   ⚠️  GPT Image 2 no disponible (sin OPENAI_API_KEY)')

    // Seleccionar recetas SIN imagen
    const { data: recetas } = await supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen')
        .is('imagen_url', null)
        .limit(CUANTAS_RECETAS)

    if (!recetas?.length) {
        console.log('❌ No hay recetas sin imagen')
        return
    }

    console.log(`\n📝 Recetas seleccionadas:`)
    recetas.forEach((r, i) => console.log(`   ${i + 1}. ${r.nombre}`))

    const resultados = []

    for (let i = 0; i < recetas.length; i++) {
        const r = recetas[i]
        console.log(`\n${'─'.repeat(60)}`)
        console.log(`\n📸 [${i + 1}/${recetas.length}] ${r.nombre}`)

        // Obtener ingredientes
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('nombre_libre')
            .eq('receta_id', r.id)
        const ingredientes = (ings || []).map(i => i.nombre_libre).filter(Boolean)

        const sistemas = []

        // Sistema 1: Apify Google Images
        console.log(`\n   📡 [Apify Google Images]`)
        const apifyResult = await buscarConApify(r.nombre)
        if (apifyResult) {
            const img = guardarBuffer(apifyResult.buffer, r.nombre, 'apify_google')
            sistemas.push({ fuente: 'apify_google', imagen: img, url: apifyResult.url })
        } else {
            sistemas.push({ fuente: 'apify_google', imagen: null, url: null })
        }

        // Sistema 2: Flux Pro (si disponible)
        if (REPLICATE_KEY) {
            console.log(`\n   🎨 [Flux Pro - Replicate]`)
            const fluxResult = await generarConFluxPro(r.nombre, ingredientes)
            if (fluxResult) {
                const img = guardarBuffer(fluxResult.buffer, r.nombre, 'flux_pro')
                sistemas.push({ fuente: 'flux_pro', imagen: img, url: fluxResult.url })
            } else {
                sistemas.push({ fuente: 'flux_pro', imagen: null, url: null })
            }
        }

        // Sistema 3: GPT Image 2 (si disponible)
        if (OPENAI_KEY) {
            console.log(`\n   🧠 [GPT Image 2 - OpenAI]`)
            const gptResult = await generarConGPTImage2(r.nombre, ingredientes)
            if (gptResult) {
                const img = guardarBuffer(gptResult.buffer, r.nombre, 'gpt_image2')
                sistemas.push({ fuente: 'gpt_image2', imagen: img, url: gptResult.url })
            } else {
                sistemas.push({ fuente: 'gpt_image2', imagen: null, url: null })
            }
        }

        resultados.push({
            id: r.id,
            nombre: r.nombre,
            categoria: r.categoria,
            url_origen: r.url_origen,
            ingredientes,
            sistemas,
        })
    }

    // Generar panel
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`\n📊 Generando panel comparativo...`)
    generarPanelComparativa(resultados)

    // Estadísticas
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`\n📈 RESUMEN:`)
    const stats = {}
    for (const r of resultados) {
        for (const s of r.sistemas) {
            if (!stats[s.fuente]) stats[s.fuente] = { total: 0, exitos: 0 }
            stats[s.fuente].total++
            if (s.imagen) stats[s.fuente].exitos++
        }
    }

    for (const [sistema, st] of Object.entries(stats)) {
        const pct = st.total > 0 ? ((st.exitos / st.total) * 100).toFixed(0) : 0
        console.log(`   ${sistema}: ${st.exitos}/${st.total} imágenes (${pct}% tasa de éxito)`)
    }

    console.log(`\n✅ COMPLETADO. Abre el panel para comparar:`)
    console.log(`   file://${join(SALIDA_DIR, 'comparativa.html')}`)
}

main().catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
})

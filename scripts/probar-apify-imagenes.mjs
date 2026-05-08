/**
 * probar-apify-imagenes.mjs
 *
 * PRUEBA APIFY GOOGLE IMAGES SCRAPER - IMÁGENES REALES
 * ======================================================
 *
 * Busca imágenes reales de Google para 5 recetas de prueba.
 * SIN coste de Flux/IA. Usa los $5 de crédito gratis de Apify.
 *
 * USO:
 *   node scripts/probar-apify-imagenes.mjs
 *
 * SALIDA:
 *   salidas/revision-imagenes/comparativa.html → panel visual
 *
 * REQUISITOS:
 *   - APIFY_API_KEY en .env.local (ya configurada)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
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

const APIFY_KEY = process.env.APIFY_API_KEY
if (!APIFY_KEY) {
    console.error('❌ APIFY_API_KEY no configurada en .env.local')
    process.exit(1)
}

const CUANTAS_RECETAS = 5

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

function guardarBuffer(buffer, nombre, metodo, url = '') {
    const name = `${metodo}--${safeName(nombre)}.webp`
    const path = join(SALIDA_DIR, name)
    writeFileSync(path, buffer)
    return { nombre: name, path, tamano: buffer.length, url_origen: url }
}

// ═══════════════════════════════════════════════════════
//  APIFY GOOGLE IMAGES SCRAPER
// ═══════════════════════════════════════════════════════

async function buscarConApify(nombreReceta) {
    try {
        const client = new ApifyClient({ token: APIFY_KEY })

        const input = {
            queries: `"${nombreReceta}" receta comida`,
            maxResults: 3,
            resultsPerPage: 10,
        }

        console.log(`     🔍 Buscando en Google...`)
        const run = await client.actor('apify/google-search-scraper').call(input)
        const { items } = await client.dataset(run.defaultDatasetId).listItems()

        let mejorImagen = null
        let mayorTamano = 0

        for (const item of items) {
            // thumbnailUrl suele ser la mejor fuente
            const fuentes = [
                item.thumbnailUrl,
                item.imageUrl,
            ]

            for (const imgUrl of fuentes) {
                if (!imgUrl) continue
                const buf = await descargarBuffer(imgUrl)
                if (buf && buf.length > mayorTamano) {
                    mayorTamano = buf.length
                    mejorImagen = { buffer: buf, url: imgUrl }
                }
            }

            // También revisar organicResults si existen
            if (item.organicResults && Array.isArray(item.organicResults)) {
                for (const r of item.organicResults) {
                    if (r.image?.url) {
                        const buf = await descargarBuffer(r.image.url)
                        if (buf && buf.length > mayorTamano) {
                            mayorTamano = buf.length
                            mejorImagen = { buffer: buf, url: r.image.url }
                        }
                    }
                }
            }
        }

        if (mejorImagen && mayorTamano > 15000) {
            console.log(`     ✅ Imagen real encontrada! (${(mayorTamano / 1024).toFixed(0)}KB)`)
            return mejorImagen
        }

        console.log(`     ❌ No se encontraron imágenes útiles`)
        return null
    } catch (err) {
        console.log(`     ⚠️  Error: ${err.message}`)
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  GENERAR PANEL
// ═══════════════════════════════════════════════════════

function generarPanel(resultados) {
    const cards = resultados.map((r, idx) => {
        let cardContent = ''

        if (r.imagen) {
            const rutaCompleta = join(SALIDA_DIR, r.imagen.nombre)
            let dataUri = ''
            try {
                const buf = readFileSync(rutaCompleta)
                dataUri = `data:image/webp;base64,${buf.toString('base64')}`
            } catch { }

            cardContent = `
                <div class="img-container">
                    <img src="${dataUri}" alt="${r.nombre}" loading="lazy">
                    <div class="img-badge apify">📸 Google Images (real)</div>
                </div>
                <div class="img-info">
                    <span>📦 ${(r.imagen.tamano / 1024).toFixed(0)}KB</span>
                    <span class="quality high">✅ Alta calidad</span>
                </div>
            `
        } else {
            cardContent = `
                <div class="no-img">
                    <div class="no-img-icon">📭</div>
                    <p>No se encontró imagen real</p>
                    <p class="hint">Esta receta necesitaría IA (Flux Pro)</p>
                </div>
            `
        }

        return `
        <div class="receta-card">
            <h2>${r.nombre}</h2>
            <p class="meta">${r.categoria || 'Sin categoría'}</p>
            <div class="resultado">
                ${cardContent}
            </div>
            <div class="valoracion">
                ${r.imagen
                ? '<span class="veredicto ok">✅ Apify funcionó - imagen real disponible</span>'
                : '<span class="veredicto fail">❌ Apify no encontró - tocará IA</span>'
            }
            </div>
        </div>
        `
    }).join('')

    const exitos = resultados.filter(r => r.imagen).length
    const fallos = resultados.filter(r => !r.imagen).length

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Prueba Apify - Imágenes Reales</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7; color: #1d1d1f; padding: 20px;
    max-width: 900px; margin: 0 auto;
}
h1 { font-size: 22px; margin-bottom: 4px; }
.subtitle { color: #86868b; margin-bottom: 16px; }
.resumen {
    background: white; border-radius: 12px; padding: 16px;
    margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
.resumen-grid { display: flex; gap: 16px; margin-top: 8px; }
.resumen-item { text-align: center; flex: 1; }
.resumen-item .num { font-size: 28px; font-weight: 700; display: block; }
.resumen-item .label { font-size: 12px; color: #86868b; }
.exito { color: #34c759; }
.fallo { color: #ff3b30; }
.receta-card {
    background: white; border-radius: 16px; padding: 20px;
    margin-bottom: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
h2 { font-size: 18px; margin-bottom: 4px; }
.meta { color: #86868b; font-size: 13px; margin-bottom: 12px; }
.resultado { margin-bottom: 12px; }
.img-container {
    position: relative; border-radius: 12px; overflow: hidden;
    background: #f0f0f0; aspect-ratio: 1; max-width: 400px;
}
.img-container img { width: 100%; height: 100%; object-fit: cover; }
.img-badge {
    position: absolute; top: 8px; left: 8px; padding: 4px 10px;
    border-radius: 6px; font-size: 11px; font-weight: 600;
    background: rgba(0,0,0,0.7); color: white;
}
.img-badge.apify { background: #34c759; }
.img-info {
    display: flex; gap: 12px; margin-top: 8px; font-size: 13px;
}
.quality.high { color: #34c759; font-weight: 600; }
.quality.low { color: #ff9500; font-weight: 600; }
.no-img {
    padding: 40px 20px; text-align: center; color: #86868b;
    background: #f5f5f7; border-radius: 12px;
}
.no-img-icon { font-size: 40px; margin-bottom: 8px; }
.hint { font-size: 12px; color: #ff9500; margin-top: 4px; }
.valoracion { margin-top: 8px; }
.veredicto { font-size: 14px; font-weight: 600; }
.veredicto.ok { color: #34c759; }
.veredicto.fail { color: #ff3b30; }
</style>
</head>
<body>
<h1>🔍 Prueba Apify Google Images Scraper</h1>
<p class="subtitle">Buscando imágenes reales para 5 recetas de prueba. Sin coste de IA.</p>

<div class="resumen">
    <strong>📊 Resultados</strong>
    <div class="resumen-grid">
        <div class="resumen-item">
            <span class="num exito">${exitos}</span>
            <span class="label">✅ Con imagen real</span>
        </div>
        <div class="resumen-item">
            <span class="num fallo">${fallos}</span>
            <span class="label">❌ Sin imagen (toca IA)</span>
        </div>
        <div class="resumen-item">
            <span class="num">${resultados.length}</span>
            <span class="label">📝 Total recetas</span>
        </div>
    </div>
</div>

<div id="recetas-container">${cards}</div>

<p style="text-align:center;color:#86868b;font-size:13px;margin-top:20px;">
    ⚡ Solo se ha usado Apify (gratis con crédito inicial).
    Los créditos de Flux Pro se reservan para las recetas sin imagen real.
</p>
</body>
</html>`

    writeFileSync(join(SALIDA_DIR, 'comparativa.html'), html)
    console.log(`\n  📄 Panel: file://${join(SALIDA_DIR, 'comparativa.html')}`)
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║   🔍 PRUEBA APIFY GOOGLE IMAGES SCRAPER                 ║
║   Imágenes REALES para recetas (sin coste de IA)        ║
╚══════════════════════════════════════════════════════════╝
    `)

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

    console.log(`📝 Probando con ${recetas.length} recetas:\n`)
    recetas.forEach((r, i) => console.log(`   ${i + 1}. ${r.nombre}`))

    const resultados = []
    let exitos = 0
    let fallos = 0

    for (let i = 0; i < recetas.length; i++) {
        const r = recetas[i]
        console.log(`\n${'─'.repeat(50)}`)
        console.log(`\n[${i + 1}/${recetas.length}] ${r.nombre}`)

        const apifyResult = await buscarConApify(r.nombre)

        if (apifyResult) {
            const img = guardarBuffer(apifyResult.buffer, r.nombre, 'apify_google', apifyResult.url)
            resultados.push({ ...r, imagen: img })
            exitos++
        } else {
            resultados.push({ ...r, imagen: null })
            fallos++
        }
    }

    // Generar panel
    console.log(`\n${'═'.repeat(50)}`)
    console.log(`\n📊 RESULTADOS:`)
    console.log(`   ✅ Imágenes reales encontradas: ${exitos}/${recetas.length}`)
    console.log(`   ❌ Sin imagen (necesitarán IA): ${fallos}/${recetas.length}`)
    console.log(`   💰 Coste Apify estimado: ~$0.01-0.05 (de los $5 gratis)`)

    generarPanel(resultados)

    console.log(`\n${'═'.repeat(50)}`)
    console.log(`\n📋 PRÓXIMOS PASOS SUGERIDOS:`)

    if (exitos >= 3) {
        console.log(`   ✅ Apify funciona bien! Podemos usarlo como fuente principal.`)
        console.log(`   🔄 Para las ${fallos} recetas sin imagen real, usaremos Flux Pro con cuidado.`)
        console.log(`   💡 Recomendación: pipeline definitivo = Apify primero → Flux Pro solo si no hay imagen real`)
    } else {
        console.log(`   ⚠️  Apify no encuentra suficientes imágenes reales.`)
        console.log(`   🔄 Habrá que combinar con GPT Image 2 o Flux Pro para la mayoría.`)
    }

    console.log(`\n   📄 Abre el panel para ver las imágenes: file://${join(SALIDA_DIR, 'comparativa.html')}`)
}

main().catch(err => {
    console.error('❌ Error:', err)
    process.exit(1)
})

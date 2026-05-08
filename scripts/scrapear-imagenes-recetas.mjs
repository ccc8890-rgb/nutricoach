/**
 * scrapear-imagenes-recetas.mjs
 *
 * SISTEMA MULTI-MÉTODO DE EXTRACCIÓN DE IMÁGENES PARA RECETAS
 * ==========================================================
 *
 * Prueba TODOS los métodos disponibles para cada receta y genera
 * un panel visual para que apruebes la que más te guste.
 *
 * MÉTODOS (en orden de preferencia):
 *   1. Playwright Instagram/TikTok → captura real del post
 *   2. Google Images → busca "[nombre] receta" y descarga la mejor
 *   3. Flux Pro img2img (strength 0.3) → refino sutil anti-plagio
 *   4. Flux Pro text-to-image → generación desde cero
 *
 * USO:
 *   node scripts/scrapear-imagenes-recetas.mjs
 *
 * SALIDA:
 *   salidas/revision-imagenes/ → carpeta con imágenes candidatas
 *   salidas/revision-imagenes/revision.html → panel visual interactivo
 *
 * DESPUÉS DE REVISAR:
 *   Las imágenes aprobadas se suben a Supabase Storage y se actualiza la BD
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
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
loadEnv()

// ── Config ─────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const API_KEY = process.env.REPLICATE_API_KEY
const REPLICATE_API = 'https://api.replicate.com/v1'
const FLUX_PRO = 'black-forest-labs/flux-pro'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SALIDA_DIR = resolve(RAÍZ, 'salidas', 'revision-imagenes')
// Procesar todas las recetas sin imagen (106). Se puede limitar con MAX_RECETAS=10
const MAX_RECETAS = parseInt(process.env.MAX_RECETAS || '9999', 10)
const API_BASE_URL = process.env.APP_URL || 'http://localhost:3008'

// Control de costes Flux Pro: $0.05/imagen
const COSTE_POR_IMAGEN = 0.05

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
    return name
}

// ═══════════════════════════════════════════════════════
//  MÉTODO 0: agent-browser (imagen real de la fuente)
// ═══════════════════════════════════════════════════════

async function capturarConAgentBrowser(url) {
    try {
        const { execSync } = await import('child_process')
        const tree = execSync(
            `agent-browser accessibility ${JSON.stringify(url)}`,
            {
                timeout: 30000,
                encoding: 'utf8',
                env: { ...process.env, PATH: '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + (process.env.PATH || '') }
            }
        )
        const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
        const urls = [...new Set([...tree.matchAll(imgRegex)].map(m => m[0]))]
        for (const imgUrl of urls.slice(0, 15)) {
            const buf = await descargarBuffer(imgUrl)
            if (buf && buf.length > 15000) {
                return { buffer: buf, url: imgUrl, fuente: 'agent_browser' }
            }
        }
        return null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  MÉTODO 1: Playwright Instagram/TikTok
// ═══════════════════════════════════════════════════════

async function capturarConPlaywright(url) {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            viewport: { width: 390, height: 844 },
        })
        const page = await context.newPage()

        let mejorImagen = null
        let mayorTamano = 0

        page.on('response', async (response) => {
            const ct = response.headers()['content-type'] || ''
            if (ct.startsWith('image/')) {
                try {
                    const buf = await response.body()
                    if (buf.length > mayorTamano) {
                        mayorTamano = buf.length
                        mejorImagen = buf
                    }
                } catch { /* ignore */ }
            }
        })

        await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
        await page.waitForTimeout(2000)

        // Buscar imágenes grandes en la página
        const imgSrcs = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'))
            return imgs
                .filter(img => img.naturalWidth > 100 && img.naturalHeight > 100)
                .sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))
                .slice(0, 3)
                .map(img => img.src)
        })

        for (const src of imgSrcs) {
            const buf = await descargarBuffer(src)
            if (buf && buf.length > mayorTamano) {
                mejorImagen = buf
                mayorTamano = buf.length
            }
        }

        await browser.close()

        if (mejorImagen && mayorTamano > 5000) return mejorImagen

        // Último recurso: screenshot
        const screenshot = await page.screenshot({ type: 'jpeg', quality: 80, fullPage: false })
        await browser.close()
        return screenshot.length > 10000 ? screenshot : null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  MÉTODO 2: Bing Images Scraper (Playwright, gratis)
//  Bing no bloquea scrapers como Google
// ═══════════════════════════════════════════════════════

async function buscarEnGoogleImages(nombreReceta) {
    try {
        const { chromium } = await import('playwright')
        const browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        })
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
        })
        const page = await context.newPage()

        // Usar Bing Images (no bloquea scrapers)
        const query = encodeURIComponent(`"${nombreReceta}" receta`)
        await page.goto(`https://www.bing.com/images/search?q=${query}`, {
            waitUntil: 'domcontentloaded',
            timeout: 20000,
        })

        await page.waitForTimeout(3000)

        // Extraer URLs de imágenes de Bing (selector .mimg)
        const urls = await page.evaluate(() => {
            const imgs = document.querySelectorAll('img.mimg')
            return Array.from(imgs)
                .map(img => img.getAttribute('src') || img.getAttribute('data-src') || '')
                .filter(src => src.startsWith('http') && !src.includes('bing') && src.length > 50)
                .slice(0, 5)
        })

        await browser.close()

        for (const url of urls) {
            const buf = await descargarBuffer(url)
            if (buf && buf.length > 10000) {
                return { buffer: buf, url, fuente: 'bing_images' }
            }
        }

        return null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  MÉTODO 3: Flux Pro img2img (refino sutil)
// ═══════════════════════════════════════════════════════

async function generarConFlux(prompt, imagenReferencia = null, strength = 0.85) {
    if (!API_KEY) return null

    try {
        const input = {
            prompt,
            aspect_ratio: '1:1',
            output_format: 'webp',
            safety_tolerance: 2,
            num_outputs: 1,
        }

        if (imagenReferencia) {
            input.image = imagenReferencia
            input.strength = strength  // 0.3 = cambio muy sutil
        }

        const createRes = await fetch(`${REPLICATE_API}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ version: FLUX_PRO, input }),
        })

        if (!createRes.ok) {
            const err = await createRes.text()
            if (createRes.status === 402) {
                console.warn('     ⚠️ Crédito insuficiente en Replicate')
                return null
            }
            if (createRes.status === 429) {
                console.log('     ⏳ Rate limit, esperando 10s...')
                await new Promise(r => setTimeout(r, 10000))
                return generarConFlux(prompt, imagenReferencia, strength)
            }
            console.warn(`     ⚠️ Replicate error ${createRes.status}`)
            return null
        }

        const prediction = await createRes.json()
        const timeout = 60000
        const start = Date.now()
        let url = prediction.urls.get

        while (Date.now() - start < timeout) {
            await new Promise(r => setTimeout(r, 2000))
            const poll = await fetch(url, {
                headers: { 'Authorization': `Bearer ${API_KEY}` },
            })
            if (!poll.ok) break
            const status = await poll.json()

            if (status.status === 'succeeded') {
                const output = status.output
                if (Array.isArray(output) && output.length > 0) return output[0]
                if (typeof output === 'string') return output
                return null
            }
            if (status.status === 'failed') return null
            url = status.urls.get
        }
        return null
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════
//  CONSTRUIR PROMPT
// ═══════════════════════════════════════════════════════
//  PROMPTS PREMIUM ESTILO LIBRO DE COCINA
// ═══════════════════════════════════════════════════════

const MAPA_ESTILOS_COCINA = {
    'Postre': {
        angulo: 'ángulo cenital ligeramente inclinado, 45 grados',
        vajilla: 'en plato de postre blanco de cerámica artesanal con borde dorado fino',
        fondo: 'madera oscura vintage, textura de mármol blanco suave',
        detalle: 'textura cremosa visible, brillo sutil, capas y cobertura perfecta',
        vibra: 'acogedor, artesanal, postrería fina casera',
        extras: 'servilleta de tela arrugada al lado, tenedor de postre plateado',
    },
    'Dulce': {
        angulo: 'plano cenital con ligera profundidad',
        vajilla: 'en bandeja de mármol blanco o fuente de cerámica',
        fondo: 'superficie de mármol blanco con textura, luz difusa',
        detalle: 'migas finas, textura dorada, brillo de glaseado, capas visibles al corte',
        vibra: 'pastelería artesanal de revista, dulce cuidado',
        extras: 'granos de café o flores pequeñas al lado para decoración natural',
    },
    'Desayuno': {
        angulo: 'plano cenital, flat lay natural',
        vajilla: 'en cuenco de cerámica blanca rugosa y plato llano',
        fondo: 'mesa de madera clara, luz natural de mañana entrando por la ventana',
        detalle: 'texturas de avena, fruta fresca, chorrito de miel, vapor sutil',
        vibra: 'mañana tranquila, desayuno saludable, hygge escandinavo',
        extras: 'una taza de café al lado, un par de arándanos sueltos',
    },
    'Comida': {
        angulo: 'ángulo de 45 grados, clásico de blog de cocina',
        vajilla: 'en plato llano de cerámica artesanal de color crudo',
        fondo: 'mesa de madera rústica, luz natural lateral desde ventana',
        detalle: 'vapor sutil, ingredientes enteros alrededor, salsa brillante, hierbas frescas espolvoreadas',
        vibra: 'cocina casera española de revista, apetitoso, auténtico',
        extras: 'servilleta de tela doblada, cubiertos de acero inoxidable',
    },
    'Cena': {
        angulo: 'ángulo de 45 grados, composición elegante',
        vajilla: 'en plato hondo de cerámica oscura o pizarra',
        fondo: 'mesa oscura iluminada con luz cálida, ambiente íntimo',
        detalle: 'salsa con brillo, vapor tenue, texturas ricas, contraste de colores',
        vibra: 'cena elegante en casa, restaurante en tu hogar',
        extras: 'copa de vino tinto al fondo, vela pequeña, mantel de lino',
    },
    'Snack': {
        angulo: 'plano cenital con composición en diagonal',
        vajilla: 'en tabla de madera pequeña o bol de cerámica',
        fondo: 'tabla de cortar de madera, luz natural',
        detalle: 'textura crujiente visible, chips, trozos, dips cremosos',
        vibra: 'snack saludable, pausa a media mañana',
        extras: 'algunos ingredientes sueltos alrededor, servilleta de papel',
    },
    'Merienda': {
        angulo: 'plano cenital, composición de merienda completa',
        vajilla: 'plato pequeño de cerámica blanca',
        fondo: 'mesa de cocina con luz de tarde, cálida',
        detalle: 'textura horneada, fruta fresca cortada, chocolate fundido',
        vibra: 'merienda casera de la abuela, acogedor',
        extras: 'vaso de leche o té, trozo de fruta adicional',
    },
}

function construirPromptCasero(nombre, categoria, ingredientes) {
    const ings = (ingredientes || []).slice(0, 5).map(i => typeof i === 'string' ? i : (i.nombre || i))
    const ingStr = ings.length > 0 ? ings.join(', ') : 'ingredientes de la receta'

    const estilos = {
        Postre: ['soft afternoon light, white kitchen counter, homemade dessert', 'window light, marble surface, casual home baking moment', 'warm afternoon, simple plate on wooden table, homemade feel'],
        Desayuno: ['morning light through kitchen window, wooden table, casual breakfast', 'bright morning Mediterranean kitchen, white countertop, simple setup', 'early morning soft light, rustic wood surface, honest home breakfast'],
        Comida: ['afternoon natural light, home dining table, casual Spanish kitchen', 'warm midday light, simple ceramic plate, home cooked meal', 'Mediterranean kitchen, terracotta, natural window light, honest food'],
        Cena: ['warm evening kitchen light, casual dinner plate, cozy home', 'low natural light, dark wood table, intimate Spanish kitchen', 'evening warm tones, simple plating, authentic home dinner'],
        Snack: ['quick grab shot, kitchen counter, casual home snack', 'natural light, simple plate, casual afternoon at home'],
        Merienda: ['afternoon light, home kitchen table, casual snack time', 'soft afternoon, simple ceramic, Mediterranean home kitchen'],
    }
    const opciones = estilos[categoria] || estilos['Comida']
    const estilo = opciones[Math.floor(Math.random() * opciones.length)]

    return [
        `casual home food photo of '${nombre}',`,
        `${estilo},`,
        `key ingredients visible: ${ingStr}.`,
        `Shot on Sony mirrorless camera, personal food blog aesthetic,`,
        `authentic home-cooked presentation, honest natural food photography,`,
        `slightly imperfect composition, no studio lighting, no flash,`,
        `warm Mediterranean color grade, real kitchen feel, not overly styled.`,
        `Photorealistic, no AI artifacts, no watermarks.`,
    ].join(' ')
}

function construirPromptRefino(nombre, ingredientes) {
    const ings = (ingredientes || []).slice(0, 4)
    const ingNombres = ings.length > 0
        ? ings.map(i => typeof i === 'string' ? i : (i.nombre || i)).join(', ')
        : 'ingredientes de la receta'

    return [
        `Fine dining editorial photo of "${nombre}".`,
        `Same composition but elevated: professional food styling,`,
        `garnished with ${ingNombres}, light drizzle of sauce, herb sprinkle.`,
        `Served on artisan ceramic plate on dark wood table.`,
        `Natural window lighting from left, warm tones.`,
        `Textures: rich, moist, crumbly, glossy where appropriate.`,
        `Style: Michelin-star restaurant plating, food magazine editorial.`,
        `Hasselblad medium format, 85mm, f/1.8, shallow DOF, creamy bokeh.`,
        `8K, hyper-realistic, professional color grade. No text, no watermark.`,
    ].join(' ')
}

function construirPrompt(nombre, ingredientes, esRefino = false) {
    // Extraer ingredientes como array de strings
    const ingsFlat = (ingredientes || []).map(i => typeof i === 'string' ? i : (i.nombre || i))

    if (esRefino) {
        return construirPromptRefino(nombre, ingsFlat)
    }

    // Intentar inferir categoría del nombre para mejor estilo
    const palabrasClave = nombre.toLowerCase()
    let categoria = 'Comida'
    if (/postre|tarta|brownie|pastel|dulce|mousse|pudding|crepe|bizcocho|galleta/.test(palabrasClave)) categoria = 'Postre'
    else if (/desayuno|avena|tostada|muesli|gachas/.test(palabrasClave)) categoria = 'Desayuno'
    else if (/snack|bolitas|barrita|energy/.test(palabrasClave)) categoria = 'Snack'
    else if (/merienda/.test(palabrasClave)) categoria = 'Merienda'

    return construirPromptCasero(nombre, categoria, ingsFlat)
}

// ═══════════════════════════════════════════════════════
//  GENERAR PANEL HTML DE REVISIÓN
// ═══════════════════════════════════════════════════════

function generarPanelHTML(resultados) {
    const cards = resultados.map((r, idx) => {
        const metodos = r.imagenes.map(img => {
            // Incrustar imagen como base64 data URI para que funcione desde file://
            const rutaCompleta = join(SALIDA_DIR, img.path)
            let dataUri = ''
            try {
                const buf = readFileSync(rutaCompleta)
                const ext = img.path.endsWith('.png') ? 'png' : 'webp'
                dataUri = `data:image/${ext};base64,${buf.toString('base64')}`
            } catch {
                dataUri = img.path // fallback
            }
            return `
            <div class="imagen-card" data-receta="${idx}" data-metodo="${img.metodo}">
                <img src="${dataUri}" alt="${r.nombre} - ${img.metodo}" loading="lazy"
                     onerror="this.parentElement.classList.add('error')">
                <div class="metodo-label ${img.metodo}">${img.metodo}</div>
                ${img.tamano ? `<div class="tamano">${(img.tamano / 1024).toFixed(0)}KB</div>` : ''}
                <button class="btn-aprobar" onclick="aprobar(${idx}, '${img.metodo}')">✅ Aprobar</button>
            </div>
`
        }).join('')

        return `
        <div class="receta-card" id="receta-${idx}">
            <h2>${r.nombre}</h2>
            <p class="meta">
                ${r.categoria ? `📂 ${r.categoria}` : ''}
                ${r.url_origen ? `🔗 <a href="${r.url_origen}" target="_blank">origen</a>` : '🔗 sin URL'}
                ${r.estado_actual ? `📸 ${r.estado_actual}` : '📸 sin imagen'}
            </p>
            <div class="imagenes-grid">
                ${metodos}
                ${r.imagenes.length === 0 ? '<div class="no-imagenes">❌ No se encontraron imágenes</div>' : ''}
            </div>
            <div class="acciones">
                <button class="btn-regen" onclick="regenerarIA(${idx})">🎨 Regenerar con IA sutil</button>
                <button class="btn-skipalumno" onclick="saltar(${idx})">⏭️ Saltar</button>
            </div>
        </div>
        `
    }).join('')

    const recetasData = JSON.stringify(resultados.map(r => ({
        id: r.id,
        nombre: r.nombre,
        url_origen: r.url_origen,
        ingredientes: r.ingredientes,
    })))
    const apiBaseUrl = API_BASE_URL

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Revisión de Imágenes - Recetario</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    padding: 20px;
}
h1 { font-size: 24px; margin-bottom: 8px; }
.subtitle { color: #86868b; margin-bottom: 24px; }
.stats { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
.stat {
    background: white; padding: 12px 20px; border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    font-size: 14px;
}
.stat strong { font-size: 20px; display: block; }
.receta-card {
    background: white; border-radius: 16px; padding: 20px;
    margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.receta-card h2 { font-size: 18px; margin-bottom: 4px; }
.meta { color: #86868b; font-size: 13px; margin-bottom: 16px; }
.meta a { color: #0071e3; text-decoration: none; }
.imagenes-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px; margin-bottom: 16px;
}
.imagen-card {
    position: relative; border-radius: 12px; overflow: hidden;
    background: #f0f0f0; aspect-ratio: 1; cursor: pointer;
    border: 3px solid transparent; transition: all 0.2s;
}
.imagen-card:hover { border-color: #0071e3; }
.imagen-card.aprobada { border-color: #34c759; background: #e8f8ee; }
.imagen-card.descartada { opacity: 0.4; }
.imagen-card.error { background: #fff2f2; }
.imagen-card img {
    width: 100%; height: 100%; object-fit: cover; display: block;
}
.metodo-label {
    position: absolute; top: 6px; left: 6px;
    font-size: 10px; padding: 2px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.7); color: white; font-weight: 600;
}
.metodo-label.playwright { background: #34c759; }
.metodo-label.bing_images { background: #0071e3; }
.metodo-label.flux_img2img { background: #ff9500; }
.metodo-label.flux_txt2img { background: #ff3b30; }
.metodo-label.oembed { background: #5856d6; }
.metodo-label.agent_browser { background: #30d158; }
.tamano {
    position: absolute; bottom: 6px; right: 6px;
    font-size: 10px; padding: 2px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.6); color: white;
}
.btn-aprobar {
    position: absolute; bottom: 6px; left: 6px; right: 6px;
    padding: 6px; border: none; border-radius: 6px;
    background: #34c759; color: white; font-size: 12px; font-weight: 600;
    cursor: pointer; opacity: 0; transition: opacity 0.2s;
}
.imagen-card:hover .btn-aprobar { opacity: 1; }
.btn-aprobar:hover { background: #28a745; }
.acciones { display: flex; gap: 8px; }
.btn-regen, .btn-skipalumno {
    padding: 8px 16px; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 500; cursor: pointer;
}
.btn-regen { background: #ff9500; color: white; }
.btn-regen:hover { background: #e08600; }
.btn-skipalumno { background: #e5e5ea; color: #1d1d1f; }
.btn-skipalumno:hover { background: #d1d1d6; }
.no-imagenes {
    grid-column: 1 / -1; padding: 40px; text-align: center;
    color: #86868b; font-size: 14px;
}
#acciones-globales {
    position: sticky; bottom: 0; background: rgba(255,255,255,0.95);
    backdrop-filter: blur(10px); padding: 16px 20px;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
    display: flex; gap: 12px; justify-content: center;
}
.btn-subir {
    padding: 12px 32px; border: none; border-radius: 12px;
    font-size: 15px; font-weight: 600; cursor: pointer;
}
.btn-subir.primary { background: #0071e3; color: white; }
.btn-subir.primary:hover { background: #0066cc; }
.btn-subir.secondary { background: #e5e5ea; color: #1d1d1f; }
.toast {
    position: fixed; top: 20px; right: 20px;
    padding: 12px 20px; border-radius: 12px; color: white;
    font-size: 14px; font-weight: 500; z-index: 999;
    animation: slideIn 0.3s ease;
}
.toast.success { background: #34c759; }
.toast.error { background: #ff3b30; }
.toast.info { background: #0071e3; }
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
</head>
<body>

<h1>📸 Revisión de Imágenes - Recetario</h1>
<p class="subtitle">Selecciona la mejor imagen para cada receta. Las aprobadas se subirán a Storage.</p>

<div class="stats" id="stats">
    <div class="stat"><strong>${resultados.length}</strong> recetas</div>
    <div class="stat"><strong id="aprobadas-count">0</strong> aprobadas</div>
    <div class="stat"><strong id="pendientes-count">${resultados.length}</strong> pendientes</div>
</div>

<div id="recetas-container">${cards}</div>

<div id="acciones-globales">
    <button class="btn-subir primary" onclick="subirAprobadas()">📤 Subir aprobadas a Storage</button>
    <button class="btn-subir secondary" onclick="seleccionarMejores()">🤖 Auto-seleccionar mejores</button>
</div>

<div id="toast-container"></div>

<script>
const API_BASE = '${apiBaseUrl}';
const RECETAS = ${recetasData};
const seleccion = {};  // { recetaIdx: 'metodo' }

function aprobar(idx, metodo) {
    // Deseleccionar otras imágenes de esta receta
    document.querySelectorAll(\`[data-receta="\${idx}"]\`).forEach(el => {
        el.classList.remove('aprobada');
    });
    // Seleccionar esta
    document.querySelectorAll(\`[data-receta="\${idx}"][data-metodo="\${metodo}"]\`).forEach(el => {
        el.classList.add('aprobada');
    });
    seleccion[idx] = metodo;
    actualizarStats();
    mostrarToast(\`✅ \${RECETAS[idx].nombre}: \${metodo}\`, 'success');
}

function saltar(idx) {
    document.querySelectorAll(\`[data-receta="\${idx}"]\`).forEach(el => {
        el.classList.add('descartada');
    });
    delete seleccion[idx];
    actualizarStats();
}

function actualizarStats() {
    const total = Object.keys(seleccion).length;
    document.getElementById('aprobadas-count').textContent = total;
    document.getElementById('pendientes-count').textContent = RECETAS.length - total;
}

function mostrarToast(msg, tipo = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = \`toast \${tipo}\`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function seleccionarMejores() {
    RECETAS.forEach((_, idx) => {
        const cards = document.querySelectorAll(\`[data-receta="\${idx}"]\`);
        if (cards.length === 0) return;

        // Orden de preferencia
        const orden = ['agent_browser', 'playwright', 'bing_images', 'oembed', 'flux_img2img', 'flux_txt2img'];

        for (const metodo of orden) {
            const card = Array.from(cards).find(c => c.dataset.metodo === metodo && !c.classList.contains('error'));
            if (card) {
                aprobar(idx, metodo);
                return;
            }
        }
    });
    mostrarToast(\`🤖 \${Object.keys(seleccion).length} recetas seleccionadas automáticamente\`, 'info');
}

async function subirAprobadas() {
    const pendientes = RECETAS.filter((_, i) => !seleccion[i]);
    if (pendientes.length > 0) {
        if (!confirm(\`⚠️ Quedan \${pendientes.length} recetas sin aprobar. ¿Subir solo las aprobadas?\`)) return;
    }

    const btn = document.querySelector('.btn-subir.primary');
    btn.textContent = '📤 Subiendo...';
    btn.disabled = true;

    for (const [idxStr, metodo] of Object.entries(seleccion)) {
        const idx = parseInt(idxStr);
        const receta = RECETAS[idx];
        const imgEl = document.querySelector(\`[data-receta="\${idx}"][data-metodo="\${metodo}"] img\`);
        if (!imgEl) continue;

        try {
            const res = await fetch(imgEl.src);
            const blob = await res.blob();
            const buffer = await blob.arrayBuffer();

            // Subir a Supabase Storage
            const safeName = receta.nombre
                .toLowerCase().replace(/[^a-z0-9áéíóúüñ\\s-]/g, '').replace(/\\s+/g, '-').substring(0, 60);
            const fileName = \`\${metodo}/\${safeName}-\${Date.now()}.webp\`;

            const formData = new FormData();
            formData.append('file', new Blob([buffer], { type: 'image/webp' }), fileName);

            // Llamar a nuestra API para subir
            const uploadRes = await fetch(API_BASE + '/api/subir-imagen-receta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    receta_id: receta.id,
                    buffer: Array.from(new Uint8Array(buffer)),
                    fileName,
                    metodo,
                }),
            });

            if (uploadRes.ok) {
                mostrarToast(\`✅ \${receta.nombre} subida correctamente\`, 'success');
            } else {
                mostrarToast(\`❌ Error al subir \${receta.nombre}\`, 'error');
            }
        } catch (err) {
            mostrarToast(\`❌ Error: \${receta.nombre}\`, 'error');
        }
    }

    btn.textContent = '📤 Subir aprobadas a Storage';
    btn.disabled = false;
    mostrarToast('✅ Proceso completado', 'success');
}
</script>
</body>
</html>`

    writeFileSync(join(SALIDA_DIR, 'revision.html'), html)
    console.log(`   📄 Panel de revisión: ${join(SALIDA_DIR, 'revision.html')}`)
}

// ═══════════════════════════════════════════════════════
//  REBUILD PANEL DESDE ARCHIVOS EXISTENTES
// ═══════════════════════════════════════════════════════

async function rebuildPanel() {
    console.log(`\n  🔄 Reconstruyendo panel desde archivos existentes...`)

    if (!existsSync(SALIDA_DIR)) {
        console.log('  ❌ No existe el directorio de salida')
        return
    }

    const files = readdirSync(SALIDA_DIR).filter(f => f.endsWith('.webp'))
    if (files.length === 0) {
        console.log('  ❌ No hay imágenes en el directorio')
        return
    }

    // Agrupar por receta (nombre después del `--`)
    const grupos = {}
    for (const f of files) {
        const match = f.match(/^(\w+)--(.+)\.webp$/)
        if (!match) continue
        const [, metodo, nombreReceta] = match
        const stats = statSync(join(SALIDA_DIR, f))
        if (!grupos[nombreReceta]) grupos[nombreReceta] = []
        grupos[nombreReceta].push({ metodo, path: f, tamano: stats.size })
    }

    const nombres = Object.keys(grupos)
    console.log(`  📊 ${nombres.length} recetas encontradas en disco`)

    // Buscar metadatos en Supabase
    const resultados = []
    for (const nombreSlug of nombres) {
        // Reconstruir nombre original aproximado
        const nombreOriginal = nombreSlug.replace(/-/g, ' ')

        const { data: recetas } = await supabase
            .from('recetas')
            .select('id, nombre, categoria, url_origen, imagen_url')
            .ilike('nombre', `%${nombreOriginal.replace(/'/g, "''")}%`)
            .limit(1)

        const r = recetas?.[0] || { id: null, nombre: nombreOriginal, categoria: null, url_origen: null }

        const { data: ings } = r.id ? await supabase
            .from('receta_ingredientes')
            .select('nombre_libre')
            .eq('receta_id', r.id) : { data: [] }

        resultados.push({
            id: r.id,
            nombre: r.nombre || nombreOriginal,
            categoria: r.categoria,
            url_origen: r.url_origen,
            estado_actual: r.imagen_url ? 'tiene imagen' : 'sin imagen',
            ingredientes: (ings || []).map(i => i.nombre_libre).filter(Boolean),
            imagenes: grupos[nombreSlug].sort((a, b) => {
                const orden = ['playwright', 'bing_images', 'oembed', 'flux_img2img', 'flux_txt2img']
                return orden.indexOf(a.metodo) - orden.indexOf(b.metodo)
            }),
        })
    }

    generarPanelHTML(resultados)
    console.log(`\n  ✅ Panel regenerado: salidas/revision-imagenes/revision.html`)
    console.log(`     file://${join(SALIDA_DIR, 'revision.html')}`)
}

// ═══════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2)

    // ── Help ──
    if (args.includes('--help')) {
        console.log(`
Uso:
  node scripts/scrapear-imagenes-recetas.mjs           → procesa recetas SIN imagen
  node scripts/scrapear-imagenes-recetas.mjs --todas   → procesa TODAS las recetas (sin borrar)
  node scripts/scrapear-imagenes-recetas.mjs --reset   → BORRA imagen_url de todas y regenera
  node scripts/scrapear-imagenes-recetas.mjs --rebuild → reconstruye panel HTML desde disco
`)
        return
    }

    const RESET_MODE = args.includes('--reset')
    const TODAS_MODE = args.includes('--todas')

    if (args.includes('--rebuild')) {
        await rebuildPanel()
        return
    }

    if (RESET_MODE) {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║  🔄 MODO RESET — Rehaciendo todas las imágenes          ║
║  Borrando imágenes actuales y regenerando desde cero    ║
╚══════════════════════════════════════════════════════════╝
`)
    } else if (TODAS_MODE) {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 MODO TODAS — Procesando todas las recetas           ║
║  Sin borrar imágenes existentes                         ║
╚══════════════════════════════════════════════════════════╝
`)
    } else {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║  📸 FLUX PRO - IMÁGENES TIPO LIBRO DE COCINA           ║
║  Prompts premium · Estilo Ottolenghi · 106 recetas      ║
╚══════════════════════════════════════════════════════════╝
`)
    }

    // Crear directorio de salida
    if (!existsSync(SALIDA_DIR)) mkdirSync(SALIDA_DIR, { recursive: true })

    // ── Modo reset: limpiar imagen_url de todas las recetas aprobadas ──
    if (RESET_MODE) {
        const { error: resetError } = await supabase
            .from('recetas')
            .update({ imagen_url: null })
            .eq('estado', 'aprobada')
        if (resetError) {
            console.error('  ❌ Error al limpiar imagen_url:', resetError)
            return
        }
        console.log('  🗑️  imagen_url limpiada en todas las recetas aprobadas')
    }

    // ── Query según modo ──
    let query = supabase
        .from('recetas')
        .select('id, nombre, categoria, url_origen, imagen_url, tipo_coccion')
        .eq('estado', 'aprobada')
        .limit(MAX_RECETAS)

    if (!RESET_MODE && !TODAS_MODE) {
        query = query.is('imagen_url', null)
    }

    const { data: recetas } = await query

    if (!recetas || recetas.length === 0) {
        console.log('  ✅ No hay recetas pendientes')
        return
    }

    // También obtener ingredientes para cada receta
    const recetasConIngs = []
    for (const r of recetas) {
        const { data: ings } = await supabase
            .from('receta_ingredientes')
            .select('nombre_libre')
            .eq('receta_id', r.id)
        recetasConIngs.push({
            ...r,
            ingredientes: (ings || []).map(i => i.nombre_libre).filter(Boolean),
        })
    }

    const total = recetasConIngs.length
    const costeEstimado = (total * COSTE_POR_IMAGEN).toFixed(2)

    console.log(`  📊 Recetas sin imagen: ${total}`)
    console.log(`  💰 Coste estimado:    $${costeEstimado} ($${COSTE_POR_IMAGEN}/img de crédito Replicate)`)
    console.log(`  💳 Crédito restante:  ~$${(10 - parseFloat(costeEstimado)).toFixed(2)} después de esto`)
    console.log(``)

    // Procesar en lotes de 10 para no saturar Replicate
    const LOTE = 10
    const batchPrompts = []

    for (let i = 0; i < recetasConIngs.length; i += LOTE) {
        const lote = recetasConIngs.slice(i, i + LOTE)
        batchPrompts.push(lote)
    }

    console.log(`  📦 ${batchPrompts.length} lotes de ~${LOTE} recetas cada uno`)
    console.log(`⏳ Tiempo estimado: ~${(total * 7).toFixed(0)} segundos (${(total * 7 / 60).toFixed(1)} min)\n`)

    const resultados = []
    let fluxCount = 0

    for (let b = 0; b < batchPrompts.length; b++) {
        console.log(`─── LOTE ${b + 1}/${batchPrompts.length} ──────────────────────`)

        for (let i = 0; i < batchPrompts[b].length; i++) {
            const r = batchPrompts[b][i]
            const idxGlobal = b * LOTE + i

            console.log(`  [${idxGlobal + 1}/${total}] ${r.nombre}`)

            // Método 0: agent-browser (imagen real de la fuente)
            let imagenBase = null
            if (r.url_origen) {
                console.log(`     📸 agent-browser capturando imagen real...`)
                imagenBase = await capturarConAgentBrowser(r.url_origen)
                if (imagenBase) {
                    console.log(`     ✅ Imagen real capturada (${(imagenBase.buffer.length / 1024).toFixed(0)}KB)`)
                    const filename = guardarBuffer(imagenBase.buffer, r.nombre, 'agent_browser')
                    resultados.push({ id: r.id, nombre: r.nombre, categoria: r.categoria, url_origen: r.url_origen, estado_actual: r.imagen_url ? 'tiene imagen' : 'sin imagen', ingredientes: r.ingredientes, imagenes: [{ metodo: 'agent_browser', path: filename, tamano: imagenBase.buffer.length }] })
                    // Saltar generación Flux si ya tenemos imagen real
                    continue
                }
            }

            // Flux Pro con prompts caseros (sin Playwright, sin Bing)
            const prompt = construirPromptCasero(r.nombre, r.categoria, r.ingredientes)
            console.log(`     🎨 Flux Pro generando...`)

            const fluxUrl = await generarConFlux(prompt, null, 0.2)
            if (fluxUrl) {
                const buf = await descargarBuffer(fluxUrl)
                if (buf) {
                    const filename = guardarBuffer(buf, r.nombre, 'flux_txt2img')
                    resultados.push({
                        id: r.id,
                        nombre: r.nombre,
                        categoria: r.categoria,
                        url_origen: r.url_origen,
                        estado_actual: r.imagen_url ? 'tiene imagen' : 'sin imagen',
                        ingredientes: r.ingredientes,
                        imagenes: [{ metodo: 'flux_txt2img', path: filename, tamano: buf.length }],
                    })
                    fluxCount++
                    console.log(`     ✅ Flux Pro: ${(buf.length / 1024).toFixed(0)}KB`)
                } else {
                    console.log(`     ⚠️ No se pudo descargar la imagen generada`)
                    resultados.push({
                        id: r.id, nombre: r.nombre, categoria: r.categoria,
                        url_origen: r.url_origen, estado_actual: 'sin imagen',
                        ingredientes: r.ingredientes, imagenes: [],
                    })
                }
            } else {
                console.log(`     ❌ Flux Pro falló`)
                resultados.push({
                    id: r.id, nombre: r.nombre, categoria: r.categoria,
                    url_origen: r.url_origen, estado_actual: 'sin imagen',
                    ingredientes: r.ingredientes, imagenes: [],
                })
            }

            // Pausa entre recetas para no sobrecargar Replicate
            if (i < batchPrompts[b].length - 1) {
                await new Promise(r => setTimeout(r, 3000))
            }
        }

        // Pausa entre lotes
        if (b < batchPrompts.length - 1) {
            const costeLote = (batchPrompts[b].length * COSTE_POR_IMAGEN).toFixed(2)
            console.log(`\n  💰 Coste lote ${b + 1}: ~$${costeLote}`)
            console.log(`  ⏳ Pausa 10s entre lotes...\n`)
            await new Promise(r => setTimeout(r, 10000))
        }
    }

    // ── Generar panel HTML ──────────────────────────
    console.log(`\n  📄 Generando panel de revisión...`)
    generarPanelHTML(resultados)

    // ── Resumen ─────────────────────────────────────
    const costeReal = (fluxCount * COSTE_POR_IMAGEN).toFixed(2)
    const sinImagen = resultados.filter(r => r.imagenes.length === 0).length

    console.log(`\n═══════════════════════════════════════════`)
    console.log(`  📊 RESUMEN FINAL`)
    console.log(`═══════════════════════════════════════════`)
    console.log(`  🎨 Flux Pro:       ${fluxCount}/${total} imágenes generadas`)
    console.log(`  ❌ Fallos:         ${sinImagen}`)
    console.log(`  💰 Coste real:     $${costeReal} (de $10 crédito Replicate)`)
    console.log(`  💳 Crédito resto:  ~$${(10 - parseFloat(costeReal)).toFixed(2)}`)
    console.log(`  📄 Panel:          salidas/revision-imagenes/revision.html`)
    console.log(`\n  ➡️  Abre el panel en tu navegador:`)
    console.log(`     file://${join(SALIDA_DIR, 'revision.html')}`)
    console.log(``)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

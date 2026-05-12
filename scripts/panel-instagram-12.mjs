/**
 * panel-instagram-12.mjs
 *
 * Genera un HTML comparativo de las 12 recetas de Instagram
 * mostrando og_image (fuente), flux_img2img (GPT-4o editada) y Supabase.
 *
 * USO: node scripts/panel-instagram-12.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, existsSync, readFileSync } from 'fs'
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

const RECETAS = [
    { nombre: 'Café con leche y aceite', slug: 'café-con-leche-y-aceite' },
    { nombre: 'Ensalada crujiente (sésamo jengibre)', slug: 'ensalada-crujiente-con-aderezo-cremoso-de-sésamo-y-jengibre' },
    { nombre: 'Ensalada de brócoli asado (miso césar)', slug: 'ensalada-de-brócoli-asado-con-aderezo-de-miso-césar' },
    { nombre: 'Pan de ajo relleno de queso', slug: 'pan-de-ajo-relleno-de-queso' },
    { nombre: 'Pan relleno de carne y queso al horno', slug: 'pan-relleno-de-carne-y-queso-al-horno' },
    { nombre: 'Pollo frito coreano', slug: 'pollo-frito-coreano' },
    { nombre: 'Pollo marinado con yogur y limón', slug: 'pollo-marinado-con-yogur-y-limón' },
    { nombre: 'Receta sin título', slug: 'receta-sin-título' },
    { nombre: 'Salsa Deluxe Fit', slug: 'salsa-deluxe-fit' },
    { nombre: 'Sándwich de pavo con salsa de yogur', slug: 'sándwich-de-pavo-con-salsa-de-yogur-y-ensalada' },
    { nombre: 'Smash Burger Kebab en Tortilla', slug: 'smash-burger-kebab-en-tortilla' },
    { nombre: 'Tartar de solomillo con boquerones', slug: 'tartar-de-solomillo-con-boquerones-y-piparra' },
]

import { readdirSync } from 'fs'

async function main() {
    // Cargar recetas de BD
    const { data: recetasBD } = await supabase
        .from('recetas')
        .select('id, nombre, imagen_url, url_origen')
        .order('nombre')

    const bdMap = {}
    for (const r of recetasBD || []) {
        bdMap[r.nombre.toLowerCase()] = r
    }

    const rows = RECETAS.map(r => {
        const ogFilename = `og_image--${r.slug}.webp`
        const fluxFilename = `flux_img2img--${r.slug}.webp`
        const ogPath = resolve(DISCO_DIR, ogFilename)
        const fluxPath = resolve(DISCO_DIR, fluxFilename)

        let ogSize = null
        let fluxSize = null
        let ogBytes = 0
        let fluxBytes = 0

        if (existsSync(ogPath)) {
            const stat = readFileSync(ogPath)
            ogBytes = stat.length
            ogSize = (stat.length / 1024).toFixed(0) + 'KB'
        }
        if (existsSync(fluxPath)) {
            const stat = readFileSync(fluxPath)
            fluxBytes = stat.length
            fluxSize = (stat.length / 1024).toFixed(0) + 'KB'
        }

        const bd = bdMap[r.nombre.toLowerCase()] || null
        const supabaseUrl = bd?.imagen_url || null

        return {
            ...r,
            ogFilename,
            fluxFilename,
            ogSize,
            fluxSize,
            ogBytes,
            fluxBytes,
            supabaseUrl,
            bd,
        }
    })

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>📸 Panel — 12 Instagram Reels</title>
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

.grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(450px, 1fr));
    gap: 20px;
}

.card {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

.card-header {
    padding: 12px 16px;
    background: #fbfbfd;
    border-bottom: 1px solid #e8e8ed;
}

.card-header h3 {
    font-size: 14px;
    font-weight: 600;
}

.card-header .meta {
    font-size: 11px;
    color: #86868b;
    margin-top: 4px;
}

.card-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
}

.img-col {
    padding: 8px;
}

.img-col h4 {
    font-size: 11px;
    color: #86868b;
    margin-bottom: 6px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.img-col img {
    width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
    border-radius: 8px;
    background: #f0f0f2;
}

.img-col .size {
    text-align: center;
    font-size: 11px;
    color: #86868b;
    margin-top: 4px;
}

.supabase-row {
    grid-column: 1 / -1;
    border-top: 1px solid #e8e8ed;
    padding: 8px 16px;
    font-size: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.supabase-row a {
    color: #0071e3;
    text-decoration: none;
    word-break: break-all;
    font-size: 11px;
}

.supabase-row a:hover { text-decoration: underline; }

.badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
}

.badge-ok { background: #e8f5e9; color: #2e7d32; }
.badge-warn { background: #fff3e0; color: #e65100; }
.badge-bad { background: #fce4ec; color: #c62828; }

.legend {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #86868b;
}

.legend-item .swatch {
    width: 16px;
    height: 16px;
    border-radius: 4px;
}
</style>
</head>
<body>

<h1>📸 Las 12 de Instagram — Estado actual</h1>
<p class="subtitle">og_image = fuente original (640x640, /media/?size=l) | flux_img2img = GPT-4o editada (1024x1024)</p>

<div class="legend">
    <div class="legend-item"><div class="swatch" style="background:#e8f5e9"></div> OK (>100KB og o >500KB flux)</div>
    <div class="legend-item"><div class="swatch" style="background:#fff3e0"></div> Regular</div>
    <div class="legend-item"><div class="swatch" style="background:#fce4ec"></div> Mala (og < 60KB o flux < 500KB)</div>
</div>

<div class="grid">
${rows.map(r => {
        const ogBadge = !r.ogSize ? 'badge-bad' : (r.ogBytes < 60000 ? 'badge-bad' : (r.ogBytes < 150000 ? 'badge-warn' : 'badge-ok'))
        const fluxBadge = !r.fluxSize ? 'badge-bad' : (r.fluxBytes < 600000 ? 'badge-bad' : (r.fluxBytes < 1000000 ? 'badge-warn' : 'badge-ok'))

        return `
<div class="card">
    <div class="card-header">
        <h3>${r.nombre}</h3>
        <div class="meta">
            <span class="badge ${ogBadge}">📸 OG ${r.ogSize || '—'}</span>
            <span class="badge ${fluxBadge}">🎨 Claude ${r.fluxSize || '—'}</span>
            <span>🆔 ${r.bd?.id ? r.bd.id.slice(0, 8) : '?'}</span>
        </div>
    </div>
    <div class="card-body">
        <div class="img-col">
            <h4>📸 og_image (fuente IG)</h4>
            <img src="/${r.ogFilename}" alt="og ${r.slug}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2212%22>NO FILE</text></svg>'">
            <div class="size">${r.ogSize || '❌ No existe'}</div>
        </div>
        <div class="img-col">
            <h4>🎨 flux_img2img (GPT-4o)</h4>
            <img src="/${r.fluxFilename}" alt="flux ${r.slug}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%22 x=%2250%22 text-anchor=%22middle%22 font-size=%2212%22>NO FILE</text></svg>'">
            <div class="size">${r.fluxSize || '❌ No existe'}</div>
        </div>
    </div>
    ${r.supabaseUrl ? `
    <div class="supabase-row">
        <span class="badge badge-ok">✅ En Supabase</span>
        <a href="${r.supabaseUrl}" target="_blank">${r.supabaseUrl.slice(0, 80)}...</a>
    </div>` : `
    <div class="supabase-row">
        <span class="badge badge-bad">❌ No subida a Supabase</span>
    </div>`}
</div>`
    }).join('\n')}
</div>

<style>
/* onerror handling for SVG placeholder */
</style>

</body>
</html>`

    const outPath = resolve(DISCO_DIR, 'panel-instagram-12.html')
    writeFileSync(outPath, html)
    console.log(`\n✅ Panel generado: ${outPath}`)
    console.log(`   Abrelo con el server HTTP en http://localhost:8080/panel-instagram-12.html`)
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

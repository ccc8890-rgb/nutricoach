/**
 * analizar-urls-pendientes.mjs
 * 
 * Analiza qué recetas pendientes de refinar tienen url_origen disponible
 * y si ya tienen og_image descargada en disco.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
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
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

function n2s(n) {
    return n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const SALIDA = '/Users/carloscasanova/Desktop/Carlos/CLAUDE/NUTRICION/nutricoach/salidas/revision-imagenes'
const disk = readdirSync(SALIDA)

// Index files on disk
const fluxSlugs = new Set()
const aiGenSlugs = new Set()
const ogImageSlugs = new Set()
for (const f of disk) {
    if (f.startsWith('flux_txt2img--')) {
        const slug = f.slice('flux_txt2img--'.length).replace(/\.(webp|jpg|png)$/, '')
        fluxSlugs.add(slug)
    }
    if (f.startsWith('ai_gen--')) {
        const slug = f.slice('ai_gen--'.length).replace(/\.(webp|jpg|png)$/, '')
        aiGenSlugs.add(slug)
    }
    if (f.startsWith('og_image--')) {
        const slug = f.slice('og_image--'.length).replace(/\.(webp|jpg|png)$/, '')
        ogImageSlugs.add(slug)
    }
}

async function main() {
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, url_origen')
        .order('nombre')
    if (error) { console.error('Error:', error.message); process.exit(1) }

    let pendientes = 0, conUrl = 0, sinUrl = 0
    const conUrlList = []
    const sinUrlList = []
    let conUrlConOg = 0
    let conUrlSinOg = 0

    for (const r of recetas) {
        const slug = n2s(r.nombre)
        if (fluxSlugs.has(slug) && !aiGenSlugs.has(slug)) {
            pendientes++
            if (r.url_origen) {
                conUrl++
                const tieneOg = ogImageSlugs.has(slug)
                if (tieneOg) conUrlConOg++
                else conUrlSinOg++
                conUrlList.push({ nombre: r.nombre, url: r.url_origen, slug, tieneOg })
                console.log(`  ${tieneOg ? '✅' : '⬜'} ${r.nombre}`)
                if (!tieneOg) console.log(`       URL: ${r.url_origen}`)
            } else {
                sinUrl++
                sinUrlList.push({ nombre: r.nombre, slug })
            }
        }
    }

    console.log('\n═══════════════════════════════════════')
    console.log('  Pendientes total:          ' + pendientes)
    console.log('  Con url_origen:            ' + conUrl)
    console.log('    ├ Con og_image en disco: ' + conUrlConOg)
    console.log('    └ Sin og_image en disco: ' + conUrlSinOg + ' (descargar de Instagram)')
    console.log('  Sin url_origen:            ' + sinUrl + ' (flux_txt2img como base)')
    console.log('═══════════════════════════════════════\n')

    if (conUrlSinOg > 0) {
        console.log('Recetas que necesitan descargar og_image de Instagram:')
        for (const r of conUrlList) {
            if (!r.tieneOg) {
                console.log(`  - ${r.nombre}`)
                console.log(`    ${r.url}`)
            }
        }
    }

    console.log('\nPara continuar:')
    console.log('  1. node scripts/regenerar-flux-masivo.mjs --obtener-og  (descargar og_image desde url_origen)')
    console.log('  2. node scripts/regenerar-flux-masivo.mjs --genera     (GPT-4o image edit)')
    console.log('  3. node scripts/subir-imagenes-aprobadas.mjs --forzar  (subir a Supabase)')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

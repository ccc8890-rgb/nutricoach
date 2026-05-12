/**
 * revisar-recetas-sin-imagen.mjs
 *
 * Muestra las recetas que aún no tienen imagen en Supabase,
 * clasificadas por si tienen fuente_url (extraíble) o no (requieren IA).
 *
 * USO: node scripts/revisar-recetas-sin-imagen.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// Cargar .env.local
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

const { data: recetas, error } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, fuente, fuente_tipo')
    .is('imagen_url', null)
    .order('nombre')

if (error) { console.error('Error:', error); process.exit(1) }

console.log(`\n╔══════════════════════════════════════════════╗`)
console.log(`║   ${String(recetas.length).padStart(3)} RECETAS SIN IMAGEN EN SUPABASE`)
console.log(`╚══════════════════════════════════════════════╝\n`)

const conFuente = recetas.filter(r => r.url_origen)
const sinFuente = recetas.filter(r => !r.url_origen)

// ── Con url_origen (extraíbles) ──
console.log(`🔗  CON URL_ORIGEN — Extraíble vía Playwright/AgentBrowser (${conFuente.length})\n`)
console.log(`   ${'#'.padStart(2)} | ${'Receta'.padEnd(45)} | Fuente`)
console.log(`   ${'─'.repeat(2)}-├─${'─'.repeat(45)}-├─${'─'.repeat(40)}`)
conFuente.forEach((r, i) => {
    const dominio = r.url_origen ? new URL(r.url_origen).hostname.replace('www.', '') : '—'
    console.log(`   ${String(i + 1).padStart(2)} | ${r.nombre.padEnd(45)} | ${dominio}`)
})

// ── Sin fuente_url ──
console.log(`\n\n❌  SIN URL_ORIGEN — Requieren generación (${sinFuente.length})\n`)
sinFuente.forEach((r, i) => {
    console.log(`   ${String(i + 1).padStart(2)}. ${r.nombre}`)
})

console.log(`\n${'═'.repeat(60)}`)
console.log(`   TOTAL: ${recetas.length} | Con URL: ${conFuente.length} | Sin URL: ${sinFuente.length}`)
console.log(`${'═'.repeat(60)}\n`)

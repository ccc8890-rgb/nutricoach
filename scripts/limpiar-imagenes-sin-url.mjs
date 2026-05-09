/**
 * limpiar-imagenes-sin-url.mjs
 *
 * Borra imagen_url de las 19 recetas que no tienen url_origen.
 * Estas tienen imágenes IA feas (flux_txt2img) en Supabase Storage.
 *
 * USO:
 *   node scripts/limpiar-imagenes-sin-url.mjs           → preview de recetas afectadas
 *   node scripts/limpiar-imagenes-sin-url.mjs --apply   → aplica el borrado
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = val
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const APPLY = process.argv.includes('--apply')

async function main() {
    // Recetas sin url_origen pero con imagen_url
    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, imagen_url, url_origen')
        .is('url_origen', null)
        .not('imagen_url', 'is', null)

    if (error) {
        console.error('Error al consultar:', error.message)
        process.exit(1)
    }

    if (!recetas || recetas.length === 0) {
        console.log('✅ No hay recetas sin URL con imagen_url. Nada que limpiar.')
        return
    }

    console.log(`\n🔍 Recetas sin url_origen con imagen_url asignada: ${recetas.length}\n`)
    recetas.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.nombre}`)
        console.log(`     imagen_url: ${r.imagen_url?.slice(0, 70)}...`)
    })

    if (!APPLY) {
        console.log(`\n⚠️  Preview. Para aplicar: node scripts/limpiar-imagenes-sin-url.mjs --apply`)
        return
    }

    // Aplicar: poner imagen_url = null
    const ids = recetas.map(r => r.id)
    const { error: updateError } = await supabase
        .from('recetas')
        .update({ imagen_url: null })
        .in('id', ids)

    if (updateError) {
        console.error('Error al actualizar:', updateError.message)
        process.exit(1)
    }

    console.log(`\n✅ ${recetas.length} recetas limpiadas — imagen_url → null`)
    console.log('   Las recetas quedan sin imagen hasta que tengan url_origen real.')
}

main().catch(e => { console.error(e); process.exit(1) })

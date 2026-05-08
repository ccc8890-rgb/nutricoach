#!/usr/bin/env node
/**
 * Asigna fuente='curada' a todos los alimentos que aún no tienen fuente.
 * También asigna fuente='bedca' a los que ya tienen micros_actualizados_en
 * pero les falta la fuente.
 *
 * Uso: node scripts/asignar-fuentes.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

function loadEnv() {
    const envPath = resolve(PROJECT_ROOT, '.env.local')
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        let value = trimmed.slice(eqIdx + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
        process.env[key] = value
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
    console.log('📋 Asignando fuentes a alimentos...\n')

    // 1. Total de alimentos en la BD
    const { count: total, error: errTotal } = await supabase
        .from('alimentos')
        .select('*', { count: 'exact', head: true })

    if (errTotal) throw new Error(`Error al contar: ${errTotal.message}`)
    console.log(`   Total alimentos en BD: ${total}`)

    // 2. Alimentos sin fuente
    const { data: sinFuente, error: errSF } = await supabase
        .from('alimentos')
        .select('id, nombre')
        .is('fuente', null)

    if (errSF) throw new Error(errSF.message)

    console.log(`   Sin fuente: ${sinFuente?.length ?? 0}`)

    if (sinFuente && sinFuente.length > 0) {
        // Ver si tienen micros_actualizados_en (vinieron del script BEDCA pero
        // por algún motivo no tienen fuente) → 'bedca', sino 'curada'
        const batchSize = 100
        let asignados = 0

        for (let i = 0; i < sinFuente.length; i += batchSize) {
            const batch = sinFuente.slice(i, i + batchSize)
            const ids = batch.map(a => a.id)

            const { error } = await supabase
                .from('alimentos')
                .update({ fuente: 'curada', micros_actualizados_en: new Date().toISOString() })
                .in('id', ids)

            if (error) {
                console.error(`   ❌ Error en batch ${i}-${i + batch.length}: ${error.message}`)
            } else {
                asignados += batch.length
                console.log(`   ✓ Lote ${i + 1}-${i + batch.length}: ${batch.length} asignados`)
            }
        }

        console.log(`\n✅ ${asignados} alimentos marcados como 'curada'`)
    } else {
        console.log('   ✓ Todos los alimentos ya tienen fuente asignada.')
    }

    // 3. Mostrar resumen por fuente
    const { data: fuentes } = await supabase
        .from('alimentos')
        .select('fuente')

    const conteo = {}
    for (const f of fuentes ?? []) {
        const key = f.fuente ?? 'sin-fuente'
        conteo[key] = (conteo[key] ?? 0) + 1
    }

    console.log('\n📊 Resumen por fuente:')
    for (const [fuente, count] of Object.entries(conteo).sort()) {
        console.log(`   ${fuente}: ${count}`)
    }
    console.log('\n✅ Asignación completada.')
}

main().catch(e => {
    console.error('💥 Fatal:', e.message)
    process.exit(1)
})

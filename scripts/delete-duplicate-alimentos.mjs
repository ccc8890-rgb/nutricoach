/**
 * Script para eliminar 127 filas duplicadas de alimentos
 * (las que tienen created_at = '2026-04-28 15:09:24.200174+00')
 * 
 * PRE-REQUISITO: Ya se ejecutó el UPDATE que redirigió las 333 referencias
 * de receta_ingredientes desde IDs duplicados hacia IDs originales.
 * 
 * USO: node scripts/delete-duplicate-alimentos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Leer .env.local
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Faltan variables de entorno (NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
})

const CREATED_AT_DUPLICADO = '2026-04-28 15:09:24.200174+00'

async function main() {
    console.log('🔍 Verificando duplicados antes del DELETE...')

    // 1. Contar cuántas referencias a duplicados existen todavía
    const { count: refsRestantes, error: errRefs } = await supabase
        .from('receta_ingredientes')
        .select('id', { count: 'exact', head: true })
        .eq('alimento.created_at', CREATED_AT_DUPLICADO)

    if (errRefs) {
        // Intentar de otra manera: contar por alimento_id IN subquery
        console.log('  Intentando conteo alternativo...')
        const { data: duplicados, error: errDups } = await supabase
            .from('alimentos')
            .select('id')
            .eq('created_at', CREATED_AT_DUPLICADO)

        if (errDups) {
            console.error('❌ Error al consultar duplicados:', errDups.message)
            process.exit(1)
        }

        if (!duplicados || duplicados.length === 0) {
            console.log('✅ No hay duplicados para eliminar (ya fueron eliminados o no existen)')
            process.exit(0)
        }

        const ids = duplicados.map(d => d.id)

        const { count: refs, error: errRefs2 } = await supabase
            .from('receta_ingredientes')
            .select('id', { count: 'exact', head: true })
            .in('alimento_id', ids)

        if (errRefs2) {
            console.error('❌ Error al contar referencias:', errRefs2.message)
            process.exit(1)
        }

        console.log(`  Referencias restantes a duplicados: ${refs}`)
        if (refs && refs > 0) {
            console.error('❌ Todavía hay referencias a duplicados. NO se puede eliminar.')
            console.error('   Ejecuta primero el UPDATE de repointing.')
            process.exit(1)
        }

        console.log('  ✅ 0 referencias — seguro eliminar')

        // 2. Eliminar duplicados vía REST API DELETE
        console.log(`\n🗑️  Eliminando ${duplicados.length} filas duplicadas...`)
        const { error: delError } = await supabase
            .from('alimentos')
            .delete()
            .in('id', ids)

        if (delError) {
            console.error('❌ Error al eliminar:', delError.message)
            process.exit(1)
        }
        console.log(`✅ ${duplicados.length} duplicados eliminados correctamente!`)
    } else {
        console.log(`  Referencias restantes a duplicados: ${refsRestantes}`)
        if (refsRestantes && refsRestantes > 0) {
            console.error('❌ Todavía hay referencias a duplicados. NO se puede eliminar.')
            process.exit(1)
        }

        console.log('  ✅ 0 referencias — seguro eliminar')

        // 2. Eliminar duplicados
        console.log(`\n🗑️  Eliminando duplicados con created_at = '${CREATED_AT_DUPLICADO}'...`)
        const { error: delError } = await supabase
            .from('alimentos')
            .delete()
            .eq('created_at', CREATED_AT_DUPLICADO)

        if (delError) {
            console.error('❌ Error al eliminar:', delError.message)
            process.exit(1)
        }
        console.log('✅ Duplicados eliminados correctamente!')
    }

    // 3. Verificar
    console.log('\n🔍 Verificando resultado...')
    const { data: restantes, error: errRest } = await supabase
        .from('alimentos')
        .select('id, nombre, created_at::text')
        .eq('created_at', CREATED_AT_DUPLICADO)

    if (errRest) {
        console.error('  Error al verificar:', errRest.message)
    } else {
        console.log(`  Filas restantes con esa fecha: ${restantes?.length ?? 0}`)
        if (restantes?.length === 0) {
            console.log('✅ Todos los duplicados eliminados correctamente!')
        } else {
            console.log('⚠️  Quedaron algunas filas:')
            restantes?.forEach(r => console.log(`   - ${r.id}: ${r.nombre}`))
        }
    }

    // 4. Mostrar total actual
    const { count: total, error: errTotal } = await supabase
        .from('alimentos')
        .select('id', { count: 'exact', head: true })

    if (!errTotal) {
        console.log(`\n📊 Total actual de alimentos: ${total}`)
    }
}

main().catch(err => {
    console.error('❌ Error inesperado:', err)
    process.exit(1)
})

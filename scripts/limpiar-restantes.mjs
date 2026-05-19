#!/usr/bin/env node
/**
 * SEGUNDA PASADA — eliminar lo que quedó por errores FK
 *
 * La primera ejecución falló en algunos batches porque no verificaba
 * comida_alimentos. Ahora que ya se eliminaron no-alimentos + alcohol
 * con referencias, los restantes deben tener refs=0.
 *
 * USO: node scripts/limpiar-restantes.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envPath = resolve(process.cwd(), '.env.local')
const envRaw = readFileSync(envPath, 'utf-8')
for (const line of envRaw.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const DRY_RUN = process.argv.includes('--dry-run')

async function fetchAll(table, select, condition) {
    const todos = []
    let from = 0
    const pageSize = 1000
    while (true) {
        let q = supabase.from(table).select(select).range(from, from + pageSize - 1).order('id')
        if (condition) q = q.or(condition)
        const { data, error } = await q
        if (error) throw error
        if (!data || data.length === 0) break
        todos.push(...data)
        if (data.length < pageSize) break
        from += pageSize
    }
    return todos
}

async function getRefsCount(alimentoId) {
    const tables = ['receta_ingredientes', 'comida_alimentos', 'productos_supermercado']
    let total = 0
    for (const t of tables) {
        const { count } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('alimento_id', alimentoId)
        total += count ?? 0
    }
    return total
}

async function main() {
    console.log('══════════════════════════════════════════')
    console.log('  SEGUNDA PASADA — restantes post-limpieza')
    console.log(`  Modo: ${DRY_RUN ? '🔍 DRY-RUN' : '⚡ REAL'}`)
    console.log('══════════════════════════════════════════\n')

    // 1. Supermercado/Mercadona/Sin clasificar con 0 kcal
    const basura = await fetchAll('alimentos', 'id, nombre, categoria, calorias', 'calorias.is.null,calorias.eq.0')
    const enSuper = basura.filter(a =>
        a.categoria === 'Supermercado' || a.categoria === 'Supermercado - Sin clasificar' || a.categoria === 'Mercadona'
    )

    console.log(`📊 Supermercado/Mercadona con 0 kcal: ${enSuper.length}`)

    // Verificar referencias
    const seguros = []
    const conRefs = []
    for (const a of enSuper) {
        const refs = await getRefsCount(a.id)
        if (refs === 0) {
            seguros.push(a)
        } else {
            conRefs.push({ ...a, refs })
        }
    }

    console.log(`   Seguros (refs=0): ${seguros.length}`)
    if (conRefs.length > 0) {
        console.log(`   Con referencias: ${conRefs.length}`)
        conRefs.forEach(a => console.log(`     "${a.nombre}" (${a.refs} refs)`))
    }

    if (DRY_RUN) {
        if (seguros.length > 0) {
            console.log('\n   A eliminar:')
            seguros.forEach(a => console.log(`     [${a.categoria}] ${a.nombre} (${a.calorias ?? 0} kcal)`))
        }
        console.log('\n🔍 DRY-RUN — no se ejecutaron cambios')
        return
    }

    // Ejecutar
    if (seguros.length > 0) {
        console.log(`\n⏳ Eliminando ${seguros.length}...`)
        const ids = seguros.map(a => a.id)
        for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200)
            await supabase.from('productos_supermercado').delete().in('alimento_id', chunk)
            const { error } = await supabase.from('alimentos').delete().in('id', chunk)
            if (error) console.error(`   Error batch ${i}: ${error.message}`)
            else process.stdout.write('.')
        }
        console.log(`\n   ✅ ${seguros.length} eliminados`)
    }

    // Stats finales
    const { count } = await supabase.from('alimentos').select('id', { count: 'exact', head: true })
    console.log(`📊 Total en BD ahora: ${count}`)
}

main().catch(err => {
    console.error('❌ Error:', err.message)
    process.exit(1)
})

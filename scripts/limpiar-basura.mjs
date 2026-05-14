#!/usr/bin/env node
/**
 * limpiar-basura.mjs
 *
 * Elimina items de categorías NO alimento de la tabla alimentos.
 * Solo elimina aquellos que NO están referenciados en receta_ingredientes.
 * Ejecuta en modo dry-run por defecto. Usar --apply para ejecutar.
 *
 * USO: node scripts/limpiar-basura.mjs [--apply]
 */
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')
const APPLY = process.argv.includes('--apply')

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
        if (!process.env[key]) process.env[key] = value
    }
}
loadEnv()

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const headers = {
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
}

/** Fetch all rows from a table with pagination */
async function fetchAll(table, select = '*', filter = '') {
    const pageSize = 1000
    let all = []
    let from = 0
    while (true) {
        const res = await fetch(`${SB_URL}/rest/v1/${table}?select=${select}${filter}`, {
            headers: { ...headers, 'Range': `${from}-${from + pageSize - 1}`, 'Prefer': 'count=exact' }
        })
        if (!res.ok) {
            if (res.status === 416) break // range not satisfiable = no more data
            throw new Error(`Error fetching ${table}: ${res.status} ${await res.text()}`)
        }
        const data = await res.json()
        if (!data || !data.length) break
        all = all.concat(data)
        if (data.length < pageSize) break // last page
        from += pageSize
    }
    return all
}

/** Delete a row */
async function del(table, id) {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { ...headers, 'Prefer': 'return=representation' }
    })
    if (!res.ok) throw new Error(`Error deleting ${id}: ${res.status} ${await res.text()}`)
    return res.json()
}

async function main() {
    console.log('════════════════════════════════════════════')
    console.log('   LIMPIEZA DE BASURA EN ALIMENTOS')
    console.log('   Modo: ' + (APPLY ? '🔥 APLICANDO CAMBIOS' : '👁️  Dry-run (usa --apply para ejecutar)'))
    console.log('════════════════════════════════════════════\n')

    // Categorías consideradas NO alimento
    const CATEGORIAS_BASURA = [
        'pañal', 'toallitas', 'limpieza', 'cápsulas', 'accesorios',
        'braguita', 'lotes hombre', 'monodosis', 'chicles', 'caramelos'
    ]

    // 1. Fetch ALL alimentos (with pagination)
    const allAlimentos = await fetchAll('alimentos', 'id,nombre,categoria,calorias')
    console.log(`📦 Total alimentos en BD: ${allAlimentos.length}\n`)

    // 2. Filter basura
    const basura = allAlimentos.filter(a =>
        a.categoria && CATEGORIAS_BASURA.some(c => a.categoria.toLowerCase().includes(c))
    )

    console.log(`🗑️  Items basura detectados: ${basura.length}`)
    console.log('')

    // Group by category
    const byCat = {}
    for (const b of basura) {
        if (!byCat[b.categoria]) byCat[b.categoria] = []
        byCat[b.categoria].push(b)
    }

    for (const [cat, items] of Object.entries(byCat).sort()) {
        console.log(`  ${cat} (${items.length}):`)
        items.forEach(b => console.log(`    - ${b.nombre} [${b.id.slice(0, 8)}...]`))
    }

    // 3. Check which are used in receta_ingredientes
    console.log('\n🔍 Verificando uso en recetas...')

    let usedCount = 0
    let notUsedCount = 0
    const used = []
    const notUsed = []

    // Fetch all receta_ingredientes that reference these alimentos
    const basuraIds = basura.map(b => b.id)
    const allRI = await fetchAll('receta_ingredientes', 'id,alimento_id,receta_id', '&alimento_id=in.(' + basuraIds.join(',') + ')')

    const usedIds = new Set(allRI.map(ri => ri.alimento_id))

    for (const b of basura) {
        if (usedIds.has(b.id)) {
            usedCount++
            used.push(b)
        } else {
            notUsedCount++
            notUsed.push(b)
        }
    }

    console.log(`\n📊 Resultados:`)
    console.log(`  ✅ NO usados en recetas (candidatos a eliminar): ${notUsedCount}`)
    console.log(`  ⚠️  SÍ usados en recetas (NO eliminar): ${usedCount}`)

    if (used.length > 0) {
        console.log('\n  ⚠️  Items basura que SÍ están en recetas:')
        for (const b of used) {
            const recetasIds = [...new Set(allRI.filter(ri => ri.alimento_id === b.id).map(ri => ri.receta_id))]
            console.log(`    - "${b.nombre}" (${b.categoria}) — usado en ${recetasIds.length} receta(s)`)
        }
    }

    // 4. Execute deletions
    if (!APPLY) {
        console.log('\n👁️  Dry-run completo. Usa --apply para eliminar.')
        return
    }

    console.log('\n🔥 EJECUTANDO ELIMINACIONES...')
    let deleted = 0
    let errors = 0

    for (const b of notUsed) {
        try {
            await del('alimentos', b.id)
            console.log(`  ✅ Eliminado: ${b.nombre} (${b.categoria})`)
            deleted++
        } catch (e) {
            console.error(`  ❌ Error eliminando ${b.nombre}: ${e.message}`)
            errors++
        }
    }

    console.log('\n════════════════════════════════════════════')
    console.log('   RESULTADO FINAL')
    console.log('════════════════════════════════════════════')
    console.log(`  Eliminados: ${deleted}`)
    console.log(`  Errores:    ${errors}`)
    console.log(`  Conservados (usados en recetas): ${usedCount}`)
    console.log('════════════════════════════════════════════')
}

main().catch(err => { console.error(err); process.exit(1) })

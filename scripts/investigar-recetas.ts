/**
 * INVESTIGA recetas con ingredientes pero sin url_origen válida
 * y recetas con url_origen no parseable
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) return
    const content = fs.readFileSync(envPath, 'utf-8')
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
loadEnvLocal()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
    // 1. Recetas SIN ingredientes en receta_ingredientes
    const { data: recetas } = await supabase.from('recetas').select('id, nombre, kcal, proteinas, carbohidratos, grasas, url_origen, categoria, dificultad')
    if (!recetas) return

    const { data: ings } = await supabase.from('receta_ingredientes').select('receta_id')
    const idsConIng = new Set(ings?.map(i => i.receta_id) || [])

    const sinIng = recetas.filter(r => !idsConIng.has(r.id))

    console.log('══════════════════════════════════════════════')
    console.log('  80 RECETAS SIN INGREDIENTES')
    console.log('══════════════════════════════════════════════\n')

    console.log(`Total: ${sinIng.length} recetas\n`)

    // Ver si tienen url_origen para posible backfill
    const conUrl = sinIng.filter(r => r.url_origen)
    const sinUrl = sinIng.filter(r => !r.url_origen)
    console.log(`  Con url_origen: ${conUrl.length} (candidatas a backfill)`)
    console.log(`  Sin url_origen: ${sinUrl.length}\n`)

    // Agrupar por categoría
    const cats: Record<string, number> = {}
    sinIng.forEach(r => {
        const c = r.categoria || 'sin'
        cats[c] = (cats[c] || 0) + 1
    })
    console.log('  Por categoría:')
    Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => {
        console.log(`    ${c.padEnd(15)} ${n}`)
    })

    console.log('\n  Lista completa:')
    sinIng.forEach((r, i) => {
        const kcal = r.kcal ? `${Math.round(r.kcal)}kcal` : '?kcal'
        const p = r.proteinas ? `${Math.round(r.proteinas)}gP` : ''
        console.log(`  ${String(i + 1).padStart(2)}. ${kcal.padEnd(12)} ${p.padEnd(10)} ${r.nombre.substring(0, 50)}`)
    })

    // 2. Recetas con url_origen no-http (existen pero no son URLs)
    console.log('\n══════════════════════════════════════════════')
    console.log('  URLs NO PARSEABLES')
    console.log('══════════════════════════════════════════════\n')

    const urlRaras = recetas.filter(r => {
        if (!r.url_origen) return false
        try {
            new URL(r.url_origen)
            return false
        } catch {
            return true
        }
    })

    console.log(`Total: ${urlRaras.length} recetas\n`)

    // Agrupar por valor
    const grupos: Record<string, { count: number, ejemplos: string[] }> = {}
    urlRaras.forEach(r => {
        const val = r.url_origen || ''
        if (!grupos[val]) grupos[val] = { count: 0, ejemplos: [] }
        grupos[val].count++
        if (grupos[val].ejemplos.length < 3) grupos[val].ejemplos.push(r.nombre)
    })

    Object.entries(grupos).sort((a, b) => b[1].count - a[1].count).forEach(([val, info]) => {
        console.log(`  [${info.count}x] "${val.substring(0, 80)}"`)
        info.ejemplos.forEach(n => console.log(`    → ${n}`))
    })
}

main().catch(console.error)

// scripts/scrapear-supermercados.ts
// Uso: npx tsx scripts/scrapear-supermercados.ts [slug1 slug2 ...]
// Sin args: ejecuta todos los disponibles (mercadona, carrefour, consum, lidl, alcampo, dia, eroski)
// Con args: solo los slugs indicados, ej: npx tsx scripts/scrapear-supermercados.ts carrefour lidl

import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'
import { scrapearSupermercado, SLUGS_SCRAPERS_DISPONIBLES } from '../lib/scraping/index'

// Cargar .env.local si dotenv no lo carga automáticamente
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const idx = trimmed.indexOf('=')
        if (idx < 0) continue
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        if (!process.env[key]) process.env[key] = val
    }
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

async function main() {
    // Determinar qué slugs ejecutar
    const slugsArg = process.argv.slice(2).filter(s => !s.startsWith('--'))
    const slugsObjetivo = slugsArg.length > 0 ? slugsArg : SLUGS_SCRAPERS_DISPONIBLES

    console.log(`\n🛒 Scraper multi-supermercado NutriCoach`)
    console.log(`Slugs a scrapear: ${slugsObjetivo.join(', ')}\n`)

    // Obtener IDs de supermercados desde la BD
    const { data: supermercados, error } = await supabase
        .from('supermercados')
        .select('id, nombre, slug')
        .in('slug', slugsObjetivo)
        .eq('activo', true)

    if (error || !supermercados?.length) {
        console.error('❌ Error obteniendo supermercados:', error?.message || 'sin resultados')
        process.exit(1)
    }

    // Filtrar solo los que tienen scraper
    const paraEjecutar = supermercados.filter(sm => SLUGS_SCRAPERS_DISPONIBLES.includes(sm.slug))
    const sinScraper = slugsObjetivo.filter(s => !SLUGS_SCRAPERS_DISPONIBLES.includes(s))
    if (sinScraper.length) console.log(`⚠️  Sin scraper implementado: ${sinScraper.join(', ')}\n`)

    let totalProductos = 0
    const resultados: Array<{ nombre: string; productos: number; nuevos: number; actualizados: number; errores: number; duracion: string }> = []

    for (const sm of paraEjecutar) {
        const inicio = Date.now()
        console.log(`━━━ ${sm.nombre} ━━━`)
        try {
            const res = await scrapearSupermercado(sm.id, sm.slug, supabase)
            const duracionSeg = ((Date.now() - inicio) / 1000).toFixed(1)
            console.log(`  ✅ ${res.total_procesados} productos | +${res.nuevos_productos} nuevos | ↻ ${res.actualizados} act. | ❌ ${res.errores.length} errores | ${duracionSeg}s`)
            if (res.errores.length > 0 && res.errores.length <= 5) {
                res.errores.forEach(e => console.log(`     ⚠️  ${e}`))
            }
            totalProductos += res.total_procesados
            resultados.push({
                nombre: sm.nombre,
                productos: res.total_procesados,
                nuevos: res.nuevos_productos,
                actualizados: res.actualizados,
                errores: res.errores.length,
                duracion: `${duracionSeg}s`,
            })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.log(`  ❌ Error inesperado: ${msg}`)
            resultados.push({ nombre: sm.nombre, productos: 0, nuevos: 0, actualizados: 0, errores: 1, duracion: '-' })
        }
        console.log()
    }

    // Resumen final
    console.log('═══════════════════════════════════════')
    console.log('📊 Resumen final:')
    for (const r of resultados) {
        console.log(`  ${r.nombre.padEnd(15)} ${String(r.productos).padStart(5)} productos | +${r.nuevos} nuevos | ${r.duracion}`)
    }
    console.log(`\n  TOTAL: ${totalProductos} productos procesados`)
    console.log('═══════════════════════════════════════\n')
}

main().catch(err => { console.error(err); process.exit(1) })

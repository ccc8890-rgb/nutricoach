/**
 * DIAGNÓSTICO COMPLETO DEL RECETARIO
 * 
 * Uso: npx tsx scripts/diagnostic-recetario.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Cargar .env.local manualmente (igual que backfill-recetas.ts)
function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.warn('⚠️  No se encontró .env.local.')
        return
    }
    const content = fs.readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
            process.env[key] = value
        }
    }
}
loadEnvLocal()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Receta {
    id: number
    nombre: string
    instrucciones: string | null
    url_origen: string | null
    descripcion: string | null
    imagen_url: string | null
    porciones: number | null
    tiempo_prep_min: number | null
    tiempo_coccion_min: number | null
    created_at: string | null
}

async function diagnostic() {
    // ─── 1. TOTALES ────────────────────────────────────
    const { count: total } = await supabase
        .from('recetas')
        .select('*', { count: 'exact', head: true })

    console.log('══════════════════════════════════════════════')
    console.log('  DIAGNÓSTICO COMPLETO DEL RECETARIO')
    console.log('══════════════════════════════════════════════\n')

    console.log(`📊 TOTAL RECETAS: ${total}\n`)

    // ─── 2. INSTRUCCIONES ────────────────────────────
    const { data: todas } = await supabase
        .from('recetas')
        .select('id, nombre, instrucciones, url_origen, descripcion, porciones')

    if (!todas) { console.error('No se pudieron cargar recetas'); return }

    const nullVacio = todas.filter(r => !r.instrucciones || r.instrucciones.trim() === '')
    const unaPalabra = todas.filter(r => {
        const t = r.instrucciones?.trim() || ''
        return t.length > 0 && t.length < 30 && !t.includes(' ')
    })
    const cortas = todas.filter(r => {
        const t = r.instrucciones?.trim() || ''
        return t.length > 0 && t.length < 100 && t.includes(' ')
    })
    const correctas = todas.filter(r => (r.instrucciones?.trim().length || 0) >= 100)

    console.log(`📝 INSTRUCCIONES:`)
    console.log(`   ✅ Correctas (>=100 chars): ${correctas.length}`)
    console.log(`   ⚠️  Cortas (<100 chars):    ${cortas.length}`)
    console.log(`   ❌ 1 palabra (<30 chars):   ${unaPalabra.length}`)
    console.log(`   ❌ Null/vacías:             ${nullVacio.length}`)

    if (unaPalabra.length > 0) {
        console.log(`\n   ── Recetas con 1 palabra ──`)
        unaPalabra.forEach(r => console.log(`   ${r.id} | "${r.instrucciones?.trim()}" | ${r.nombre}`))
    }
    if (cortas.length > 0) {
        console.log(`\n   ── Recetas con instrucciones cortas ──`)
        cortas.forEach(r => console.log(`   ${r.id} | "${r.instrucciones?.trim().substring(0, 80)}..." | ${r.nombre}`))
    }

    // ─── 3. URL_ORIGEN ────────────────────────────────
    const conUrl = todas.filter(r => r.url_origen?.startsWith('http') ?? false)
    const noUrl = todas.filter(r => r.url_origen && !r.url_origen.startsWith('http'))
    const sinUrl = todas.filter(r => !r.url_origen)

    console.log(`\n📎 URL_ORIGEN:`)
    console.log(`   ✅ URL válida (http*):      ${conUrl.length}`)
    console.log(`   ❌ No es URL:               ${noUrl.length}`)
    console.log(`   ❌ Sin url_origen:           ${sinUrl.length}`)

    if (noUrl.length > 0) {
        console.log(`\n   ── Valores NO URL en url_origen ──`)
        // Agrupar por tipo
        const tipos = new Map<string, number>()
        noUrl.forEach(r => {
            const val = r.url_origen || ''
            const tipo = esNumero(val) ? 'NÚMERO'
                : esMetodoCoccion(val) ? 'MÉTODO_COCCIÓN'
                    : val.length > 20 ? 'TEXTO_LARGO' : 'OTRO'
            const key = `${tipo}: ${val}`
            tipos.set(key, (tipos.get(key) || 0) + 1)
        })
        for (const [key, count] of tipos) {
            console.log(`   [${count}x] ${key}`)
        }
        console.log(`\n   ── Detalle ──`)
        noUrl.forEach(r => console.log(`   ${r.id} | "${r.url_origen}" | ${r.nombre}`))
    }

    // ─── 4. RECETAS COMPLETAS (URL + INSTRUCCIONES) ──
    const completas = conUrl.filter(r => (r.instrucciones?.trim().length || 0) >= 100)
    const incompletasConUrl = conUrl.filter(r => !((r.instrucciones?.trim().length || 0) >= 100))

    console.log(`\n🎯 RECETAS COMPLETAS (URL + instrucciones): ${completas.length}/${conUrl.length}`)

    if (incompletasConUrl.length > 0) {
        console.log(`\n   ── RECETAS CON URL VÁLIDA PERO INSTRUCCIONES INCOMPLETAS ──`)
        console.log(`   (CANDIDATAS PARA BACKFILL)`)
        incompletasConUrl.forEach(r => {
            const instr = r.instrucciones?.trim() || '(null)'
            console.log(`   ${r.id} | instr: "${instr.substring(0, 40)}" | ${r.url_origen?.substring(0, 80)} | ${r.nombre}`)
        })
    }

    // ─── 5. INGREDIENTES ──────────────────────────────
    const { count: totalIng } = await supabase
        .from('receta_ingredientes')
        .select('*', { count: 'exact', head: true })

    const { data: recetasIng } = await supabase
        .from('receta_ingredientes')
        .select('receta_id')

    const idsConIng = new Set(recetasIng?.map(r => r.receta_id) || [])
    const sinIng = todas.filter(r => !idsConIng.has(r.id))

    console.log(`\n🥗 INGREDIENTES:`)
    console.log(`   Total filas en receta_ingredientes: ${totalIng}`)
    console.log(`   Recetas CON ingredientes: ${idsConIng.size}`)
    console.log(`   Recetas SIN ingredientes: ${sinIng.length}`)

    if (sinIng.length > 0) {
        console.log(`\n   ── Recetas sin ingredientes ──`)
        sinIng.forEach(r => console.log(`   ${r.id} | ${r.nombre}`))
    }

    // ─── 6. MACROS ───────────────────────────────────
    // Ver cuántas recetas tienen macros calculadas (porciones > 0 y macros en ingredientes)
    console.log(`\n📊 MACROS:`)
    const conPorciones = todas.filter(r => r.porciones && r.porciones > 0)
    console.log(`   Recetas con porciones: ${conPorciones.length}`)

    // ─── 7. FECHA DE CREACIÓN ────────────────────────
    const { data: fechas } = await supabase
        .from('recetas')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(5)
    if (fechas && fechas.length > 0) {
        console.log(`\n🗓️  Últimas 5 recetas creadas:`)
        fechas.forEach(f => console.log(`   ${f.created_at}`))
    }

    // ─── 8. RESUMEN ──────────────────────────────────
    console.log(`\n══════════════════════════════════════════════`)
    console.log('  RESUMEN')
    console.log('══════════════════════════════════════════════')
    console.log(`  Total recetas:                        ${total}`)
    console.log(`  Instrucciones correctas:              ${correctas.length}`)
    console.log(`  Instrucciones cortas:                 ${cortas.length}`)
    console.log(`  Instrucciones 1 palabra:              ${unaPalabra.length}`)
    console.log(`  Instrucciones null/vacías:            ${nullVacio.length}`)
    console.log(`  Con URL válida:                       ${conUrl.length}`)
    console.log(`  Con URL + instrucciones OK:           ${completas.length}`)
    console.log(`  Con URL pero instrucciones MAL:       ${incompletasConUrl.length}`)
    console.log(`  Sin URL (url_origen no-URL):          ${noUrl.length}`)
    console.log(`  Sin url_origen:                        ${sinUrl.length}`)
    console.log(`  Con ingredientes:                     ${idsConIng.size}`)
    console.log(`  Sin ingredientes:                     ${sinIng.length}`)
    console.log('══════════════════════════════════════════════')
}

function esNumero(v: string): boolean {
    return /^\d+(\.\d+)?$/.test(v.trim())
}

function esMetodoCoccion(v: string): boolean {
    const metodos = [
        'horno', 'microondas', 'sartén', 'sarten', 'wok', 'plancha', 'parrilla',
        'oll', 'air fryer', 'freidora', 'vapor', 'hervir', 'cocer', 'asar',
        'no bake', 'sin horno', 'frío', 'frio', 'nevera', 'congelador',
        'mealprep', 'tupper'
    ]
    const lower = v.toLowerCase().trim()
    return metodos.some(m => lower.includes(m) || lower === m)
}

diagnostic().catch(err => {
    console.error('Error:', err)
    process.exit(1)
})

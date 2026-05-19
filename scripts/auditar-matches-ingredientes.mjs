/**
 * auditar-matches-ingredientes.mjs
 *
 * Auditoría read-only de matches entre receta_ingredientes.nombre_libre y alimentos.nombre.
 * Detecta coincidencias sospechosas (que no comparten palabras significativas).
 *
 * USO:
 *   node scripts/auditar-matches-ingredientes.mjs              # últimas 100 recetas
 *   node scripts/auditar-matches-ingredientes.mjs --todas      # todas las recetas
 *   node scripts/auditar-matches-ingredientes.mjs --json       # salida JSON
 *   node scripts/auditar-matches-ingredientes.mjs --limite=50  # últimas N recetas
 *
 * OUTPUT: salidas/auditoria-matches-YYYY-MM-DD.json
 * NO modifica la base de datos. Solo genera un informe para revisión manual.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

// ── Cargar .env.local ─────────────────────────────────────────────
const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) {
    console.error('❌ No se encuentra .env.local')
    process.exit(1)
}
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
    const [key, ...rest] = line.split('=')
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

// ── Config ────────────────────────────────────────────────────────
const GENERICAS = new Set([
    'pasta', 'caldo', 'crema', 'salsa', 'harina', 'aceite',
    'queso', 'leche', 'pan', 'agua', 'azucar', 'sal',
    'polvo', 'fresco', 'natural', 'preparado', 'mezcla',
    'bebida', 'zumo', 'base', 'pure', 'copos', 'extracto',
    'liquido', 'líquido', 'deshidratado', 'polvo', 'liofilizado',
])

function normalizar(s) {
    return s.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '').trim()
}

function esMatchSospechoso(nombreLibre, nombreAlimento) {
    const palabrasLibre = normalizar(nombreLibre)
        .split(/\s+/)
        .filter(w => w.length > 3 && !GENERICAS.has(w))
    const palabrasAlim = normalizar(nombreAlimento)
        .split(/\s+/)
        .filter(w => w.length > 3 && !GENERICAS.has(w))

    if (palabrasLibre.length === 0) return false           // muy genérico → no auditamos
    if (palabrasAlim.length === 0) return true               // alimento sin palabras clave → sospechoso

    // ¿Alguna palabra significativa del libre aparece en el alimento?
    const coincide = palabrasLibre.some(w => palabrasAlim.includes(w))
    return !coincide
}

// ── Parsear args ─────────────────────────────────────────────────
const args = process.argv.slice(2)
const ES_TODAS = args.includes('--todas')
const ES_JSON = args.includes('--json')
const LIMITE = parseInt(args.find(a => a.startsWith('--limite='))?.split('=')[1] || '100', 10)

// ── Ejecutar ──────────────────────────────────────────────────────
async function main() {
    console.log(`🔍 Auditoría de matches ingredientes — ${new Date().toISOString().split('T')[0]}`)
    console.log(`📋 Modo: ${ES_TODAS ? 'TODAS las recetas' : `últimas ${LIMITE} recetas`}`)
    console.log('')

    // 1. Obtener recetas
    let query = supabase
        .from('recetas')
        .select('id, nombre')

    if (!ES_TODAS) {
        query = query.order('created_at', { ascending: false }).limit(LIMITE)
    }

    const { data: recetas, error: errRecetas } = await query
    if (errRecetas) {
        console.error('❌ Error al obtener recetas:', errRecetas)
        process.exit(1)
    }

    if (!recetas?.length) {
        console.log('ℹ️ No hay recetas para auditar.')
        return
    }

    console.log(`📦 ${recetas.length} recetas cargadas.`)

    // 2. Para cada receta, obtener sus ingredientes con join a alimentos
    const sospechosos = []

    for (const receta of recetas) {
        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select(`
        id,
        nombre_libre,
        cantidad_gramos,
        orden,
        alimento:alimento_id (id, nombre, calorias)
      `)
            .eq('receta_id', receta.id)
            .order('orden')

        if (!ingredientes?.length) continue

        for (const ri of ingredientes) {
            const nombreLibre = ri.nombre_libre || ''
            const nombreAlimento = ri.alimento?.nombre || ''

            if (!nombreLibre || !nombreAlimento) continue

            if (esMatchSospechoso(nombreLibre, nombreAlimento)) {
                sospechosos.push({
                    receta_id: receta.id,
                    receta_nombre: receta.nombre,
                    ingrediente_id: ri.id,
                    nombre_libre: nombreLibre,
                    alimento_nombre: nombreAlimento,
                    cantidad_gramos: ri.cantidad_gramos,
                    orden: ri.orden,
                })
            }
        }
    }

    // 3. Reporte
    const hoy = new Date().toISOString().split('T')[0]
    const outputDir = resolve(process.cwd(), 'salidas')
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })

    const outputPath = resolve(outputDir, `auditoria-matches-${hoy}.json`)

    const resultado = {
        fecha: hoy,
        total_recetas_auditadas: recetas.length,
        total_matches_sospechosos: sospechosos.length,
        sospechosos,
    }

    if (ES_JSON) {
        writeFileSync(outputPath, JSON.stringify(resultado, null, 2))
        console.log(`\n📄 Reporte guardado en: ${outputPath}`)
    }

    // 4. Resumen en consola
    console.log(`\n📊 RESULTADOS`)
    console.log(`   Recetas auditadas: ${recetas.length}`)
    console.log(`   Matches sospechosos: ${sospechosos.length}`)

    if (sospechosos.length > 0) {
        console.log(`\n⚠️  TOP 20 sospechosos:`)
        console.log(`   ${'RECETA'.padEnd(35)} | ${'LIBRE'.padEnd(30)} | ${'ALIMENTO'.padEnd(30)}`)
        console.log(`   ${'─'.repeat(35)}─┼─${'─'.repeat(30)}─┼─${'─'.repeat(30)}`)

        const top = sospechosos.slice(0, 20)
        for (const s of top) {
            const recetaShort = s.receta_nombre.length > 33
                ? s.receta_nombre.slice(0, 30) + '...'
                : s.receta_nombre
            const libreShort = s.nombre_libre.length > 28
                ? s.nombre_libre.slice(0, 25) + '...'
                : s.nombre_libre
            const alimShort = s.alimento_nombre.length > 28
                ? s.alimento_nombre.slice(0, 25) + '...'
                : s.alimento_nombre
            console.log(`   ${recetaShort.padEnd(35)} | ${libreShort.padEnd(30)} | ${alimShort.padEnd(30)}`)
        }

        if (sospechosos.length > 20) {
            console.log(`   ... y ${sospechosos.length - 20} más`)
        }

        console.log(`\n📁 Reporte completo: ${outputPath}`)
        console.log(`\n🔧 Para revisar un match en Supabase:`)
        console.log(`   UPDATE receta_ingredientes SET alimento_id = '<id_correcto>' WHERE id = '<ri_id>';`)
    } else {
        console.log(`\n✅ No se encontraron matches sospechosos.`)
    }
}

main().catch(console.error)

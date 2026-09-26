/**
 * auditar-matches-procesados.mjs
 *
 * Auditoría read-only (T18) — detecta receta_ingredientes donde el nombre_libre
 * describe un alimento base/plano (congelado, natural, sin azúcar, crudo...) pero
 * el alimento vinculado tiene calificadores de producto compuesto/procesado
 * (chocolate, galleta, barrita, relleno, bombón, cubierto...) o calorias = 0.
 *
 * Caso confirmado por Carlos (26-09-2026): "frambuesas congeladas" → "Frambuesas
 * Cubiertas Choc,Blanc y Choc,Leche" (450kcal/100g vs ~52 reales), "arándanos
 * congelados" → "Barritas de galleta rellenas de arándanos", "granola sin azúcar"
 * → "Granola Fitness Chocolate" con 0 kcal.
 *
 * USO:
 *   node scripts/auditar-matches-procesados.mjs              # todas las recetas aprobadas
 *   node scripts/auditar-matches-procesados.mjs --json        # guarda salidas/auditoria-procesados-YYYY-MM-DD.json
 *
 * NO modifica la base de datos. Solo genera un informe para revisión manual.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

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

function normalizar(s) {
    return s.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '').trim()
}

// Palabras que indican que el ingrediente libre describe un alimento base/plano
const PALABRAS_BASE = [
    'congelado', 'congelada', 'congelados', 'congeladas',
    'natural', 'naturales',
    'sin azucar', 'sin azúcar',
    'crudo', 'cruda', 'crudos', 'crudas',
    'fresco', 'fresca', 'frescos', 'frescas',
    'entero', 'entera', 'enteros', 'enteras',
]

// Calificadores de producto compuesto/procesado que NO deberían aparecer
// cuando el ingrediente libre pide un alimento base
const PALABRAS_PROCESADO = [
    'chocolate', 'choc', 'galleta', 'galletas', 'barrita', 'barritas',
    'relleno', 'rellena', 'rellenos', 'rellenas',
    'bombon', 'bombones', 'cubierto', 'cubierta', 'cubiertos', 'cubiertas',
    'bañado', 'banado', 'bañada', 'banada',
    'crema de cacao', 'nutella', 'praline', 'trufa',
    'snack', 'chips', 'dulce', 'caramelo', 'caramelizado', 'caramelizada',
    'glaseado', 'glaseada', 'mermelada', 'confitado', 'confitada',
]

function tieneAlguna(texto, lista) {
    return lista.some(p => texto.includes(normalizar(p)))
}

// ── Parsear args ─────────────────────────────────────────────────
const args = process.argv.slice(2)
const ES_JSON = args.includes('--json')

async function main() {
    console.log(`🔍 Auditoría T18 — auto-match base→procesado — ${new Date().toISOString().split('T')[0]}`)
    console.log('')

    // 1. Recetas aprobadas
    const { data: recetas, error: errRecetas } = await supabase
        .from('recetas')
        .select('id, nombre, estado')
        .eq('estado', 'aprobada')

    if (errRecetas) {
        console.error('❌ Error al obtener recetas:', errRecetas)
        process.exit(1)
    }
    console.log(`📦 ${recetas.length} recetas aprobadas cargadas.`)

    const sospechosos = []
    const CHUNK = 50
    for (let i = 0; i < recetas.length; i += CHUNK) {
        const lote = recetas.slice(i, i + CHUNK)
        const ids = lote.map(r => r.id)

        const { data: ingredientes, error: errIng } = await supabase
            .from('receta_ingredientes')
            .select(`
                id,
                receta_id,
                nombre_libre,
                cantidad_gramos,
                alimento:alimento_id (id, nombre, calorias)
            `)
            .in('receta_id', ids)

        if (errIng) {
            console.error('❌ Error al obtener ingredientes:', errIng)
            continue
        }

        const recetaPorId = new Map(lote.map(r => [r.id, r.nombre]))

        for (const ri of ingredientes || []) {
            const nombreLibre = ri.nombre_libre || ''
            const alimento = ri.alimento
            if (!nombreLibre || !alimento) continue

            const libreNorm = normalizar(nombreLibre)
            const alimNorm = normalizar(alimento.nombre)

            const esBase = tieneAlguna(libreNorm, PALABRAS_BASE)
            const alimEsProcesado = tieneAlguna(alimNorm, PALABRAS_PROCESADO)
            const ceroKcal = alimento.calorias === 0 || alimento.calorias === null

            // Criterio: (ingrediente pide base Y alimento vinculado es procesado)
            // O bien el alimento vinculado tiene 0 kcal (siempre sospechoso)
            const motivo = []
            if (esBase && alimEsProcesado) motivo.push('base→procesado')
            if (ceroKcal) motivo.push('0 kcal')

            if (motivo.length === 0) continue

            sospechosos.push({
                receta_id: ri.receta_id,
                receta_nombre: recetaPorId.get(ri.receta_id) || '?',
                ingrediente_id: ri.id,
                nombre_libre: nombreLibre,
                alimento_id: alimento.id,
                alimento_nombre: alimento.nombre,
                alimento_calorias: alimento.calorias,
                cantidad_gramos: ri.cantidad_gramos,
                motivo: motivo.join(' + '),
            })
        }
        process.stdout.write(`\r   Procesadas ${Math.min(i + CHUNK, recetas.length)}/${recetas.length} recetas...`)
    }
    console.log('')

    // 2. Reporte
    const hoy = new Date().toISOString().split('T')[0]
    const outputDir = resolve(process.cwd(), 'salidas')
    if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true })
    const outputPath = resolve(outputDir, `auditoria-procesados-${hoy}.json`)

    const resultado = {
        fecha: hoy,
        total_recetas_auditadas: recetas.length,
        total_sospechosos: sospechosos.length,
        sospechosos,
    }

    writeFileSync(outputPath, JSON.stringify(resultado, null, 2))

    console.log(`\n📊 RESULTADOS`)
    console.log(`   Recetas auditadas: ${recetas.length}`)
    console.log(`   Matches sospechosos: ${sospechosos.length}`)
    console.log(`\n📁 Reporte completo: ${outputPath}`)

    if (sospechosos.length > 0) {
        console.log(`\n⚠️  Detalle:`)
        for (const s of sospechosos) {
            console.log(`\n   Receta: ${s.receta_nombre}`)
            console.log(`   Libre:    "${s.nombre_libre}" (${s.cantidad_gramos}g)`)
            console.log(`   Vinculado: "${s.alimento_nombre}" (${s.alimento_calorias} kcal/100g)`)
            console.log(`   Motivo: ${s.motivo}`)
            console.log(`   UPDATE receta_ingredientes SET alimento_id = '<id_correcto>' WHERE id = '${s.ingrediente_id}';`)
        }
    } else {
        console.log(`\n✅ No se encontraron matches sospechosos con este criterio.`)
    }
}

main().catch(console.error)

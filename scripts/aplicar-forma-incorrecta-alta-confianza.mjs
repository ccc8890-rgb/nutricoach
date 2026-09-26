/**
 * aplicar-forma-incorrecta-alta-confianza.mjs
 *
 * Aplica los 110 hallazgos "forma_incorrecta" de alta confianza (ya resueltos contra
 * alimentos reales por matchear-forma-incorrecta.mjs) — 3 excluidos manualmente por
 * datos de origen demasiado confusos para automatizar (revisar a mano aparte).
 * Recalcula macros de cada receta afectada.
 *
 * USO:
 *   node scripts/aplicar-forma-incorrecta-alta-confianza.mjs            → dry-run
 *   node scripts/aplicar-forma-incorrecta-alta-confianza.mjs --apply    → aplica
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
    const p = resolve(ROOT, '.env.local')
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DRY = !process.argv.includes('--apply')

// Excluidos tras revisión manual (26-09-2026): datos de origen ya confusos (nombre_libre parece
// ser el nombre de otra receta/producto, no un ingrediente real) — no automatizar, revisar aparte.
const EXCLUIR = new Set([
    'Batido de frutos rojos con kéfir|Combinado de frutos secos, frutas desecadas y semillas de calabaza',
    'Mousse de chocolate negro y aguacate|Cereales avena crunchy hacendado de cacao',
    'Mousse de chocolate negro y aguacate|Overnight oats de proteína y vainilla',
])

const datos = JSON.parse(readFileSync(resolve(ROOT, 'salidas/forma-incorrecta-alta-confianza-2026-09-26.json'), 'utf-8'))
const aplicar = datos.filter(h => !EXCLUIR.has(`${h.receta_nombre}|${h.nombre_libre}`))

console.log(DRY ? '🔍 DRY-RUN\n' : '✏️  APLICANDO\n')
console.log(`${aplicar.length} ingredientes a re-vincular (de ${datos.length}, 3 excluidos por revisión manual)\n`)

async function recalcularMacros(recetaId, nombre) {
    const { data: receta } = await sb.from('recetas').select('porciones').eq('id', recetaId).single()
    const porciones = receta?.porciones || 1
    const { data: ings } = await sb.from('receta_ingredientes')
        .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
        .eq('receta_id', recetaId)
    let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
    for (const i of (ings || [])) {
        const g = i.cantidad_gramos || 0
        const a = i.alimentos
        if (!a) continue
        kcal += (a.calorias || 0) * g / 100
        prot += (a.proteinas || 0) * g / 100
        carb += (a.carbohidratos || 0) * g / 100
        gras += (a.grasas || 0) * g / 100
        fib += (a.fibra || 0) * g / 100
    }
    const macros = {
        kcal: Math.round(kcal / porciones * 10) / 10,
        proteinas: Math.round(prot / porciones * 10) / 10,
        carbohidratos: Math.round(carb / porciones * 10) / 10,
        grasas: Math.round(gras / porciones * 10) / 10,
        fibra: Math.round(fib / porciones * 10) / 10,
    }
    if (!DRY) await sb.from('recetas').update(macros).eq('id', recetaId)
    return macros
}

async function main() {
    const recetasAfectadas = new Map()
    for (const h of aplicar) {
        if (!DRY) {
            const { error } = await sb.from('receta_ingredientes').update({ alimento_id: h.alimento_nuevo_id }).eq('id', h.ingrediente_id)
            if (error) console.log(`  ❌ ${h.receta_nombre}: ${error.message}`)
        }
        recetasAfectadas.set(h.receta_id, h.receta_nombre)
    }
    console.log(`📊 Recalculando macros de ${recetasAfectadas.size} recetas...\n`)
    let i = 0
    for (const [id, nombre] of recetasAfectadas) {
        const macros = await recalcularMacros(id, nombre)
        i++
        if (i <= 20) console.log(`  ${DRY ? '🔍' : '✅'} ${nombre}: ${macros.kcal} kcal`)
    }
    if (recetasAfectadas.size > 20) console.log(`  ... y ${recetasAfectadas.size - 20} más`)
    console.log(DRY ? '\n🔍 Dry-run completo.' : '\n✅ Aplicado.')
}

main().catch(console.error)

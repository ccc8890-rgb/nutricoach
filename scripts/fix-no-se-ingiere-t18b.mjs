/**
 * fix-no-se-ingiere-t18b.mjs
 *
 * Aplica los hallazgos tipo "no_se_ingiere" de salidas/auditoria-forma-ingredientes-*.json:
 * ingredientes de técnica de cocción (vinagre de escalfar, sal para costra, huesos para caldo)
 * o ingredientes listados que nunca aparecen en las instrucciones. Se eliminan y se recalculan
 * las macros de cada receta afectada.
 *
 * Excluye explícitamente los ingredient_id con sugerencia != 'eliminar_ingrediente' (revisados
 * a mano: 1 caso "mantener" real, 1 caso confuso donde la IA mezcló vinagre de otra receta con
 * un ingrediente de spaghetti que no tiene nada que ver).
 *
 * USO:
 *   node scripts/fix-no-se-ingiere-t18b.mjs            → dry-run
 *   node scripts/fix-no-se-ingiere-t18b.mjs --apply    → aplica
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
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

// Excluidos tras revisión manual (26-09-2026): 1 falso positivo "mantener", 1 confuso (vinagre de
// otra receta mezclado con ingrediente de spaghetti que no tiene relación)
const EXCLUIR = new Set([
    'b458c8fa-cd67-4229-b835-8d55cb65cd56', // Sal — sí se ingiere, la propia IA dice "no aplica"
    '4f1a198b-e79d-4150-90d4-a54cbcd0c337', // Spaghetti huevo — confusión de la IA con vinagre de otra receta
])

const informe = JSON.parse(readFileSync(resolve(ROOT, 'salidas/auditoria-forma-ingredientes-2026-09-26.json'), 'utf-8'))
const aplicar = informe.hallazgos.filter(h => h.tipo === 'no_se_ingiere' && h.sugerencia === 'eliminar_ingrediente' && !EXCLUIR.has(h.ingrediente_id))

console.log(DRY ? '🔍 DRY-RUN\n' : '✏️  APLICANDO\n')
console.log(`${aplicar.length} ingredientes a eliminar (de ${informe.hallazgos.filter(h => h.tipo === 'no_se_ingiere').length} totales, tras excluir 2 revisados a mano)\n`)

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
    console.log(`  ${DRY ? '🔍' : '✅'} ${nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)
    if (!DRY) await sb.from('recetas').update(macros).eq('id', recetaId)
}

async function main() {
    const recetasAfectadas = new Set()
    for (const h of aplicar) {
        console.log(`  ${DRY ? '🔍' : '✅'} [${h.receta_nombre}] eliminar "${h.nombre_libre}" (${h.problema})`)
        if (!DRY) {
            const { error } = await sb.from('receta_ingredientes').delete().eq('id', h.ingrediente_id)
            if (error) console.log(`      ❌ ${error.message}`)
        }
        recetasAfectadas.add(h.receta_id)
    }
    console.log(`\n📊 Recalculando macros de ${recetasAfectadas.size} recetas...`)
    for (const id of recetasAfectadas) {
        const h = aplicar.find(x => x.receta_id === id)
        await recalcularMacros(id, h.receta_nombre)
    }
    console.log(DRY ? '\n🔍 Dry-run completo.' : '\n✅ Aplicado.')
}

main().catch(console.error)

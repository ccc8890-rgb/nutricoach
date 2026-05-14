/**
 * fix-9-problemas-final.mjs
 *
 * Reparación final de los 9 problemas detectados tras la corrección integral.
 *
 * ESTRATEGIA (CORREGIDA):
 *   En lugar de reasignar alimento_id (que afectaría a múltiples recetas),
 *   ACTUALIZAMOS los alimentos base que tienen 0 kcal con sus macros reales,
 *   y luego forzamos el recálculo vía SQL calcular_macros_receta().
 *
 * Problemas:
 *   1-3. 3 recetas con kcal=0 porque alimentos referenciados tienen 0 kcal
 *   4-9. 6 recetas con kcal_100g inconsistentes (valores viejos)
 *
 * USO:
 *   node scripts/fix-9-problemas-final.mjs           # dry-run
 *   node scripts/fix-9-problemas-final.mjs --yes     # ejecutar
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

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

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const ES_DRY_RUN = !process.argv.includes('--yes') && !process.argv.includes('-y')

const LOG = []
function log(msg) { LOG.push(msg); console.log(msg) }

// ── FASE 1: ASIGNAR MACROS REALES a alimentos con 0 kcal ──────
// En lugar de reasignar alimento_id (que afecta a TODOS los ingredientes
// que referencian ese ID), actualizamos el alimento base con sus macros reales.
const MACROS_REALES = {
    // Barrita con proteínas Enervit Sport sabor chocolate con leche
    // Usada como "proteína en polvo" y "yogur proteico" en 7 ingredientes
    '09fda2f1-7721-4398-a611-449dfdcaab14': {
        calorias: 380,
        proteinas: 30,
        carbohidratos: 35,
        grasas: 12,
        fibra: 3,
    },
    // Galletas María dorada
    // Usada como "galletas" y "galletas de arroz" en 2 ingredientes
    '2d88d7aa-6bbe-4b7d-b6a9-7257392d14b4': {
        calorias: 430,
        proteinas: 7,
        carbohidratos: 76,
        grasas: 11,
        fibra: 3,
    },
}

async function fase1ActualizarAlimentosBase() {
    log('\n═══ FASE 1: ACTUALIZAR ALIMENTOS BASE CON MACROS REALES ═══\n')

    let ok = 0

    for (const [id, macros] of Object.entries(MACROS_REALES)) {
        const { data: alim } = await supabase
            .from('alimentos')
            .select('id, nombre, calorias')
            .eq('id', id)
            .single()

        if (!alim) {
            log(`  ❌ Alimento ${id} no encontrado`)
            continue
        }

        // Contar usos
        const { data: usos } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre')
            .eq('alimento_id', id)

        const usosPorReceta = {}
        for (const u of (usos || [])) {
            const { data: rec } = await supabase
                .from('recetas')
                .select('nombre')
                .eq('id', u.receta_id)
                .single()
            const nombreReceta = rec?.nombre || u.receta_id
            if (!usosPorReceta[nombreReceta]) usosPorReceta[nombreReceta] = []
            usosPorReceta[nombreReceta].push(u.nombre_libre)
        }

        log(`\n  "${alim.nombre}" (actual: ${alim.calorias} kcal)`)
        log(`  → ${macros.calorias} kcal, P:${macros.proteinas}, C:${macros.carbohidratos}, G:${macros.grasas}`)
        log(`  Usos (${usos?.length || 0} ingredientes):`)
        for (const [recetaNombre, ings] of Object.entries(usosPorReceta)) {
            log(`    · "${recetaNombre}": ${ings.join(', ')}`)
        }

        if (ES_DRY_RUN) {
            log(`  📝 Dry-run: se actualizaría (dry-run)`)
            ok++
            continue
        }

        const { error } = await supabase
            .from('alimentos')
            .update(macros)
            .eq('id', id)

        if (error) {
            log(`  ❌ Error: ${error.message}`)
        } else {
            log(`  ✅ Actualizado`)
            ok++
        }
    }

    log(`\n  Alimentos actualizados: ${ok}/${Object.keys(MACROS_REALES).length}`)
    return ok
}

// ── FASE 2: FORZAR RECÁLCULO SQL de las 9 recetas problemáticas ──
async function fase2ForzarRecalculo() {
    log('\n═══ FASE 2: FORZAR RECÁLCULO (calcular_macros_receta vía RPC) ═══\n')

    const nombres = [
        'Tarta de la abuela proteica',
        'Revuelto de setas con ajetes y gambas',
        'Pollo teriyaki con arroz integral',
        'Gazpacho de sandía y tomate',
        'Tostas de pan de centeno con sardinas y tomate',
        'Parfait de yogur griego con frutos rojos y semillas de chía',
        'Albóndigas de pollo en salsa ligera de tomate',
        'Tostada de pan de centeno con aguacate y tomate',
        'Batido de frutos rojos con kéfir',
    ]

    let ok = 0, errores = 0, noEncontradas = 0

    for (const nombre of nombres) {
        const { data: recetas, error: searchErr } = await supabase
            .from('recetas')
            .select('id, nombre, kcal, porciones, peso_total_g')
            .ilike('nombre', nombre)

        if (searchErr || !recetas || recetas.length === 0) {
            log(`  ⏭️  "${nombre}" — no encontrada`)
            noEncontradas++
            continue
        }

        const r = recetas[0]
        const antes = { kcal: r.kcal, peso: r.peso_total_g }

        // Intentar RPC primero
        const { error: fnErr } = await supabase.rpc('calcular_macros_receta', {
            p_receta_id: r.id
        })

        if (fnErr) {
            // Fallback: cálculo manual + UPDATE directo
            log(`  ⚠️  RPC falló para "${r.nombre}": ${fnErr.message}. Modo manual...`)

            const { data: ings } = await supabase
                .from('receta_ingredientes')
                .select('id, cantidad_gramos, alimento_id')
                .eq('receta_id', r.id)

            const { data: alims } = await supabase
                .from('alimentos')
                .select('id, calorias, proteinas, carbohidratos, grasas, fibra')

            const alimMap = {}
            for (const a of (alims || [])) alimMap[a.id] = a

            let kcalT = 0, protT = 0, carbsT = 0, grasT = 0, fibT = 0, pesoT = 0
            for (const ing of (ings || [])) {
                if (!ing.alimento_id || !ing.cantidad_gramos) continue
                const a = alimMap[ing.alimento_id]
                if (!a) continue
                const f = ing.cantidad_gramos / 100
                kcalT += (a.calorias || 0) * f
                protT += (a.proteinas || 0) * f
                carbsT += (a.carbohidratos || 0) * f
                grasT += (a.grasas || 0) * f
                fibT += (a.fibra || 0) * f
                pesoT += ing.cantidad_gramos
            }

            const porc = r.porciones || 1
            const updateData = {
                kcal: porc > 0 ? Math.round(kcalT / porc) : 0,
                proteinas: porc > 0 ? Math.round((protT / porc) * 10) / 10 : 0,
                carbohidratos: porc > 0 ? Math.round((carbsT / porc) * 10) / 10 : 0,
                grasas: porc > 0 ? Math.round((grasT / porc) * 10) / 10 : 0,
                fibra: porc > 0 ? Math.round((fibT / porc) * 10) / 10 : 0,
                kcal_100g: pesoT > 0 ? Math.round(kcalT / pesoT * 100) : 0,
                proteinas_100g: pesoT > 0 ? Math.round((protT / pesoT * 100) * 10) / 10 : 0,
                carbohidratos_100g: pesoT > 0 ? Math.round((carbsT / pesoT * 100) * 10) / 10 : 0,
                grasas_100g: pesoT > 0 ? Math.round((grasT / pesoT * 100) * 10) / 10 : 0,
                fibra_100g: pesoT > 0 ? Math.round((fibT / pesoT * 100) * 10) / 10 : 0,
                peso_total_g: pesoT,
                updated_at: new Date().toISOString(),
            }

            if (ES_DRY_RUN) {
                log(`  📝 "${r.nombre}": ${antes.kcal}→${updateData.kcal} kcal (dry-run)`)
                ok++
                continue
            }

            const { error: updErr } = await supabase
                .from('recetas')
                .update(updateData)
                .eq('id', r.id)

            if (updErr) {
                log(`    ❌ "${r.nombre}": ${updErr.message}`)
                errores++
            } else {
                log(`    ✅ "${r.nombre}": ${antes.kcal}→${updateData.kcal} kcal/porc | ${updateData.kcal_100g} kcal/100g`)
                ok++
            }
        } else {
            if (ES_DRY_RUN) {
                log(`  📝 "${r.nombre}": llamaría a calcular_macros_receta() (dry-run)`)
                ok++
                continue
            }

            // RPC exitoso, leer valor actualizado
            const { data: updated } = await supabase
                .from('recetas')
                .select('kcal, peso_total_g, kcal_100g')
                .eq('id', r.id)
                .single()

            log(`    ✅ "${r.nombre}" (RPC): ${antes.kcal}→${updated?.kcal || '?'} kcal/porc | ${updated?.peso_total_g || '?'}g | ${updated?.kcal_100g || '?'} kcal/100g`)
            ok++
        }
    }

    log(`\n  ✅ Recalculadas: ${ok} | ❌ Errores: ${errores} | ⏭️  No encontradas: ${noEncontradas}`)
    return { ok, errores, noEncontradas }
}

// ── FASE 3: VERIFICACIÓN FINAL ────────────────────────────────
async function fase3Verificar() {
    log('\n═══ FASE 3: VERIFICACIÓN FINAL ═══\n')

    const { data: recetas } = await supabase.from('recetas').select('*')
    if (!recetas) return 999

    const { data: ings } = await supabase.from('receta_ingredientes').select('*')
    const { data: alims } = await supabase.from('alimentos').select('*')
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a

    const VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
    let problemas = 0

    for (const r of recetas) {
        const issues = []
        const ingList = (ings || []).filter(i => i.receta_id === r.id)

        if ((!r.kcal || r.kcal === 0) && ingList.length > 0) {
            issues.push('kcal=0 teniendo ingredientes')
        }

        if (r.intolerancias && Array.isArray(r.intolerancias)) {
            for (const i of r.intolerancias) {
                if (!VALIDAS.includes(i)) issues.push(`intolerancia inválida: "${i}"`)
            }
        }

        if (!r.tags || r.tags.length === 0) issues.push('sin tags')

        if (r.kcal && r.peso_total_g && r.kcal_100g) {
            const calc100g = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100)
            if (Math.abs(calc100g - Math.round(r.kcal_100g)) > 10) {
                issues.push(`kcal_100g inconsistente: BD=${Math.round(r.kcal_100g)} vs calculado=${calc100g}`)
            }
        }

        if (issues.length > 0) {
            problemas++
            log(`  ⚠️  "${r.nombre}": ${issues.join(', ')}`)
        }
    }

    const conTags = recetas.filter(r => r.tags && r.tags.length > 0).length
    const conIntol = recetas.filter(r => r.intolerancias && r.intolerancias.length > 0).length
    const conKcal = recetas.filter(r => r.kcal && r.kcal > 0).length
    const kcalMedia = recetas.filter(r => r.kcal).reduce((s, r) => s + (r.kcal || 0), 0) / (recetas.filter(r => r.kcal).length || 1)

    log(`\n  📊 ESTADÍSTICAS FINALES:`)
    log(`  Total recetas: ${recetas.length}`)
    log(`  Con kcal > 0: ${conKcal}/${recetas.length}`)
    log(`  Con tags: ${conTags}/${recetas.length}`)
    log(`  Con intolerancias estándar: ${conIntol}/${recetas.length}`)
    log(`  Kcal media/porción: ${Math.round(kcalMedia)}`)
    log(`  Recetas con problemas: ${problemas}`)

    return problemas
}

// ── MAIN ───────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log(ES_DRY_RUN ? '║   REPARACIÓN FINAL — DRY RUN                        ║' : '║   REPARACIÓN FINAL DE 9 PROBLEMAS                  ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

    if (ES_DRY_RUN) console.log('\n⚠️  MODO DRY-RUN: No se guardarán cambios. Usa --yes para ejecutar.\n')

    // FASE 1: Actualizar alimentos base con macros reales
    await fase1ActualizarAlimentosBase()

    // FASE 2: Forzar recálculo SQL
    await fase2ForzarRecalculo()

    // FASE 3: Verificar
    if (!ES_DRY_RUN) {
        const problemas = await fase3Verificar()
        if (problemas === 0) {
            log('\n  🎉 ¡CERO PROBLEMAS! Recetario completamente alineado.')
        } else {
            log(`\n  ⚠️  Quedan ${problemas} problemas por resolver.`)
        }
    } else {
        log('\n  (verificación omitida en dry-run)')
    }

    const totalOps = LOG.filter(l => l.startsWith('  ✅') || l.startsWith('  📝')).length
    log(`\n══════════════════════════════════════════════════════════`)
    log(ES_DRY_RUN ? `  📋 DRY-RUN COMPLETADO — ${totalOps} operaciones simuladas` : `  ✅ REPARACIÓN COMPLETADA — ${totalOps} operaciones ejecutadas`)
    log('══════════════════════════════════════════════════════════\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

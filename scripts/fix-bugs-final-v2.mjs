/**
 * fix-bugs-final-v2.mjs
 *
 * Reparación de bugs detectados en la auditoría profunda.
 *
 * Bugs a resolver:
 *   1. Eliminar receta duplicada "Arroz del senyoret, receta valenciana"
 *   2. Asignar macros a alimentos que están en 0 kcal y son usados en recetas
 *   3. Poner kcal=0 a recetas sin ingredientes que aún tienen kcal viejas
 *   4. Forzar recálculo RPC de todas las recetas con ingredientes
 *   5. Corregir re-matchings incorrectos más graves
 *
 * USO:
 *   node scripts/fix-bugs-final-v2.mjs           # dry-run
 *   node scripts/fix-bugs-final-v2.mjs --yes     # ejecutar
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

// ═══════════════════════════════════════════════════════════════
// FASE 1: ELIMINAR DUPLICADO
// ═══════════════════════════════════════════════════════════════
async function fase1EliminarDuplicado() {
    log('\n═══ FASE 1: ELIMINAR DUPLICADO ═══\n')

    const { data: dups } = await supabase
        .from('recetas')
        .select('id, nombre')
        .ilike('nombre', '%arroz del senyoret%')
        .order('id')

    if (!dups || dups.length < 2) {
        log('  No hay duplicados de "Arroz del senyoret"')
        return 0
    }

    log(`  Encontrados ${dups.length} duplicados:`)
    for (const d of dups) log(`    - ${d.id}: "${d.nombre}"`)

    const aEliminar = dups[1]
    const aMantener = dups[0]

    log(`\n  Mantener: "${aMantener.nombre}" (${aMantener.id})`)
    log(`  Eliminar: "${aEliminar.nombre}" (${aEliminar.id})`)

    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('id')
        .eq('receta_id', aEliminar.id)

    if (ings && ings.length > 0) {
        log(`\n  ⚠️  El duplicado tiene ${ings.length} ingredientes. Migrándolos...`)

        if (!ES_DRY_RUN) {
            const { error } = await supabase
                .from('receta_ingredientes')
                .update({ receta_id: aMantener.id })
                .eq('receta_id', aEliminar.id)

            if (error) {
                log(`  ❌ Error migrando ingredientes: ${error.message}`)
                return 0
            }
            log(`  ✅ Ingredientes migrados a "${aMantener.nombre}"`)
        } else {
            log(`  📝 Se migrarían ${ings.length} ingredientes (dry-run)`)
        }
    }

    if (ES_DRY_RUN) {
        log(`  📝 Se eliminaría "${aEliminar.nombre}" (dry-run)`)
        return 1
    }

    const { error } = await supabase
        .from('recetas')
        .delete()
        .eq('id', aEliminar.id)

    if (error) {
        log(`  ❌ Error eliminando duplicado: ${error.message}`)
        return 0
    }

    log(`  ✅ Duplicado eliminado: "${aEliminar.nombre}"`)
    return 1
}

// ═══════════════════════════════════════════════════════════════
// FASE 2: ASIGNAR MACROS A ALIMENTOS CON 0 kcal
// ═══════════════════════════════════════════════════════════════
const MACROS_PENDIENTES = {
    // Salsas y condimentos
    'tomate frito receta artesana': { calorias: 60, proteinas: 1.5, carbohidratos: 8, grasas: 2.5, fibra: 1.5 },
    'tomate frito sin azúcares añadidos': { calorias: 40, proteinas: 1.5, carbohidratos: 5, grasas: 1.5, fibra: 2 },
    'salsa de soja sin gluten': { calorias: 53, proteinas: 8, carbohidratos: 5, grasas: 0.1, fibra: 0.5 },
    'sazonador pasta': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 2 },

    // Tortillas (actualmente 0 kcal en BD)
    'tortilla trigo': { calorias: 300, proteinas: 8, carbohidratos: 52, grasas: 7, fibra: 3 },
    'tortilla de trigo': { calorias: 300, proteinas: 8, carbohidratos: 52, grasas: 7, fibra: 3 },
}

async function fase2AlimentosConMacros() {
    log('\n═══ FASE 2: ASIGNAR MACROS A ALIMENTOS CON 0 kcal ═══\n')

    const { data: alims } = await supabase.from('alimentos').select('id, nombre, calorias')

    let ok = 0, noEncontrados = 0

    for (const [nombreBuscado, macros] of Object.entries(MACROS_PENDIENTES)) {
        const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
        const target = norm(nombreBuscado)

        const alim = (alims || []).find(a => norm(a.nombre) === target)
        if (!alim) {
            noEncontrados++
            if (noEncontrados <= 5) log(`  ⏭️  "${nombreBuscado}" — no encontrado en BD`)
            continue
        }

        if (alim.calorias && alim.calorias > 0) {
            log(`  ✅ "${alim.nombre}" — ya tiene ${alim.calorias} kcal (saltar)`)
            ok++
            continue
        }

        if (ES_DRY_RUN) {
            log(`  📝 "${alim.nombre}" → ${macros.calorias} kcal (dry-run)`)
            ok++
            continue
        }

        const { error } = await supabase
            .from('alimentos')
            .update(macros)
            .eq('id', alim.id)

        if (error) {
            log(`  ❌ "${alim.nombre}": ${error.message}`)
        } else {
            log(`  ✅ "${alim.nombre}" → ${macros.calorias} kcal, P:${macros.proteinas}, G:${macros.grasas}`)
            ok++
        }
    }

    log(`\n  Alimentos actualizados: ${ok}/${Object.keys(MACROS_PENDIENTES).length} | No encontrados: ${noEncontrados}`)
    return ok
}

// ═══════════════════════════════════════════════════════════════
// FASE 3: LIMPIAR kcal FANTASMA de recetas sin ingredientes
// ═══════════════════════════════════════════════════════════════
async function fase3LimpiarKcalFantasma() {
    log('\n═══ FASE 3: LIMPIAR kcal FANTASMA (recetas sin ingredientes) ═══\n')

    const { data: recetas } = await supabase.from('recetas').select('id, nombre, kcal')
    const { data: ings } = await supabase.from('receta_ingredientes').select('receta_id')
    const recetasConIngs = new Set((ings || []).map(i => i.receta_id))

    let limpiadas = 0

    for (const r of (recetas || [])) {
        if (!recetasConIngs.has(r.id) && r.kcal && r.kcal > 0) {
            limpiadas++
            if (ES_DRY_RUN) {
                log(`  📝 "${r.nombre}": ${Math.round(r.kcal)}→0 kcal (dry-run)`)
                continue
            }

            const { error } = await supabase
                .from('recetas')
                .update({
                    kcal: 0,
                    proteinas: 0,
                    carbohidratos: 0,
                    grasas: 0,
                    fibra: 0,
                    kcal_100g: null,
                    proteinas_100g: null,
                    carbohidratos_100g: null,
                    grasas_100g: null,
                    fibra_100g: null,
                    peso_total_g: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', r.id)

            if (error) {
                log(`  ❌ "${r.nombre}": ${error.message}`)
            } else {
                log(`  ✅ "${r.nombre}": ${Math.round(r.kcal)}→0 kcal`)
            }
        }
    }

    log(`\n  Recetas limpiadas: ${limpiadas}`)
    return limpiadas
}

// ═══════════════════════════════════════════════════════════════
// FASE 4: FORZAR RECÁLCULO RPC de todas las recetas con ingredientes
// ═══════════════════════════════════════════════════════════════
async function fase4RecalcularTodas() {
    log('\n═══ FASE 4: RECALCULAR TODAS LAS RECETAS CON INGREDIENTES ═══\n')

    const { data: recetas } = await supabase.from('recetas').select('id, nombre')
    const { data: ings } = await supabase.from('receta_ingredientes').select('receta_id')
    const recetasConIngs = new Set((ings || []).map(i => i.receta_id))

    let ok = 0, errores = 0

    for (const r of (recetas || [])) {
        if (!recetasConIngs.has(r.id)) continue

        if (ES_DRY_RUN) {
            ok++
            continue
        }

        const { error } = await supabase.rpc('calcular_macros_receta', {
            p_receta_id: r.id
        })

        if (error) {
            // Fallback manual
            const { data: ingList } = await supabase
                .from('receta_ingredientes')
                .select('id, cantidad_gramos, alimento_id')
                .eq('receta_id', r.id)

            const { data: alims } = await supabase
                .from('alimentos')
                .select('id, calorias, proteinas, carbohidratos, grasas, fibra')

            const alimMap = {}
            for (const a of (alims || [])) alimMap[a.id] = a

            let kcalT = 0, protT = 0, carbsT = 0, grasT = 0, fibT = 0, pesoT = 0
            for (const ing of (ingList || [])) {
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

            const { data: rec } = await supabase
                .from('recetas')
                .select('porciones')
                .eq('id', r.id)
                .single()

            const porc = (rec?.porciones) || 1
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

            const { error: updErr } = await supabase
                .from('recetas')
                .update(updateData)
                .eq('id', r.id)

            if (updErr) {
                log(`  ❌ "${r.nombre}": ${updErr.message}`)
                errores++
            } else {
                ok++
            }
        } else {
            ok++
        }
    }

    log(`  ✅ Recalculadas: ${ok} | ❌ Errores: ${errores}`)
    return ok
}

// ═══════════════════════════════════════════════════════════════
// FASE 5: CORREGIR RE-MATCHINGS INCORRECTOS MÁS GRAVES
// ═══════════════════════════════════════════════════════════════
const CORREGIR_MATCHINGS = [
    // "Cebolla roja" → "Cebolla frita crujiente" (mal)
    { nombre_libre: 'Cebolla roja', debeIrA: 'Cebolla' },
    { nombre_libre: 'Cebolla', debeIrA: 'Cebolla' },

    // "Leche evaporada/condensada light" → "Café con leche light" (mal)
    { nombre_libre: 'Leche evaporada light', debeIrA: 'Leche evaporada' },
    { nombre_libre: 'Leche condensada light', debeIrA: 'Leche condensada' },

    // "Huevo" → "Spaghetti al huevo" (mal)
    { nombre_libre: 'Huevo', debeIrA: 'Huevo M' },
    { nombre_libre: 'huevo', debeIrA: 'Huevo M' },

    // "Aceite de coco" → "Aceite de oliva 0,4º" (mal)
    { nombre_libre: 'aceite de coco', debeIrA: 'Aceite de coco' },
    { nombre_libre: 'Aceite de coco', debeIrA: 'Aceite de coco' },

    // "Harina de almendra" → "Harina De Avena" (mal)
    { nombre_libre: 'harina de almendra', debeIrA: 'Harina de almendra' },
    { nombre_libre: 'Harina de almendra', debeIrA: 'Harina de almendra' },

    // "Crema de avellana" → "Tomate frito sin azúcares" (mal)
    { nombre_libre: 'Crema de avellana', debeIrA: 'Crema de avellana' },
    { nombre_libre: 'crema de avellana sin azúcar', debeIrA: 'Crema de avellana' },

    // "Miso blanco" → "Vinagre de vino blanco" (mal)
    { nombre_libre: 'Miso blanco', debeIrA: 'Miso blanco' },
    { nombre_libre: 'miso blanco', debeIrA: 'Miso blanco' },
]

async function fase5CorregirMatchings() {
    log('\n═══ FASE 5: CORREGIR RE-MATCHINGS INCORRECTOS ═══\n')

    const { data: alims } = await supabase.from('alimentos').select('id, nombre, calorias')

    let ok = 0, noEncontrados = 0

    for (const fix of CORREGIR_MATCHINGS) {
        const destino = (alims || []).find(a => a.nombre === fix.debeIrA)
        if (!destino) {
            noEncontrados++
            if (noEncontrados <= 5) log(`  ⏭️  "${fix.debeIrA}" — alimento destino no encontrado`)
            continue
        }

        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('id, nombre_libre, receta_id, alimento_id')
            .ilike('nombre_libre', fix.nombre_libre)

        if (!ingredientes || ingredientes.length === 0) continue

        for (const ing of ingredientes) {
            if (ing.alimento_id === destino.id) continue

            const actual = (alims || []).find(a => a.id === ing.alimento_id)
            const actualStr = actual ? `"${actual.nombre}" (${actual.calorias} kcal)` : 'DESCONOCIDO'

            if (ES_DRY_RUN) {
                log(`  📝 "${ing.nombre_libre}" ${actualStr} → "${destino.nombre}" (${destino.calorias} kcal) (dry-run)`)
            } else {
                const { error } = await supabase
                    .from('receta_ingredientes')
                    .update({ alimento_id: destino.id })
                    .eq('id', ing.id)

                if (error) {
                    log(`  ❌ "${ing.nombre_libre}": ${error.message}`)
                } else {
                    log(`  ✅ "${ing.nombre_libre}" ${actualStr} → "${destino.nombre}" (${destino.calorias} kcal)`)
                }
            }
            ok++
        }
    }

    log(`\n  Ingredientes corregidos: ${ok} | Destinos no encontrados: ${noEncontrados}`)
    return ok
}

// ═══════════════════════════════════════════════════════════════
// FASE 6: VERIFICACIÓN FINAL
// ═══════════════════════════════════════════════════════════════
async function fase6Verificar() {
    log('\n═══ FASE 6: VERIFICACIÓN FINAL ═══\n')

    const { data: recetas, error } = await supabase.from('recetas').select('*')
    if (error) { log(`  ❌ Error: ${error.message}`); return 999 }

    const { data: ings } = await supabase.from('receta_ingredientes').select('*')
    const { data: alims } = await supabase.from('alimentos').select('*')
    const alimMap = {}; for (const a of (alims || [])) alimMap[a.id] = a
    const ingPorR = {}; for (const i of (ings || [])) { if (!ingPorR[i.receta_id]) ingPorR[i.receta_id] = []; ingPorR[i.receta_id].push(i) }

    const VALIDAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']
    let problemas = 0

    for (const r of recetas) {
        const issues = []
        const ingList = ingPorR[r.id] || []

        if ((!r.kcal || r.kcal === 0) && ingList.length > 0) issues.push('kcal=0 teniendo ingredientes')

        if (r.intolerancias && Array.isArray(r.intolerancias)) {
            for (const i of r.intolerancias) {
                if (!VALIDAS.includes(i)) issues.push(`intolerancia inválida: "${i}"`)
            }
        }

        if (!r.tags || r.tags.length === 0) issues.push('sin tags')

        if (r.kcal && r.peso_total_g && r.kcal_100g) {
            const calc100g = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100)
            if (Math.abs(calc100g - Math.round(r.kcal_100g)) > 10) {
                issues.push(`kcal_100g: BD=${Math.round(r.kcal_100g)} calc=${calc100g}`)
            }
        }

        if (issues.length > 0) {
            problemas++
            log(`  ⚠️  "${r.nombre}": ${issues.join(', ')}`)
        }
    }

    const total = recetas.length
    const conKcal = recetas.filter(r => r.kcal && r.kcal > 0).length
    const conTags = recetas.filter(r => r.tags && r.tags.length > 0).length
    const conIntol = recetas.filter(r => r.intolerancias && r.intolerancias.length > 0).length
    const kcalMedia = recetas.filter(r => r.kcal).reduce((s, r) => s + (r.kcal || 0), 0) / (recetas.filter(r => r.kcal).length || 1)
    const conIngs = recetas.filter(r => ingPorR[r.id] && ingPorR[r.id].length > 0).length

    let kcalAltas = 0, kcalBajas = 0
    for (const r of recetas) {
        if (!r.kcal) continue
        if (r.kcal > 2000) kcalAltas++
        if (r.kcal > 0 && r.kcal < 20 && (ingPorR[r.id] || []).length > 0) kcalBajas++
    }

    const alimIdsUsados = new Set((ings || []).filter(i => i.alimento_id).map(i => i.alimento_id))
    const alimsZeroUsados = (alims || []).filter(a => alimIdsUsados.has(a.id) && (!a.calorias || a.calorias === 0))

    log(`\n  📊 ESTADÍSTICAS FINALES:`)
    log(`  Total recetas: ${total}`)
    log(`  Con ingredientes: ${conIngs}/${total}`)
    log(`  Con kcal > 0: ${conKcal}/${total}`)
    log(`  Con tags: ${conTags}/${total}`)
    log(`  Con intolerancias: ${conIntol}/${total}`)
    log(`  Kcal media/porción: ${Math.round(kcalMedia)}`)
    log(`  Macros >2000 kcal: ${kcalAltas}`)
    log(`  Macros <20 kcal (con ings): ${kcalBajas}`)
    log(`  Alimentos con 0 kcal usados: ${alimsZeroUsados.length}`)
    log(`  Recetas con problemas: ${problemas}`)

    return problemas
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log(ES_DRY_RUN ? '║   FIX BUGS V2 — DRY RUN                            ║' : '║   FIX BUGS V2                                        ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

    if (ES_DRY_RUN) console.log('\n⚠️  MODO DRY-RUN: No se guardarán cambios. Usa --yes para ejecutar.\n')

    await fase1EliminarDuplicado()
    await fase2AlimentosConMacros()
    await fase3LimpiarKcalFantasma()
    await fase5CorregirMatchings()
    await fase4RecalcularTodas()

    if (!ES_DRY_RUN) {
        const problemas = await fase6Verificar()
        if (problemas === 0) log('\n  🎉 ¡CERO PROBLEMAS!')
        else log(`\n  ⚠️  Quedan ${problemas} problemas`)
    } else {
        log('\n  (verificación omitida en dry-run)')
    }

    const totalOps = LOG.filter(l => l.startsWith('  ✅') || l.startsWith('  📝')).length
    log(`\n══════════════════════════════════════════════════════════`)
    log(ES_DRY_RUN ? `  📋 DRY-RUN: ${totalOps} ops simuladas` : `  ✅ COMPLETADO: ${totalOps} ops`)
    log('══════════════════════════════════════════════════════════\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

#!/usr/bin/env node
/**
 * fix-macros-kcal-unificado.mjs
 *
 * Diagnostica y repara TODOS los bugs relacionados con macros y kcal
 * en alimentos y recetas.
 *
 * Bugs que resuelve:
 *   1. Alimentos con kcal=0 que son usados en recetas → asigna macros reales
 *   2. Recetas donde kcal=total en vez de kcal=porción (por scripts legacy)
 *   3. Recetas con kcal_por_porcion poblado pero kcal=0 (esquema dual)
 *   4. Recetas con alimento_id=null en ingredientes (no se vinculan)
 *   5. Recetas sin recalcular tras corregir alimento_id
 *   6. kcal_100g desincronizado con kcal/porciones/peso_total
 *
 * USO:
 *   node scripts/fix-macros-kcal-unificado.mjs             # dry-run
 *   node scripts/fix-macros-kcal-unificado.mjs --yes       # ejecutar
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
// FASE 0: DIAGNÓSTICO
// ═══════════════════════════════════════════════════════════════
async function fase0Diagnostico() {
    log('\n═══ FASE 0: DIAGNÓSTICO COMPLETO ═══\n')

    // ── Alimentos ──
    const { data: alimentos } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
    const { data: ingredientes } = await supabase.from('receta_ingredientes').select('id, receta_id, alimento_id, cantidad_gramos, nombre_libre')
    const { data: recetas } = await supabase.from('recetas').select('*')

    log(`📊 ALIMENTOS: ${alimentos?.length || 0} totales`)

    // Alimentos con 0 kcal usados en recetas
    const alimIdsUsados = new Set((ingredientes || []).filter(i => i.alimento_id).map(i => i.alimento_id))
    const alimsZeroUsados = (alimentos || []).filter(a => alimIdsUsados.has(a.id) && (!a.calorias || a.calorias === 0))
    log(`   🟡 Alimentos con 0 kcal usados en recetas: ${alimsZeroUsados.length}`)
    for (const a of alimsZeroUsados.slice(0, 10)) {
        log(`      - "${a.nombre}" (kcal=0, usado por ${(ingredientes || []).filter(i => i.alimento_id === a.id).length} ingredientes)`)
    }

    // ── Ingredientes ──
    const sinAlimentoId = (ingredientes || []).filter(i => !i.alimento_id)
    log(`📊 INGREDIENTES: ${ingredientes?.length || 0} totales`)
    log(`   🔴 Sin alimento_id: ${sinAlimentoId.length}`)
    for (const i of sinAlimentoId.slice(0, 5)) {
        log(`      - "${i.nombre_libre}" (receta: ${i.receta_id})`)
    }

    // ── Recetas ──
    log(`\n📊 RECETAS: ${recetas?.length || 0} totales`)

    const conIngs = new Set((ingredientes || []).map(i => i.receta_id))
    const sinIngs = (recetas || []).filter(r => !conIngs.has(r.id))

    // Recetas con kcal=0 que tienen ingredientes
    const kcalCeroConIngs = (recetas || []).filter(r =>
        conIngs.has(r.id) && (!r.kcal || r.kcal === 0)
    )
    log(`   🔴 Con ingredientes pero kcal=0: ${kcalCeroConIngs.length}`)
    for (const r of kcalCeroConIngs.slice(0, 5)) {
        log(`      - "${r.nombre}" (kcal=${r.kcal})`)
    }

    // Recetas donde kcal podría ser TOTAL en vez de porción
    // Detectamos: kcal > 1500 (una porción rara vez supera eso) Y porciones >= 1
    const kcalSospechosas = (recetas || []).filter(r =>
        r.kcal && r.kcal > 1500 && (r.porciones || 1) > 1 && conIngs.has(r.id)
    )
    log(`   🟡 Posible kcal=TOTAL (no /porción): ${kcalSospechosas.length}`)
    for (const r of kcalSospechosas.slice(0, 10)) {
        const p = r.porciones || 1
        log(`      - "${r.nombre}": ${Math.round(r.kcal)} kcal × ${p} porc = ${Math.round(r.kcal / p)} kcal/porción (peso: ${r.peso_total_g || '?'}g)`)
    }

    // Recetas con kcal_por_porcion (esquema viejo) diferente de kcal (esquema nuevo)
    const dualDesync = (recetas || []).filter(r =>
        r.kcal_por_porcion && r.kcal && Math.abs(r.kcal - r.kcal_por_porcion) > 5
    )
    log(`   🟡 Desync kcal vs kcal_por_porcion: ${dualDesync.length}`)
    for (const r of dualDesync.slice(0, 5)) {
        log(`      - "${r.nombre}": kcal=${Math.round(r.kcal)}, kcal_por_porcion=${Math.round(r.kcal_por_porcion)} (diff: ${Math.round(Math.abs(r.kcal - r.kcal_por_porcion))})`)
    }

    // Recetas con kcal_100g desincronizado
    const kcal100gBad = (recetas || []).filter(r => {
        if (!r.kcal || !r.peso_total_g || !r.kcal_100g) return false
        const calc = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100)
        return Math.abs(calc - Math.round(r.kcal_100g)) > 10
    })
    log(`   🟡 kcal_100g desincronizado: ${kcal100gBad.length}`)
    for (const r of kcal100gBad.slice(0, 5)) {
        const calc = Math.round((r.kcal * (r.porciones || 1)) / r.peso_total_g * 100)
        log(`      - "${r.nombre}": BD=${Math.round(r.kcal_100g)}, calc=${calc} (kcal=${r.kcal}, porc=${r.porciones}, peso=${r.peso_total_g})`)
    }

    // Resumen
    log(`\n═══════════════════════════════════════════`)
    log(`RESUMEN:`)
    log(`  Alimentos con 0 kcal usados: ${alimsZeroUsados.length}`)
    log(`  Ingredientes sin alimento_id: ${sinAlimentoId.length}`)
    log(`  Recetas con kcal=0 (con ings): ${kcalCeroConIngs.length}`)
    log(`  Recetas con kcal sospechosa: ${kcalSospechosas.length}`)
    log(`  Desync kcal vs kcal_por_porcion: ${dualDesync.length}`)
    log(`  kcal_100g desincronizado: ${kcal100gBad.length}`)
    log(`═══════════════════════════════════════════\n`)

    return { alimentos, ingredientes, recetas, conIngs, alimsZeroUsados, sinAlimentoId, kcalCeroConIngs, kcalSospechosas }
}

// ═══════════════════════════════════════════════════════════════
// FASE 1: ASIGNAR MACROS A ALIMENTOS CON 0 kcal
// ═══════════════════════════════════════════════════════════════
const MACROS_PENDIENTES = {
    // Salsas y condimentos
    'tomate frito receta artesana': { calorias: 60, proteinas: 1.5, carbohidratos: 8, grasas: 2.5, fibra: 1.5 },
    'tomate frito sin azúcares añadidos': { calorias: 40, proteinas: 1.5, carbohidratos: 5, grasas: 1.5, fibra: 2 },
    'salsa de soja sin gluten': { calorias: 53, proteinas: 8, carbohidratos: 5, grasas: 0.1, fibra: 0.5 },
    'sazonador pasta': { calorias: 50, proteinas: 2, carbohidratos: 8, grasas: 1, fibra: 2 },
    // Tortillas
    'tortilla trigo': { calorias: 300, proteinas: 8, carbohidratos: 52, grasas: 7, fibra: 3 },
    'tortilla de trigo': { calorias: 300, proteinas: 8, carbohidratos: 52, grasas: 7, fibra: 3 },
    // Más alimentos base faltantes
    'cebolla morada': { calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7 },
    'hinojo': { calorias: 31, proteinas: 1.2, carbohidratos: 7.3, grasas: 0.2, fibra: 3.1 },
    'rábano': { calorias: 16, proteinas: 0.7, carbohidratos: 3.4, grasas: 0.1, fibra: 1.6 },
    'pimiento verde': { calorias: 20, proteinas: 0.9, carbohidratos: 4.6, grasas: 0.2, fibra: 1.7 },
    'berenjena': { calorias: 25, proteinas: 1, carbohidratos: 5.9, grasas: 0.2, fibra: 3 },
    'judías verdes': { calorias: 31, proteinas: 1.8, carbohidratos: 7, grasas: 0.1, fibra: 3.2 },
    'remolacha': { calorias: 43, proteinas: 1.6, carbohidratos: 9.6, grasas: 0.2, fibra: 2.8 },
    'apio': { calorias: 16, proteinas: 0.7, carbohidratos: 3, grasas: 0.2, fibra: 1.6 },
}

async function fase1AsignarMacros(alimentos, ingredientes) {
    log('\n═══ FASE 1: ASIGNAR MACROS A ALIMENTOS CON 0 kcal ═══\n')

    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    const alimIdsUsados = new Set((ingredientes || []).filter(i => i.alimento_id).map(i => i.alimento_id))

    let ok = 0, noEncontrados = 0

    for (const [nombreBuscado, macros] of Object.entries(MACROS_PENDIENTES)) {
        const target = norm(nombreBuscado)
        const alim = (alimentos || []).find(a => norm(a.nombre) === target)

        if (!alim) {
            noEncontrados++
            continue
        }

        // Solo actualizar si está en uso Y tiene 0 kcal
        if (!alimIdsUsados.has(alim.id)) continue
        if (alim.calorias && alim.calorias > 0) {
            log(`  ✅ "${alim.nombre}" — ya tiene ${alim.calorias} kcal`)
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
// FASE 2: RECALCULAR MACROS DE RECETAS
// ═══════════════════════════════════════════════════════════════
/**
 * Recalcula los macros de UNA receta desde cero.
 * Usa la misma lógica que el trigger SQL calcular_macros_receta()
 * pero con fallback para ingredientes sin alimento_id.
 */
async function recalcularReceta(recetaId, receta, alimMap) {
    const { data: ings } = await supabase
        .from('receta_ingredientes')
        .select('id, alimento_id, cantidad_gramos, nombre_libre')
        .eq('receta_id', recetaId)

    if (!ings || ings.length === 0) {
        // Sin ingredientes → poner todo a 0
        return {
            kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0,
            kcal_100g: null, proteinas_100g: null, carbohidratos_100g: null,
            grasas_100g: null, fibra_100g: null, peso_total_g: null,
        }
    }

    let kcalT = 0, protT = 0, carbsT = 0, grasT = 0, fibT = 0, pesoT = 0

    for (const ing of ings) {
        if (!ing.cantidad_gramos) continue

        let a = null
        if (ing.alimento_id) {
            a = alimMap[ing.alimento_id]
        }

        if (!a) {
            // Ingrediente sin alimento vinculado → intentar match
            // En esta fase saltamos (no hacemos matching automático aquí)
            continue
        }

        const f = ing.cantidad_gramos / 100
        kcalT += (a.calorias || 0) * f
        protT += (a.proteinas || 0) * f
        carbsT += (a.carbohidratos || 0) * f
        grasT += (a.grasas || 0) * f
        fibT += (a.fibra || 0) * f
        pesoT += ing.cantidad_gramos
    }

    const porc = receta.porciones || 1

    // Sin redondeo — igual que el trigger SQL calcular_macros_receta()
    // para evitar desyncs cuando el trigger se dispare después
    const kcalPorcion = porc > 0 ? kcalT / porc : 0
    const protPorcion = porc > 0 ? protT / porc : 0
    const carbsPorcion = porc > 0 ? carbsT / porc : 0
    const grasPorcion = porc > 0 ? grasT / porc : 0
    const fibPorcion = porc > 0 ? fibT / porc : 0

    return {
        kcal: +kcalPorcion.toFixed(2),
        proteinas: +protPorcion.toFixed(2),
        carbohidratos: +carbsPorcion.toFixed(2),
        grasas: +grasPorcion.toFixed(2),
        fibra: +fibPorcion.toFixed(2),
        kcal_100g: pesoT > 0 ? +(kcalT / pesoT * 100).toFixed(2) : null,
        proteinas_100g: pesoT > 0 ? +(protT / pesoT * 100).toFixed(2) : null,
        carbohidratos_100g: pesoT > 0 ? +(carbsT / pesoT * 100).toFixed(2) : null,
        grasas_100g: pesoT > 0 ? +(grasT / pesoT * 100).toFixed(2) : null,
        fibra_100g: pesoT > 0 ? +(fibT / pesoT * 100).toFixed(2) : null,
        peso_total_g: +pesoT.toFixed(2),
    }
}

async function fase2RecalcularRecetas(recetas, ingredientes, alimentos) {
    log('\n═══ FASE 2: RECALCULAR MACROS DE RECETAS ═══\n')

    const alimMap = {}
    for (const a of (alimentos || [])) alimMap[a.id] = a

    const conIngsSet = new Set((ingredientes || []).map(i => i.receta_id))
    const recetasAProcesar = (recetas || []).filter(r => conIngsSet.has(r.id))

    let recalculadas = 0, errores = 0, saltadas = 0

    for (const r of recetasAProcesar) {
        const nuevosMacros = await recalcularReceta(r.id, r, alimMap)

        // Saltar si no hay cambio significativo
        const kcalActual = r.kcal || 0
        const kcalNueva = nuevosMacros.kcal || 0

        if (Math.abs(kcalActual - kcalNueva) < 1 && r.peso_total_g === nuevosMacros.peso_total_g) {
            saltadas++
            continue
        }

        if (ES_DRY_RUN) {
            log(`  📝 "${r.nombre}": ${Math.round(kcalActual)}→${Math.round(kcalNueva)} kcal (dry-run)`)
            recalculadas++
            continue
        }

        const { error } = await supabase
            .from('recetas')
            .update({
                ...nuevosMacros,
                updated_at: new Date().toISOString(),
            })
            .eq('id', r.id)

        if (error) {
            log(`  ❌ "${r.nombre}": ${error.message}`)
            errores++
        } else {
            log(`  ✅ "${r.nombre}": ${Math.round(kcalActual)}→${Math.round(kcalNueva)} kcal (${r.porciones || 1} porc, ${nuevosMacros.peso_total_g || 0}g)`)
            recalculadas++
        }
    }

    log(`\n  Recalculadas: ${recalculadas} | Errores: ${errores} | Sin cambios: ${saltadas}`)
    return recalculadas
}

// ═══════════════════════════════════════════════════════════════
// FASE 3: SINCRONIZAR kcal_por_porcion (esquema legacy)
// ═══════════════════════════════════════════════════════════════
async function fase3SincronizarLegacy(recetas) {
    log('\n═══ FASE 3: SINCRONIZAR ESQUEMA LEGACY (kcal_por_porcion) ═══\n')

    let ok = 0
    for (const r of (recetas || [])) {
        if (!r.kcal && !r.kcal_por_porcion) continue

        const kcalActual = r.kcal || 0
        const kcalLegacy = r.kcal_por_porcion || 0

        if (Math.abs(kcalActual - kcalLegacy) < 1) continue

        if (ES_DRY_RUN) {
            log(`  📝 "${r.nombre}": kcal_por_porcion ${Math.round(kcalLegacy)}→${Math.round(kcalActual)} (dry-run)`)
            ok++
            continue
        }

        const { error } = await supabase
            .from('recetas')
            .update({
                kcal_por_porcion: r.kcal,
                proteinas_por_porcion: r.proteinas,
                carbohidratos_por_porcion: r.carbohidratos,
                grasas_por_porcion: r.grasas,
                updated_at: new Date().toISOString(),
            })
            .eq('id', r.id)

        if (!error) {
            log(`  ✅ "${r.nombre}": kcal_por_porcion ${Math.round(kcalLegacy)}→${Math.round(kcalActual)}`)
            ok++
        }
    }

    log(`\n  Sincronizadas: ${ok}`)
    return ok
}

// ═══════════════════════════════════════════════════════════════
// FASE 4: FORZAR TRIGGER VÍA RPC
// ═══════════════════════════════════════════════════════════════
async function fase4ForzarTrigger(recetas, ingredientes) {
    log('\n═══ FASE 4: FORZAR RECÁLCULO VÍA RPC (calcular_macros_receta) ═══\n')

    const conIngsSet = new Set((ingredientes || []).map(i => i.receta_id))
    const conAlimento = (ingredientes || []).filter(i => i.alimento_id)
    const conAlimentoSet = new Set(conAlimento.map(i => i.receta_id))

    let ok = 0, errores = 0

    for (const r of (recetas || [])) {
        if (!conIngsSet.has(r.id)) continue
        if (!conAlimentoSet.has(r.id)) {
            // No tiene ningún ingrediente con alimento_id → RPC no hará nada
            continue
        }

        if (ES_DRY_RUN) {
            ok++
            continue
        }

        const { error } = await supabase.rpc('calcular_macros_receta', {
            p_receta_id: r.id
        })

        if (error) {
            log(`  ❌ "${r.nombre}": ${error.message}`)
            errores++
        } else {
            ok++
        }
    }

    log(`  ✅ RPC ejecutado: ${ok} recetas | ❌ Errores: ${errores}`)
    return ok
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗')
    console.log(ES_DRY_RUN ? '║   FIX MACROS-KCAL UNIFICADO — DRY RUN                  ║' : '║   FIX MACROS-KCAL UNIFICADO                          ║')
    console.log('╚══════════════════════════════════════════════════════════╝')

    if (ES_DRY_RUN) console.log('\n⚠️  MODO DRY-RUN: No se guardarán cambios. Usa --yes para ejecutar.\n')

    // Fase 0: Diagnóstico
    const diag = await fase0Diagnostico()

    // Fase 1: Asignar macros a alimentos con 0 kcal
    await fase1AsignarMacros(diag.alimentos, diag.ingredientes)

    // Recargar alimentos después de fase 1
    const { data: alimentosActualizados } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')

    // Fase 2: Recalcular recetas
    await fase2RecalcularRecetas(diag.recetas, diag.ingredientes, alimentosActualizados || diag.alimentos)

    // Recargar recetas después de fase 2
    const { data: recetasActualizadas } = await supabase.from('recetas').select('*')

    // Fase 3: Sincronizar esquema legacy
    await fase3SincronizarLegacy(recetasActualizadas || diag.recetas)

    // Fase 4: Forzar trigger RPC
    await fase4ForzarTrigger(recetasActualizadas || diag.recetas, diag.ingredientes)

    const totalOps = LOG.filter(l => l.startsWith('  ✅') || l.startsWith('  📝')).length
    log(`\n══════════════════════════════════════════════════════════`)
    log(ES_DRY_RUN ? `  📋 DRY-RUN: ${totalOps} ops simuladas` : `  ✅ COMPLETADO: ${totalOps} ops`)
    log('══════════════════════════════════════════════════════════\n')
}

main().catch(err => {
    console.error('FATAL:', err)
    process.exit(1)
})

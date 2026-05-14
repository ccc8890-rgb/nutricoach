#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * _fix-8-recetas-default-100g.mjs
 * ═══════════════════════════════════════════════════════════════
 * Corrige 8 recetas que tienen todos los ingredientes a 100g por defecto
 * y algunos alimentos mal vinculados.
 *
 * Qué hace:
 *   1. Re-ejecuta el matching de ingredientes con el algoritmo mejorado
 *      (prioriza startsWith, penaliza palabras extra en el candidato)
 *   2. No puede adivinar cantidades reales — las deja como están para
 *      corrección manual desde el editor web
 *
 * USO:
 *   node scripts/_fix-8-recetas-default-100g.mjs           # ejecutar
 *   node scripts/_fix-8-recetas-default-100g.mjs --dry-run # solo diagnosticar
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// ── Config ────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// ── Env ────────────────────────────────────────────────────────
const envPath = new URL('../.env.local', import.meta.url).pathname
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

// ── Palabras auxiliares (mismas que en scrape-receta) ──────────
const CONNECTORS = new Set(['de', 'la', 'las', 'los', 'el', 'lo', 'un', 'una', 'del', 'al', 'con', 'y', 'e', 'a', 'para', 'por', 'en'])
const PREP_WORDS = new Set(['cruda', 'crudo', 'cocida', 'cocido', 'cocidas', 'cocidos', 'congelada', 'congelado', 'congeladas', 'congelados', 'natural', 'naturales', 'light', 'fresco', 'fresca', 'frescos', 'entero', 'entera', 'enteras', 'enteros', 'desnatada', 'desnatado', 'semidesnatada', 'molida', 'molido', 'rallada', 'rallado', 'tostada', 'tostado', 'tostadas', 'picada', 'picado', 'asada', 'asado', 'frita', 'frito', 'ahumado', 'ahumada', 'seca', 'seco', 'polvo', 'lata', 'brick', 'sal', 'sin', 'batido', 'batida'])

function norm(p) { return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') }
function singularizar(palabra) {
    const p2 = palabra.toLowerCase().trim()
    if (p2.endsWith('ces') && p2.length > 4) return p2.slice(0, -3) + 'z'
    if (p2.endsWith('s') && p2.length > 3) return p2.slice(0, -1)
    return p2
}
function esSustantiva(palabra) {
    if (CONNECTORS.has(palabra)) return false
    if (PREP_WORDS.has(palabra)) return false
    if (palabra.length <= 2) return false
    return true
}
function palabraEnConsulta(palabraCandidato, palabrasConsulta) {
    for (const pc of palabrasConsulta) {
        const p1 = singularizar(palabraCandidato)
        const p2 = singularizar(pc)
        if (norm(p1) === norm(p2)) return true
    }
    return false
}

// ── Matching mejorado (misma lógica que el Fix 2) ─────────────
async function buscarAlimento(supabaseService, token) {
    const { data: direct } = await supabaseService
        .from('alimentos')
        .select('id, nombre, calorias')
        .ilike('nombre', '%' + token + '%')
    if (direct && direct.length > 0) return direct
    return []
}

function limpiarNombreIngrediente(nombre) {
    return nombre
        .replace(/\(.*?\)/g, '')   // eliminar (notas)
        .replace(/\s+/g, ' ')      // colapsar espacios
        .trim()
}

async function reMatchearIngrediente(supabaseService, nombre) {
    // Limpiar paréntesis descriptivos primero
    const nombreLimpio = limpiarNombreIngrediente(nombre)
    const q = nombreLimpio.toLowerCase().trim()
    if (!q) return null

    // 1. Match exacto
    const { data: exact } = await supabaseService
        .from('alimentos')
        .select('id, nombre, calorias')
        .ilike('nombre', q)
    if (exact?.length) return exact[0]

    // 2. Match exacto con singular
    const singular = singularizar(q)
    if (singular !== q) {
        const { data: exSing } = await supabaseService
            .from('alimentos')
            .select('id, nombre, calorias')
            .ilike('nombre', singular)
        if (exSing?.length) return exSing[0]
    }

    // 3. Starts-with (mejor que contains)
    const { data: startsWith } = await supabaseService
        .from('alimentos')
        .select('id, nombre, calorias')
        .ilike('nombre', q + '%')
    if (startsWith?.length === 1) return startsWith[0]

    // 4. Multi-token scoring
    const tokens = q.split(/\s+/).filter(w => w.length > 2)
    const tokensExtra = new Set(tokens)
    if (singular !== q) tokensExtra.add(singular)
    for (const t of tokens) {
        const s = singularizar(t)
        if (s !== t) tokensExtra.add(s)
    }
    const tokensBuscar = Array.from(tokensExtra)

    const candidatosMap = new Map()
    for (const token of tokensBuscar) {
        const results = await buscarAlimento(supabaseService, token)
        if (results) {
            for (const item of results) {
                if (!candidatosMap.has(item.id)) candidatosMap.set(item.id, item)
            }
        }
    }

    if (candidatosMap.size === 0) return null

    // Puntuar candidatos
    const qNorm = norm(q)
    const scored = Array.from(candidatosMap.values())
        .map(a => {
            const aNorm = norm(a.nombre)
            let score = 0
            for (const t of tokensBuscar) {
                if (aNorm.includes(norm(t))) score += 10
                else score -= 8
            }
            // Penalizar palabras extra
            const palabrasCand = aNorm.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
            const palabrasQ = qNorm.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
            let extra = 0
            for (const pc of palabrasCand) {
                if (pc.length <= 2) continue
                if (!palabraEnConsulta(pc, palabrasQ)) extra += 10
            }
            // Bonus starts-with
            const esStartsWith = aNorm.startsWith(qNorm)
            if (esStartsWith) score += 30  // prioridad alta
            return { ...a, score: score - extra, palabrasExtra: extra, esStartsWith }
        })
        .sort((a, b) => {
            if (b.esStartsWith !== a.esStartsWith) return b.esStartsWith - a.esStartsWith
            if (b.score !== a.score) return b.score - a.score
            if (a.palabrasExtra !== b.palabrasExtra) return a.palabrasExtra - b.palabrasExtra
            return a.nombre.length - b.nombre.length
        })

    const mejor = scored[0]
    if (mejor.esStartsWith) return mejor
    if (mejor.score > 0 && mejor.palabrasExtra === 0) return mejor
    // Si el mejor tiene palabras extra pero no es starts-with, probar segundo
    if (mejor.palabrasExtra > 0 && scored.length > 1) {
        const segundo = scored[1]
        if (segundo.esStartsWith || segundo.palabrasExtra === 0) return segundo
    }
    return null
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
    console.log(DRY_RUN ? '🔍 DRY RUN — No se modificarán datos\n' : '⚡ EJECUTANDO — Se modificarán datos\n')

    // 1. Buscar recetas con todos los ingredientes a 100g
    const { data: recetas } = await supabase.from('recetas').select('id,nombre,porciones,peso_total_g')

    const recetasAfectadas = []
    for (const receta of recetas) {
        const { data: ings } = await supabase.from('receta_ingredientes').select('id,nombre_libre,cantidad_gramos,alimento_id,orden').eq('receta_id', receta.id)
        if (ings && ings.length > 0 && ings.every(i => i.cantidad_gramos === 100)) {
            recetasAfectadas.push({ ...receta, ingredientes: ings })
        }
    }

    console.log(`📊 Recetas con todos los ingredientes a 100g: ${recetasAfectadas.length}\n`)

    let totalReMatches = 0
    let totalCambios = 0
    let totalAlimentoChanged = 0

    for (const receta of recetasAfectadas) {
        console.log(`\n━━━ ${receta.nombre} (${receta.ingredientes.length} ingredientes, ${receta.porciones} porción(es)) ━━━`)

        for (const ing of receta.ingredientes) {
            const nuevoMatch = await reMatchearIngrediente(supabase, ing.nombre_libre)
            const oldMatchId = ing.alimento_id

            // Buscar nombre del match actual
            let oldAlimento = null
            if (oldMatchId) {
                const { data: a } = await supabase.from('alimentos').select('id, nombre, calorias').eq('id', oldMatchId).single()
                oldAlimento = a
            }

            const oldNombre = oldAlimento ? `${oldAlimento.nombre} (${oldAlimento.calorias} kcal)` : 'SIN ALIMENTO'
            const newNombre = nuevoMatch ? `${nuevoMatch.nombre} (${nuevoMatch.calorias} kcal)` : 'SIN ALIMENTO'

            const cambioAlimento = nuevoMatch && nuevoMatch.id !== oldMatchId
            const cambioStr = cambioAlimento ? '🔄 CAMBIO' : '✓'

            console.log(`  ${ing.orden}. "${ing.nombre_libre}" | ${ing.cantidad_gramos}g`)
            console.log(`     Antes: → ${oldNombre}`)
            console.log(`     Ahora: → ${newNombre} ${cambioAlimento ? '🔄' : '✓'}`)

            if (cambioAlimento && !DRY_RUN) {
                const { error } = await supabase
                    .from('receta_ingredientes')
                    .update({ alimento_id: nuevoMatch.id })
                    .eq('id', ing.id)
                if (error) {
                    console.error(`     ❌ Error al actualizar: ${error.message}`)
                } else {
                    totalAlimentoChanged++
                }
            }
            if (cambioAlimento) totalCambios++
            totalReMatches++
        }

        // Recalcular macros de esta receta
        if (!DRY_RUN) {
            const { data: ingsActualizados } = await supabase
                .from('receta_ingredientes')
                .select('id, nombre_libre, cantidad_gramos, alimento_id')
                .eq('receta_id', receta.id)

            let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalPeso = 0
            for (const ing of ingsActualizados) {
                totalPeso += ing.cantidad_gramos || 0
                if (ing.alimento_id) {
                    const { data: a } = await supabase.from('alimentos').select('calorias,proteinas,carbohidratos,grasas').eq('id', ing.alimento_id).single()
                    if (a) {
                        const factor = (ing.cantidad_gramos || 0) / 100
                        totalKcal += (a.calorias || 0) * factor
                        totalP += (a.proteinas || 0) * factor
                        totalC += (a.carbohidratos || 0) * factor
                        totalG += (a.grasas || 0) * factor
                    }
                }
            }

            const porciones = receta.porciones || 1
            const nuevosMacros = {
                kcal: Math.round((totalKcal / porciones) * 100) / 100,
                proteinas: Math.round((totalP / porciones) * 100) / 100,
                carbohidratos: Math.round((totalC / porciones) * 100) / 100,
                grasas: Math.round((totalG / porciones) * 100) / 100,
                peso_total_g: totalPeso,
            }

            const { error: updError } = await supabase
                .from('recetas')
                .update(nuevosMacros)
                .eq('id', receta.id)

            if (updError) {
                console.error(`  ❌ Error al recalcular macros: ${updError.message}`)
            } else {
                console.log(`  📊 Macros recalculados: ${nuevosMacros.kcal} kcal | P:${nuevosMacros.proteinas} C:${nuevosMacros.carbohidratos} G:${nuevosMacros.grasas} | peso: ${nuevosMacros.peso_total_g}g`)
            }
        }
    }

    console.log(`\n═══════════════════════════════════════`)
    console.log(`📊 RESUMEN:`)
    console.log(`  Recetas procesadas: ${recetasAfectadas.length}`)
    console.log(`  Ingredientes re-evaluados: ${totalReMatches}`)
    console.log(`  Alimentos cambiados: ${totalCambios}`)
    if (!DRY_RUN) {
        console.log(`  Actualizados en BD: ${totalAlimentoChanged}`)
    }
    console.log(DRY_RUN ? `\n🔍 DRY RUN — No se modificó nada. Ejecuta sin --dry-run para aplicar.` : `\n✅ Fix aplicado.`)
}

main().catch(console.error)

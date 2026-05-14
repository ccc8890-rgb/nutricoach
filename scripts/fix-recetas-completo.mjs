#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * fix-recetas-completo.mjs
 * ═══════════════════════════════════════════════════════════════
 * Fix completo de recetas en 3 fases:
 *   FASE 1 — Corregir instrucciones mal formateadas (JSON arrays, single-line)
 *   FASE 2 — Enriquecer alimentos base con macros (calorias=0 que afectan recetas)
 *   FASE 3 — Recalcular macros de TODAS las recetas desde ingredientes
 *
 * USO:
 *   node scripts/fix-recetas-completo.mjs              # ejecutar todo
 *   node scripts/fix-recetas-completo.mjs --dry-run     # solo diagnosticar, no modificar
 *   node scripts/fix-recetas-completo.mjs --fase 1      # solo fase 1
 *   node scripts/fix-recetas-completo.mjs --fase 2      # solo fase 2
 *   node scripts/fix-recetas-completo.mjs --fase 3      # solo fase 3
 * ═══════════════════════════════════════════════════════════════
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// ── Config ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FASE = args.includes('--fase') ? parseInt(args[args.indexOf('--fase') + 1], 10) : null

// ── Env ────────────────────────────────────────────────────────
const envPath = resolve(projectRoot, '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim()
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

// ── Helpers ────────────────────────────────────────────────────
/**
 * Limpia el prefijo de numeración de un texto de paso.
 * "1. Precalienta el horno" → "Precalienta el horno"
 * "1) Precalienta" → "Precalienta"
 */
function limpiarNumeracion(texto) {
    return texto.trim().replace(/^\d+\s*[\.\)]\s*/, '').trim()
}

function formatearInstrucciones(instrucciones) {
    if (!instrucciones || typeof instrucciones !== 'string') return null

    const trimmed = instrucciones.trim()
    if (!trimmed) return null

    // Caso 1: JSON array string → ["paso 1", "paso 2"]
    if (trimmed.startsWith('[')) {
        try {
            const arr = JSON.parse(trimmed)
            if (Array.isArray(arr) && arr.length > 0) {
                return arr.map((item, i) => {
                    let text = typeof item === 'string' ? item : (item.text || item.content || JSON.stringify(item))
                    text = limpiarNumeracion(text)
                    return `${i + 1}. ${text}`
                }).join('\n')
            }
        } catch {
            return null // No es JSON válido, seguir con otros casos
        }
    }

    // Caso 2: JSON object array → [{"@type":"HowToStep","text":"..."}]
    if (trimmed.includes('"@type"') || trimmed.includes('HowToStep') || trimmed.includes('"text"')) {
        try {
            const parsed = JSON.parse(trimmed)
            const arr = Array.isArray(parsed) ? parsed : (parsed.steps || parsed.itemListElement || [])
            if (Array.isArray(arr) && arr.length > 0) {
                return arr.map((item, i) => {
                    let text = item.text || item.name || item.content || (typeof item === 'string' ? item : '')
                    text = limpiarNumeracion(text)
                    return `${i + 1}. ${text}`
                }).join('\n')
            }
        } catch {
            return null
        }
    }

    // Caso 3: Ya está bien formateado (empieza con "N. " en cualquier línea)
    if (/^\d+\.\s/m.test(trimmed)) {
        return null // No necesita cambios
    }

    // Caso 4: Ya tiene saltos de línea pero no está numerado → numerar
    if (trimmed.includes('\n')) {
        const lines = trimmed.split('\n').filter(l => l.trim())
        // Verificar si ya está numerado (cualquier línea empieza con "N. ")
        const yaNumerado = lines.some(l => /^\d+\s*[\.\)]\s/.test(l.trim()))
        if (yaNumerado) return null // Ya tiene formato correcto

        // Numerar líneas no vacías
        const numeradas = lines
            .filter(l => l.trim())
            .map((l, i) => `${i + 1}. ${l.trim().replace(/^[-•*]\s*/, '')}`)
        return numeradas.join('\n')
    }

    // Caso 5: Línea única con puntos → dividir por puntos
    const sentences = trimmed.split(/(?<=\.)\s+/).filter(s => s.trim())
    if (sentences.length > 1) {
        return sentences.map((s, i) => `${i + 1}. ${s.trim().replace(/^\.?\s*/, '')}`).join('\n')
    }

    // Caso 6: Línea única sin puntos → numerar como paso único
    return `1. ${trimmed}`
}

// ── ALIMENTOS_FIX_MACROS ──────────────────────────────────────
// Valores nutricionales por 100g para alimentos que pueden tener calorias=0 en BD.
// TODAS las claves en minúsculas para matching case-insensitive.
// ORDEN IMPORTANTE: las claves más específicas (más largas) deben ir PRIMERO
// para evitar que "sal" matchee "sal de ajo".
const ALIMENTOS_FIX_MACROS = [
    // ── Especias y condimentos (ordenadas de más específico a menos) ──
    { nombre: 'sal de ajo', calorias: 5, proteinas: 0.2, carbohidratos: 1.0, grasas: 0.0, fibra: 0.2 },
    { nombre: 'pimienta negra molida', calorias: 251, proteinas: 10.4, carbohidratos: 64.0, grasas: 3.3, fibra: 26.0 },
    { nombre: 'orégano seco', calorias: 265, proteinas: 9.0, carbohidratos: 68.9, grasas: 4.3, fibra: 42.5 },
    { nombre: 'canela molida', calorias: 247, proteinas: 3.9, carbohidratos: 80.6, grasas: 1.2, fibra: 53.1 },
    { nombre: 'comino molido', calorias: 375, proteinas: 17.8, carbohidratos: 44.2, grasas: 22.3, fibra: 10.5 },
    { nombre: 'cúrcuma molida', calorias: 354, proteinas: 7.8, carbohidratos: 64.9, grasas: 9.9, fibra: 21.0 },
    { nombre: 'pimentón dulce', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 37.5 },
    { nombre: 'pimenton', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 37.5 },
    { nombre: 'ajo en polvo', calorias: 331, proteinas: 16.6, carbohidratos: 72.7, grasas: 0.7, fibra: 9.2 },
    { nombre: 'cebolla en polvo', calorias: 341, proteinas: 10.1, carbohidratos: 79.1, grasas: 0.9, fibra: 8.5 },
    { nombre: 'nuez moscada molida', calorias: 525, proteinas: 5.8, carbohidratos: 49.3, grasas: 36.3, fibra: 20.8 },
    { nombre: 'jengibre molido', calorias: 335, proteinas: 8.9, carbohidratos: 71.6, grasas: 4.2, fibra: 14.1 },
    { nombre: 'hojas de laurel', calorias: 313, proteinas: 7.6, carbohidratos: 75.0, grasas: 8.4, fibra: 26.3 },
    { nombre: 'tomillo seco', calorias: 276, proteinas: 9.1, carbohidratos: 63.9, grasas: 7.4, fibra: 37.0 },
    { nombre: 'romero seco', calorias: 331, proteinas: 4.9, carbohidratos: 64.1, grasas: 15.2, fibra: 42.7 },
    { nombre: 'clavo molido', calorias: 323, proteinas: 6.0, carbohidratos: 65.5, grasas: 13.0, fibra: 34.3 },
    { nombre: 'curry en polvo', calorias: 325, proteinas: 14.0, carbohidratos: 55.8, grasas: 14.0, fibra: 10.0 },
    { nombre: 'pimienta', calorias: 251, proteinas: 10.4, carbohidratos: 64.0, grasas: 3.3, fibra: 26.0 },
    { nombre: 'pimenton dulce', calorias: 282, proteinas: 14.1, carbohidratos: 54.0, grasas: 12.9, fibra: 37.5 },

    // ── Salsas y preparados ──
    { nombre: 'salsa de tomate zero sin azúcares añadidos', calorias: 35, proteinas: 1.5, carbohidratos: 5.0, grasas: 0.5, fibra: 1.5 },
    { nombre: 'salsa de tomate', calorias: 35, proteinas: 1.5, carbohidratos: 5.0, grasas: 0.5, fibra: 1.5 },
    { nombre: 'salsa barbacoa', calorias: 140, proteinas: 0.8, carbohidratos: 33.0, grasas: 0.5, fibra: 0.5 },
    { nombre: 'salsa de soja', calorias: 60, proteinas: 8.0, carbohidratos: 5.0, grasas: 0.1, fibra: 0.5 },
    { nombre: 'mostaza', calorias: 66, proteinas: 4.0, carbohidratos: 5.0, grasas: 3.0, fibra: 1.5 },
    { nombre: 'vinagre balsámico', calorias: 88, proteinas: 0.5, carbohidratos: 17.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'vinagre de manzana', calorias: 22, proteinas: 0.0, carbohidratos: 0.9, grasas: 0.0, fibra: 0.0 },
    { nombre: 'vinagre', calorias: 20, proteinas: 0.1, carbohidratos: 0.9, grasas: 0.0, fibra: 0.0 },
    { nombre: 'extracto de vainilla', calorias: 288, proteinas: 0.1, carbohidratos: 12.7, grasas: 0.1, fibra: 0.0 },
    { nombre: 'levadura química', calorias: 50, proteinas: 0.0, carbohidratos: 12.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'bicarbonato sódico', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'bicarbonato', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'cacao en polvo sin azúcar', calorias: 350, proteinas: 20.0, carbohidratos: 15.0, grasas: 15.0, fibra: 33.0 },
    { nombre: 'cacao en polvo', calorias: 350, proteinas: 20.0, carbohidratos: 15.0, grasas: 15.0, fibra: 33.0 },
    { nombre: 'edulcorante líquido', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'edulcorante', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'stevia', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
    { nombre: 'levadura de cerveza', calorias: 375, proteinas: 45.0, carbohidratos: 35.0, grasas: 5.0, fibra: 3.0 },
    { nombre: 'levadura nutricional', calorias: 375, proteinas: 45.0, carbohidratos: 35.0, grasas: 5.0, fibra: 3.0 },
    { nombre: 'caldo de verduras', calorias: 5, proteinas: 0.2, carbohidratos: 0.8, grasas: 0.1, fibra: 0.0 },
    { nombre: 'caldo de pollo', calorias: 10, proteinas: 1.5, carbohidratos: 0.5, grasas: 0.2, fibra: 0.0 },
    { nombre: 'caldo de carne', calorias: 10, proteinas: 1.5, carbohidratos: 0.5, grasas: 0.2, fibra: 0.0 },
    { nombre: 'pasta de dientes', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },

    // ── Sal (va al FINAL para que no matchee "sal de ajo") ──
    { nombre: 'sal', calorias: 0, proteinas: 0.0, carbohidratos: 0.0, grasas: 0.0, fibra: 0.0 },
]

/**
 * Busca un alimento en ALIMENTOS_FIX_MACROS.
 * Estrategia de matching (por orden de prioridad):
 *   1. Exact match (case-insensitive)
 *   2. El nombre del alimento empieza con el nombre del match (ej: "Sal de ajo" → "sal de ajo")
 *   3. El match empieza con el nombre del alimento (solo si nombre > 3 chars para evitar falsos)
 */
function buscarMatchAlimento(nombreAlimento) {
    const needle = nombreAlimento.toLowerCase().trim()
    if (!needle) return null

    // 1. Exact match
    let match = ALIMENTOS_FIX_MACROS.find(a => a.nombre === needle)
    if (match) return match

    // 2. StartsWith bidireccional
    match = ALIMENTOS_FIX_MACROS.find(a =>
        needle.startsWith(a.nombre) || a.nombre.startsWith(needle)
    )
    if (match) return match

    // 3. Includes (solo si needle > 3 chars para evitar "sal" → "sal de ajo")
    if (needle.length > 3) {
        match = ALIMENTOS_FIX_MACROS.find(a => needle.includes(a.nombre))
        if (match) return match

        match = ALIMENTOS_FIX_MACROS.find(a => a.nombre.includes(needle))
        if (match) return match
    }

    return null
}

// ── FASE 1: Corregir instrucciones ─────────────────────────────
async function fase1() {
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  FASE 1 — Corregir instrucciones mal formateadas')
    console.log('═══════════════════════════════════════════════════════\n')

    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, instrucciones')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Error al obtener recetas:', error.message)
        return { corregidas: 0, totalMal: 0 }
    }

    console.log(`📊 Total recetas: ${recetas.length}`)

    let corregidas = 0
    let yaBien = 0
    let sinInstrucciones = 0
    const modificaciones = []

    for (const receta of recetas) {
        const original = receta.instrucciones

        // Sin instrucciones
        if (!original || original.trim() === '') {
            sinInstrucciones++
            continue
        }

        const formateadas = formatearInstrucciones(original)

        // null = ya está bien, no necesita cambios
        if (formateadas === null) {
            yaBien++
            continue
        }

        // Hay cambio
        modificaciones.push({
            id: receta.id,
            nombre: receta.nombre,
            original: original.substring(0, 100),
            formateadas: formateadas.substring(0, 100),
            instrucciones_new: formateadas
        })
        corregidas++
    }

    console.log(`\n📊 Diagnóstico:`)
    console.log(`   ✅ Ya bien formateadas: ${yaBien}`)
    console.log(`   ❌ Mal formateadas (a corregir): ${corregidas}`)
    console.log(`   ⚠️  Sin instrucciones: ${sinInstrucciones}`)

    if (modificaciones.length > 0) {
        console.log(`\n📋 Detalle de recetas a corregir:`)
        for (const m of modificaciones) {
            console.log(`\n   ${m.nombre}`)
            console.log(`     ANTES: ${m.original.replace(/\n/g, '\\n')}`)
            console.log(`     DESPUÉS: ${m.formateadas.replace(/\n/g, '\\n')}`)
        }

        if (!DRY_RUN) {
            console.log(`\n🔄 Aplicando correcciones...`)
            let ok = 0, fail = 0
            for (const m of modificaciones) {
                const { error: upErr } = await supabase
                    .from('recetas')
                    .update({ instrucciones: m.instrucciones_new })
                    .eq('id', m.id)

                if (upErr) {
                    console.error(`   ❌ ${m.nombre}: ${upErr.message}`)
                    fail++
                } else {
                    ok++
                }
            }
            console.log(`\n✅ ${ok} instrucciones corregidas${fail > 0 ? `, ${fail} errores` : ''}`)
        } else {
            console.log(`\n🏁 DRY RUN — No se aplicaron cambios.`)
        }
    } else {
        console.log(`\n✅ No hay instrucciones que corregir.`)
    }

    return { corregidas, totalMal: corregidas }
}

// ── FASE 2: Enriquecer alimentos base ──────────────────────────
async function fase2() {
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  FASE 2 — Enriquecer alimentos base con macros')
    console.log('═══════════════════════════════════════════════════════\n')

    const { data: ingredientesConAlimento, error: e1 } = await supabase
        .from('receta_ingredientes')
        .select('alimento_id, cantidad_gramos, receta_id')
        .not('alimento_id', 'is', null)

    if (e1) {
        console.error('❌ Error al obtener ingredientes:', e1.message)
        return { enriquecidos: 0 }
    }

    // IDs únicos de alimentos usados en recetas
    const alimentoIdsUsados = [...new Set(ingredientesConAlimento.map(i => i.alimento_id).filter(Boolean))]

    const { data: alimentosUsados, error: e2 } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
        .in('id', alimentoIdsUsados)

    if (e2) {
        console.error('❌ Error al obtener alimentos:', e2.message)
        return { enriquecidos: 0 }
    }

    console.log(`📊 Alimentos diferentes usados en recetas: ${alimentosUsados.length}`)

    // Alimentos con calorias=0 (o null) que aparecen en recetas
    const ceroCalorias = alimentosUsados.filter(a => !a.calorias || a.calorias === 0)
    console.log(`   Con calorias=0: ${ceroCalorias.length}`)

    // Mostrar todos para transparencia
    if (ceroCalorias.length > 0) {
        console.log(`\n📋 Alimentos con calorias=0 en recetas:`)
        for (const a of ceroCalorias) {
            console.log(`   - ${a.nombre}`)
        }
    }

    // Buscar match con nuestra tabla de macros usando el nuevo buscador
    const enriquecibles = []
    for (const alimento of ceroCalorias) {
        const match = buscarMatchAlimento(alimento.nombre)
        if (match) {
            enriquecibles.push({
                ...alimento,
                matchKey: match.nombre,
                nuevosMacros: {
                    calorias: match.calorias,
                    proteinas: match.proteinas,
                    carbohidratos: match.carbohidratos,
                    grasas: match.grasas,
                    fibra: match.fibra,
                }
            })
        }
    }

    console.log(`\n   Enriquecibles (match encontrado): ${enriquecibles.length}`)

    // Mostrar los que NO tienen match
    const sinMatch = ceroCalorias.filter(a =>
        !enriquecibles.some(e => e.id === a.id)
    )
    if (sinMatch.length > 0) {
        console.log(`\n⚠️  Sin datos para enriquecer (${sinMatch.length}):`)
        for (const a of sinMatch) {
            console.log(`   - ${a.nombre}`)
        }
        console.log(`   ℹ️  Si son correctos (sal, bicarbonato, edulcorante), ya deberían estar cubiertos.`)
    }

    if (enriquecibles.length > 0) {
        console.log(`\n📋 Alimentos a enriquecer:`)
        for (const a of enriquecibles) {
            console.log(`   - ${a.nombre} → match: "${a.matchKey}"`)
            console.log(`     → kcal: ${a.nuevosMacros.calorias}, P: ${a.nuevosMacros.proteinas}, HC: ${a.nuevosMacros.carbohidratos}, G: ${a.nuevosMacros.grasas}`)
        }

        if (!DRY_RUN) {
            console.log(`\n🔄 Aplicando enriquecimiento...`)
            let ok = 0, fail = 0
            for (const a of enriquecibles) {
                const { error: upErr } = await supabase
                    .from('alimentos')
                    .update({
                        calorias: a.nuevosMacros.calorias,
                        proteinas: a.nuevosMacros.proteinas,
                        carbohidratos: a.nuevosMacros.carbohidratos,
                        grasas: a.nuevosMacros.grasas,
                        fibra: a.nuevosMacros.fibra,
                    })
                    .eq('id', a.id)

                if (upErr) {
                    console.error(`   ❌ ${a.nombre}: ${upErr.message}`)
                    fail++
                } else {
                    console.log(`   ✅ ${a.nombre} → ${a.nuevosMacros.calorias} kcal`)
                    ok++
                }
            }
            console.log(`\n✅ ${ok} alimentos enriquecidos${fail > 0 ? `, ${fail} errores` : ''}`)
        } else {
            console.log(`\n🏁 DRY RUN — No se aplicaron cambios.`)
        }
    } else {
        console.log(`\n✅ No hay alimentos que enriquecer.`)
    }

    return { enriquecidos: enriquecibles.length }
}

// ── FASE 3: Recalcular macros de todas las recetas ─────────────
async function fase3() {
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  FASE 3 — Recalcular macros de TODAS las recetas')
    console.log('═══════════════════════════════════════════════════════\n')

    const { data: recetas, error } = await supabase
        .from('recetas')
        .select('id, nombre, kcal, proteinas, carbohidratos, grasas, fibra, porciones, peso_total_g')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('❌ Error al obtener recetas:', error.message)
        return { recalculadas: 0, conError: 0 }
    }

    console.log(`📊 Total recetas: ${recetas.length}`)

    let recalculadas = 0
    let sinIngredientes = 0
    let sinAlimentos = 0
    let conError = 0
    const discrepancias = []
    const actualizaciones = []

    for (const receta of recetas) {
        // Obtener ingredientes
        const { data: ings, error: eIng } = await supabase
            .from('receta_ingredientes')
            .select('id, alimento_id, cantidad_gramos, nombre_libre')
            .eq('receta_id', receta.id)

        if (eIng) {
            console.error(`   ❌ Error ingredientes para ${receta.nombre}: ${eIng.message}`)
            conError++
            continue
        }

        if (!ings || ings.length === 0) {
            sinIngredientes++
            continue
        }

        // Obtener alimentos vinculados
        const alimentoIds = [...new Set(ings.map(i => i.alimento_id).filter(Boolean))]
        if (alimentoIds.length === 0) {
            sinAlimentos++
            continue
        }

        const { data: alims } = await supabase
            .from('alimentos')
            .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
            .in('id', alimentoIds)

        if (!alims || alims.length === 0) {
            sinAlimentos++
            continue
        }

        const alimentoMap = Object.fromEntries(alims.map(a => [a.id, a]))
        const porciones = receta.porciones || 1

        let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0, totalFibra = 0
        let pesoTotalCalc = 0

        for (const ing of ings) {
            if (!ing.alimento_id || !alimentoMap[ing.alimento_id]) continue
            const a = alimentoMap[ing.alimento_id]
            const factor = (ing.cantidad_gramos || 0) / 100
            totalKcal += (a.calorias || 0) * factor
            totalProt += (a.proteinas || 0) * factor
            totalCarbs += (a.carbohidratos || 0) * factor
            totalGrasas += (a.grasas || 0) * factor
            totalFibra += (a.fibra || 0) * factor
            pesoTotalCalc += (ing.cantidad_gramos || 0)
        }

        if (totalKcal === 0) continue // Sin macros calculables

        const porcion = {
            kcal: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas: Math.round((totalProt / porciones) * 100) / 100,
            carbohidratos: Math.round((totalCarbs / porciones) * 100) / 100,
            grasas: Math.round((totalGrasas / porciones) * 100) / 100,
            fibra: Math.round((totalFibra / porciones) * 100) / 100,
        }

        // Verificar si hay discrepancia > 2%
        const diffKcal = Math.abs(porcion.kcal - (receta.kcal || 0))
        const diffPct = receta.kcal > 0 ? (diffKcal / receta.kcal) * 100 : (porcion.kcal > 0 ? 100 : 0)

        if (diffPct > 2) {
            discrepancias.push({
                nombre: receta.nombre,
                kcalBD: receta.kcal,
                kcalCalc: porcion.kcal,
                diffPct: Math.round(diffPct * 10) / 10,
                porciones
            })
        }

        actualizaciones.push({
            id: receta.id,
            nombre: receta.nombre,
            ...porcion,
            peso_total_g: Math.round(pesoTotalCalc * 100) / 100
        })
        recalculadas++
    }

    console.log(`\n📊 Diagnóstico:`)
    console.log(`   ✅ Recetas con ingredientes: ${recalculadas}`)
    console.log(`   ⚠️  Sin ingredientes: ${sinIngredientes}`)
    console.log(`   ⚠️  Sin alimentos vinculados: ${sinAlimentos}`)

    if (discrepancias.length > 0) {
        console.log(`\n⚠️  Recetas con discrepancia >2% (se actualizarán): ${discrepancias.length}`)
        const top15 = discrepancias.slice(0, 15)
        for (const d of top15) {
            console.log(`   - ${d.nombre}: BD=${d.kcalBD} → Calc=${d.kcalCalc} kcal (${d.diffPct}%) porciones=${d.porciones}`)
        }
        if (discrepancias.length > 15) {
            console.log(`   ... y ${discrepancias.length - 15} más`)
        }
    }

    if (actualizaciones.length > 0) {
        if (!DRY_RUN) {
            console.log(`\n🔄 Actualizando ${actualizaciones.length} recetas...`)
            let ok = 0, fail = 0

            // Actualizar en lotes de 10 para no saturar la API
            const BATCH = 10
            for (let i = 0; i < actualizaciones.length; i += BATCH) {
                const batch = actualizaciones.slice(i, i + BATCH)
                process.stdout.write(`   Lote ${Math.floor(i / BATCH) + 1}/${Math.ceil(actualizaciones.length / BATCH)}... `)

                // Actualizar una por una para mejor control de errores
                let batchOk = 0
                for (const act of batch) {
                    const { error: upErr } = await supabase
                        .from('recetas')
                        .update({
                            kcal: act.kcal,
                            proteinas: act.proteinas,
                            carbohidratos: act.carbohidratos,
                            grasas: act.grasas,
                            fibra: act.fibra,
                            peso_total_g: act.peso_total_g,
                        })
                        .eq('id', act.id)

                    if (!upErr) batchOk++
                }
                console.log(`${batchOk}/${batch.length} OK`)
                ok += batchOk
                fail += batch.length - batchOk
            }

            console.log(`\n✅ ${ok} recetas actualizadas${fail > 0 ? `, ${fail} errores` : ''}`)
        } else {
            console.log(`\n🏁 DRY RUN — No se aplicaron cambios.`)
        }
    }

    return { recalculadas, discrepancias: discrepancias.length, conError }
}

// ── Main ───────────────────────────────────────────────────────
async function main() {
    console.log('╔══════════════════════════════════════════════════════╗')
    console.log('║     FIX COMPLETO DE RECETAS                         ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log(`   Supabase URL: ${env.NEXT_PUBLIC_SUPABASE_URL}`)
    console.log(`   Modo: ${DRY_RUN ? '🏁 DRY RUN (solo diagnóstico)' : '🚀 APLICANDO CAMBIOS'}`)
    if (FASE) console.log(`   Fase específica: ${FASE}`)

    const resultados = {}

    if (!FASE || FASE === 1) {
        resultados.fase1 = await fase1()
    }

    if (!FASE || FASE === 2) {
        resultados.fase2 = await fase2()
    }

    if (!FASE || FASE === 3) {
        resultados.fase3 = await fase3()
    }

    // Resumen final
    console.log('\n═══════════════════════════════════════════════════════')
    console.log('  RESUMEN FINAL')
    console.log('═══════════════════════════════════════════════════════\n')

    if (resultados.fase1) {
        console.log(`📝 FASE 1 — Instrucciones: ${resultados.fase1.corregidas} corregidas`)
    }
    if (resultados.fase2) {
        console.log(`🥦 FASE 2 — Alimentos: ${resultados.fase2.enriquecidos} enriquecidos`)
    }
    if (resultados.fase3) {
        console.log(`📊 FASE 3 — Recetas: ${resultados.fase3.recalculadas} recalculadas, ${resultados.fase3.discrepancias} con cambios`)
    }

    if (DRY_RUN) {
        console.log(`\n🏁 DRY RUN completado — Ningún cambio aplicado.`)
        console.log(`   Ejecuta sin --dry-run para aplicar los cambios.`)
    } else {
        console.log(`\n✅ Fix completado!`)
    }

    console.log('')
}

main().catch(console.error)

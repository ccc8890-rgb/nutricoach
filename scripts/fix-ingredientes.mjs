#!/usr/bin/env node
/**
 * fix-ingredientes.mjs
 *
 * CORRIGE dos problemas en receta_ingredientes:
 *   1. Ingredientes huérfanos (sin alimento_id) → linkea contra alimentos table
 *   2. Links incorrectos (bajo overlap nombre_libre vs alimento_nombre) → re-linkea
 *
 * USO:
 *   node scripts/fix-ingredientes.mjs              → modo diagnóstico (no escribe)
 *   node scripts/fix-ingredientes.mjs --ejecutar   → aplica cambios
 *   node scripts/fix-ingredientes.mjs --report     → solo genera reporte
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAÍZ = resolve(__dirname, '..')

// ── Cargar .env.local ──────────────────────────────────
function loadEnv() {
    const envPath = resolve(RAÍZ, '.env.local')
    if (!existsSync(envPath)) return
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const i = t.indexOf('=')
        if (i === -1) continue
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
)

const EJECUTAR = process.argv.includes('--ejecutar')
const SOLO_REPORT = process.argv.includes('--report')

// ── Utilidades ──────────────────────────────────────────
function normalizar(s) {
    return s.toLowerCase().trim().replace(/[^a-záéíóúñü0-9\s]/g, '').replace(/\s+/g, ' ')
}

function quitarParentesis(s) {
    return s.replace(/\([^)]*\)/g, '').trim()
}

function palabras(s) {
    return normalizar(s).split(/\s+/).filter(w => w.length > 1)
}

function overlap(libre, alimento) {
    const lp = palabras(libre)
    const ap = palabras(alimento)
    if (lp.length === 0 || ap.length === 0) return 0
    const comunes = lp.filter(w => ap.includes(w))
    return comunes.length / Math.max(lp.length, ap.length)
}

function acentos(s) {
    const mapa = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n' }
    return s.toLowerCase().replace(/[áéíóúüñ]/g, c => mapa[c] || c)
}

// ── Mapa manual para casos difíciles ────────────────────
const MANUAL_MAP = {
    // Lácteos
    'leche entera': 'Leche entera',
    'leche': 'Leche entera',
    'huevo entero': 'Huevo M',
    'huevos': 'Huevo M',
    'huevo': 'Huevo M',
    'queso feta': 'Queso burgos',
    'queso': 'Queso cottage',
    'yogur natural': 'Yogur natural desnatado',
    'crema de leche': 'Nata para cocinar (18%)',
    // Harinas
    'harina de avena': 'Harina de avena',
    'harina de trigo': 'Harina de avena',
    'harina de almendra': 'Almendra cruda',
    'harina de almendras': 'Almendra cruda',
    'harina': 'Harina de avena',
    'levadura química': 'levadura química',
    'levadura': 'levadura química',
    'maicena': 'maicena',
    'avena en copos': 'Avena (copos)',
    // Frutas/verduras
    'judías negras cocidas': 'Judías negras (cocidas)',
    'boniato crudo': 'Boniato (crudo)',
    'huevo entero': 'Huevo M',
    'lechuga': 'Lechuga romana',
    'tomate': 'Tomate natural',
    // Carnes
    'pechuga de pollo cruda': 'Pechuga de pollo (cruda)',
    'pechuga de pollo': 'Pechuga de pollo (cruda)',
    'pollo': 'Pechuga de pollo (cruda)',
    'carne picada de ternera (5% grasa)': 'Carne picada de ternera (5% grasa)',
    // Especias
    'canela molida': 'canela molida',
    'canela': 'canela molida',
    'comino molido': 'comino molido',
    'pimenton dulce': 'pimentón dulce',
    'pimenton': 'pimentón dulce',
    'pimienta negra': 'pimienta',
    'pimienta': 'pimienta',
    'orégano': 'orégano',
    'perejil': 'perejil',
    'romero': 'romero',
    'ajo en polvo': 'Ajo crudo',
    'jengibre': 'Jengibre fresco',
    'cebolla': 'Cebolla',
    'zanahoria': 'Zanahoria (cruda)',
    // Especiales
    'caseína micelar en polvo': 'Caseína micelar (polvo)',
    'proteína de caseína micelar en polvo': 'Caseína micelar (polvo)',
    'proteína en polvo sabor vainilla': 'Avena con proteína (polvo)',
    'proteína en polvo sabor chocolate': 'Proteína en polvo sabor chocolate',
    'proteína en polvo': 'Avena con proteína (polvo)',
    'proteína whey en polvo': 'Avena con proteína (polvo)',
    'proteína en polvo sabor vainilla o neutro': 'Avena con proteína (polvo)',
    'esencia de vainilla': 'Avena (copos)',
    'Esencia de vainilla': 'Avena (copos)',
    'extracto de vainilla': 'Avena (copos)',
    'Extracto de vainilla': 'Avena (copos)',
    'arroz integral crudo': 'Arroz integral (crudo)',
    'albahaca seca': 'Albahaca seca',
    'albahaca fresca': 'perejil',
    'avena en copos': 'Avena (copos)',
    'avena (copos)': 'Avena (copos)',
    'Avena (copos)': 'Avena (copos)',
    'Avena en hojuelas': 'Avena (copos)',
    'avena en hojuelas': 'Avena (copos)',
    'crema de avellana sin azúcar': 'Crema de cacahuete (sin azúcar)',
    'crema agria o yogur griego': 'Yogur griego natural (0%)',
    'mantequilla de cacahuete sin azúcar': 'Crema de cacahuete (sin azúcar)',
    'pasta de maní natural': 'Crema de cacahuete (natural)',
    // Más huérfanos
    'arándanos secos': 'Arándanos',
    'arándanos frescos': 'Arándanos',
    'claras de huevo': 'Clara de huevo',
    'clara de huevo': 'Clara de huevo',
    'huevo cocido': 'Huevo M',
    'huevo pochado (huevo entero)': 'Huevo M',
    'huevo (entero)': 'Huevo M',
    'Huevo duro': 'Huevo M',
    'Yema de huevo': 'Huevo M',
    'levadura química (polvo para hornear)': 'levadura química',
    'polvo de hornear': 'levadura química',
    'queso mascarpone': 'Queso crema light',
    'queso cheddar': 'Queso burgos',
    'queso feta': 'Queso burgos',
    'queso rallado (mezcla)': 'Queso rallado (mezcla)',
    'fresas frescas': 'Fresa',
    'Frutos rojos congelados': 'Arándanos',
    'Almendras molidas': 'Almendra cruda',
    'harina de almendra': 'Almendra cruda',
    'harina de trigo': 'Harina de avena',
    'Harina de trigo': 'Harina de avena',
    'Yufka (masa para rollos)': 'Pan de pita',
    'Malvaviscos mini': 'Arroz blanco (crudo)',
    'Cereal de arroz con chocolate (Cocoa Krispies)': 'Arroz blanco (crudo)',
    'arroz para sushi': 'Arroz blanco (crudo)',
    'ajetes': 'Ajo crudo',
    'ajete': 'Ajo crudo',
    'condimento BBQ': 'pimienta',
    'garbanzos cocidos': 'Garbanzos cocidos',
    'Tortilla de trigo (wrap)': 'Pan de pita',
    'Tortilla de trigo': 'Pan de pita',
    'Aderezo César': 'Mayonesa light',
    'Leche evaporada light': 'Leche semidesnatada',
    'Leche condensada light': 'Leche semidesnatada',
    'calabaza butternut': 'Boniato (crudo)',
    'guindilla o cayena (opcional)': 'pimienta',
    'Hojuelas de chile': 'pimienta',
    'Chile en hojuelas': 'pimienta',
    'chili flakes': 'pimienta',
    'vinagre balsámico': 'Vinagre de manzana',
    'Cebolla roja': 'Cebolla',
    'Tomates secos': 'Tomate cherry',
    'fideos udón secos': 'Pasta (seca)',
    'caldo de pollo (brick)': 'Caldo de pollo (brick)',
    'coco rallado': 'Aceite de coco',
    'coco rallado deshidratado': 'Aceite de coco',
    'concentrado de caldo de vacuno': 'Caldo de pollo (brick)',
    'Pasta de curry rojo': 'pimienta',
    'Pan rallado': 'Pan de molde blanco',
    'Crema de leche (nata)': 'Nata para cocinar (18%)',
    'Cebolla (chalotas)': 'Cebolla',
    'endulzante sin calorías': 'edulcorante',
    'fresas liofilizadas': 'Fresa',
    'Vodka': 'Agua con gas',
    'espinacas crudas': 'Espinacas (crudas)',
    'pollo picado (pechuga, sin grasa)': 'Pechuga de pollo (cruda)',
    'zucchini': 'Calabacín',
    'mirin': 'Vinagre de manzana',
    'harina de avena': 'Harina de avena',
    'Leche entera': 'Leche entera',
    'Queso feta': 'Queso burgos',
    'Harina de avena': 'Harina de avena',
    'Levadura química': 'levadura química',
    'boniato': 'Boniato (crudo)',
    'setas': 'Champiñones',
    'espinacas': 'Espinacas (crudas)',
    // Links incorrectos detectados
    'miel': 'Miel',
    'sésamo': 'Sésamo',
    'limón': 'Limón',
    'cebolla caramelizada': 'Cebolla caramelizada',
}

// ── Estrategias de matching ──────────────────────────
async function buscarAlimento(nombreLimpio, allAlimentos) {
    const n = normalizar(nombreLimpio)
    const nSinParens = normalizar(quitarParentesis(nombreLimpio))
    const nAcentos = acentos(nombreLimpio)
    const nAcentosSinParens = acentos(quitarParentesis(nombreLimpio))

    // 1. Manual map
    if (MANUAL_MAP[nombreLimpio.trim()]) {
        const target = MANUAL_MAP[nombreLimpio.trim()]
        const found = allAlimentos.find(a => a.nombre === target)
        if (found) return { match: found, via: 'manual' }
    }

    // 2. Exact match (case-insensitive)
    let match = allAlimentos.find(a => normalizar(a.nombre) === n || normalizar(quitarParentesis(a.nombre)) === n)
    if (match) return { match, via: 'exact' }

    // 3. Exact match sin paréntesis
    match = allAlimentos.find(a => normalizar(a.nombre) === nSinParens || normalizar(quitarParentesis(a.nombre)) === nSinParens)
    if (match) return { match, via: 'exact-sin-parens' }

    // 4. Sin acentos
    match = allAlimentos.find(a => acentos(a.nombre) === nAcentos || acentos(quitarParentesis(a.nombre)) === nAcentos)
    if (match) return { match, via: 'sin-acentos' }

    // 5. Sin acentos + sin paréntesis
    match = allAlimentos.find(a => acentos(a.nombre) === nAcentosSinParens || acentos(quitarParentesis(a.nombre)) === nAcentosSinParens)
    if (match) return { match, via: 'sin-acentos-sin-parens' }

    // 6. Fuzzy: high overlap (>60%)
    const lp = palabras(nombreLimpio)
    for (const a of allAlimentos) {
        const ap = palabras(a.nombre)
        const comunes = lp.filter(w => ap.includes(w))
        const ratio = comunes.length / Math.max(lp.length, ap.length)
        if (ratio >= 0.6) return { match: a, via: `fuzzy(${ratio.toFixed(2)})`, score: ratio }
    }

    return null
}

// ── CORREGIR links incorrectos ──────────────────────────
async function corregirLinksIncorrectos(allAlimentos) {
    console.log('\n=== FASE 1: CORREGIR LINKS INCORRECTOS ===')

    const { data: ingredientes } = await supabase
        .from('receta_ingredientes')
        .select('id, receta_id, nombre_libre, alimento_id, cantidad_gramos')
        .not('alimento_id', 'is', null)

    if (!ingredientes) { console.log('  No se pudieron obtener ingredientes'); return 0 }

    let corregidos = 0
    let revisados = 0

    for (const ing of ingredientes) {
        const alimento = allAlimentos.find(a => a.id === ing.alimento_id)
        if (!alimento) continue

        const ov = overlap(ing.nombre_libre, alimento.nombre)
        revisados++

        if (ov < 0.3) {
            // Buscar mejor match
            const mejor = await buscarAlimento(ing.nombre_libre, allAlimentos)
            if (mejor && mejor.match.id !== ing.alimento_id) {
                console.log(`  ❌ "${ing.nombre_libre}" → "${alimento.nombre}" (overlap:${ov.toFixed(2)})`)
                console.log(`     ✅ Mejor: "${mejor.match.nombre}" (via: ${mejor.via})`)

                if (EJECUTAR) {
                    const { error } = await supabase
                        .from('receta_ingredientes')
                        .update({ alimento_id: mejor.match.id })
                        .eq('id', ing.id)
                    if (error) console.log(`     ⚠️ Error: ${error.message}`)
                    else corregidos++
                } else {
                    corregidos++
                }
            }
        }
    }

    console.log(`\n  Revisados: ${revisados} links`)
    console.log(`  Corregidos: ${corregidos}${EJECUTAR ? '' : ' (modo diagnóstico)'}`)
    return corregidos
}

// ── FIX HUÉRFANOS ──────────────────────────────────────
async function fixOrfanos(allAlimentos) {
    console.log('\n=== FASE 2: FIX HUÉRFANOS (sin alimento_id) ===')

    const { data: orphanIds, error } = await supabase
        .from('receta_ingredientes')
        .select('id')
        .is('alimento_id', null)

    if (error || !orphanIds) { console.log('  Error:', error?.message); return 0 }

    const orphanDetailIds = orphanIds.map(r => r.id)
    console.log(`  Huérfanos totales: ${orphanDetailIds.length}`)

    let linkeados = 0
    let sinMatch = 0

    for (let i = 0; i < orphanDetailIds.length; i++) {
        const { data: ing } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, cantidad_gramos')
            .eq('id', orphanDetailIds[i])
            .single()

        if (!ing) continue

        const nombre = ing.nombre_libre.trim()
        if (!nombre || ['sal', 'sal y pimienta al gusto', 'pimienta', 'para las verduras al horno',
            'para la salsa chipotle casera', 'para las alubias especiadas', 'para el montaje',
            'aceite de oliva en spray', 'zumo de 1 lima'].includes(normalizar(nombre))) {
            continue
        }

        const resultado = await buscarAlimento(nombre, allAlimentos)
        if (resultado) {
            if (EJECUTAR) {
                const { error: upErr } = await supabase
                    .from('receta_ingredientes')
                    .update({ alimento_id: resultado.match.id })
                    .eq('id', ing.id)
                if (upErr) console.log(`  ⚠️ Error actualizando "${nombre}": ${upErr.message}`)
                else linkeados++
            } else {
                linkeados++
            }
            if (!EJECUTAR && linkeados <= 5) {
                console.log(`  ✅ "${nombre}" → "${resultado.match.nombre}" (via: ${resultado.via})`)
            }
        } else {
            sinMatch++
            if (sinMatch <= 5) {
                console.log(`  ❌ "${nombre}" — sin match en alimentos table`)
            }
        }

        if ((i + 1) % 50 === 0) process.stdout.write(`  Progreso: ${i + 1}/${orphanDetailIds.length} (linkeados: ${linkeados}, sin match: ${sinMatch})\r`)
    }

    console.log(`\n  Linkeados: ${linkeados}${EJECUTAR ? '' : ' (modo diagnóstico)'}`)
    console.log(`  Sin match: ${sinMatch}`)
    return linkeados
}

// ── RECALCULAR macros ──────────────────────────────────
async function recalcularMacros(recetaIds) {
    if (!EJECUTAR) return
    console.log('\n=== FASE 3: RECALCULAR MACROS ===')

    for (const rid of recetaIds) {
        const { data: ingredientes } = await supabase
            .from('receta_ingredientes')
            .select('alimento_id, cantidad_gramos, alimentos!inner(calorias, proteinas, carbohidratos, grasas, fibra)')
            .eq('receta_id', rid)

        const { data: receta } = await supabase
            .from('recetas')
            .select('nombre, porciones')
            .eq('id', rid)
            .single()
        if (!receta) continue

        let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalFibra = 0
        for (const ing of ingredientes || []) {
            const al = ing.alimentos
            if (al && ing.cantidad_gramos > 0) {
                const f = ing.cantidad_gramos / 100
                totalKcal += (al.calorias || 0) * f
                totalP += (al.proteinas || 0) * f
                totalC += (al.carbohidratos || 0) * f
                totalG += (al.grasas || 0) * f
                totalFibra += (al.fibra || 0) * f
            }
        }

        const porciones = receta.porciones || 1
        await supabase.from('recetas').update({
            kcal: Math.round(totalKcal * 100) / 100,
            proteinas: Math.round(totalP * 100) / 100,
            carbohidratos: Math.round(totalC * 100) / 100,
            grasas: Math.round(totalG * 100) / 100,
            fibra: Math.round(totalFibra * 100) / 100,
            kcal_por_porcion: Math.round((totalKcal / porciones) * 100) / 100,
            proteinas_por_porcion: Math.round((totalP / porciones) * 100) / 100,
            carbohidratos_por_porcion: Math.round((totalC / porciones) * 100) / 100,
            grasas_por_porcion: Math.round((totalG / porciones) * 100) / 100,
        }).eq('id', rid)

        console.log(`  📊 ${receta.nombre || rid.slice(0, 8)}: ${Math.round(totalKcal)} kcal (${Math.round(totalKcal / porciones)}/porción)`)
    }
}

// ── MAIN ────────────────────────────────────────────────
async function main() {
    console.log('🧬 fix-ingredientes.mjs')
    console.log(`   Modo: ${EJECUTAR ? '🟢 EJECUTAR (escribe en BD)' : '🟡 DIAGNÓSTICO (solo lectura)'}\n`)

    if (EJECUTAR && !process.argv.includes('--confirmar')) {
        console.log('⚠️  Para ejecutar, añade --confirmar también:\n   node scripts/fix-ingredientes.mjs --ejecutar --confirmar\n')
        process.exit(0)
    }

    // Cargar todos los alimentos una vez
    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre')
    if (!allAlimentos) { console.error('❌ No se pudieron cargar alimentos'); process.exit(1) }
    console.log(`📦 Alimentos en BD: ${allAlimentos.length}`)

    // FASE 1: Corregir links incorrectos
    const corregidos = await corregirLinksIncorrectos(allAlimentos)

    // FASE 2: Linkear huérfanos
    const linkeados = await fixOrfanos(allAlimentos)

    // FASE 3: Recalcular macros (solo si ejecutamos)
    if (EJECUTAR) {
        const { data: afectadas } = await supabase
            .from('receta_ingredientes')
            .select('receta_id')
            .in('receta_id',
                (await supabase.from('receta_ingredientes').select('receta_id').is('alimento_id', null)).data?.map(r => r.receta_id) || []
            )

        const ids = [...new Set((afectadas || []).map(r => r.receta_id))]
        await recalcularMacros(ids)
    }

    console.log('\n═══════════════════════════════════')
    console.log(`  ✅ Links incorrectos corregidos: ${corregidos}`)
    console.log(`  ✅ Huérfanos linkeados: ${linkeados}`)
    console.log(`  📋 Total alimentos en BD: ${allAlimentos.length}`)
    if (!EJECUTAR) {
        console.log('\n  Para aplicar cambios:')
        console.log('  node scripts/fix-ingredientes.mjs --ejecutar --confirmar')
    }
    console.log('═══════════════════════════════════\n')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

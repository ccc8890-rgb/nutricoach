#!/usr/bin/env node
/**
 * fix-cebolla-y-similares.mjs
 *
 * Corrige casos donde ingredientes de una sola palabra (cebolla, ajo, etc.)
 * se vincularon al primer ILIKE match incorrecto (ej: "Cebolla en polvo")
 * en lugar del alimento base apropiado (ej: "Cebolla cruda").
 *
 * Uso:
 *   node scripts/fix-cebolla-y-similares.mjs            → diagnóstico
 *   node scripts/fix-cebolla-y-similares.mjs --ejecutar  → aplica
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

// Mapa de correcciones manuales: nombre_libre → alimento_nombre correcto
const CORRECCIONES = {
    'cebolla': 'Cebolla cruda',
    'ajo': 'Ajo crudo',
    'huevo': 'Huevo M',
    'fresa': 'Fresa',
    'arándanos': 'Arándanos',
    'miel': 'Miel',
    'sésamo': 'Sésamo',
    'limón': 'limón',
    'zanahoria': 'Zanahoria (cruda)',
}

async function main() {
    console.log('🔍 fix-cebolla-y-similares.mjs — Diagnóstico de vinculaciones incorrectas\n')

    // Cargar todos los alimentos
    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre')
    if (!allAlimentos) { console.error('❌ No se pudieron cargar alimentos'); process.exit(1) }

    // Crear mapa nombre → id
    const alimentoMap = {}
    for (const a of allAlimentos) {
        alimentoMap[a.nombre] = a.id
    }

    let totalCorregidos = 0
    const recetasAfectadas = new Set()

    for (const [nombreLibre, targetNombre] of Object.entries(CORRECCIONES)) {
        const targetId = alimentoMap[targetNombre]
        if (!targetId) {
            console.log(`⚠️  No se encuentra "${targetNombre}" en alimentos, se omite`)
            continue
        }

        // Buscar todos los registros con este nombre_libre
        const { data: registros } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, alimento_id')
            .ilike('nombre_libre', nombreLibre)

        if (!registros || registros.length === 0) {
            console.log(`   "${nombreLibre}": 0 registros — ok`)
            continue
        }

        // Filtrar los que NO apuntan ya al target correcto
        const malos = registros.filter(r => r.alimento_id !== targetId)
        const buenos = registros.filter(r => r.alimento_id === targetId)

        if (malos.length === 0) {
            console.log(`   ✅ "${nombreLibre}": ${registros.length} registros, todos correctos → "${targetNombre}"`)
            continue
        }

        console.log(`\n   🔴 "${nombreLibre}": ${malos.length}/${registros.length} mal vinculados`)
        for (const m of malos) {
            const oldName = allAlimentos.find(a => a.id === m.alimento_id)?.nombre || 'DESCONOCIDO'
            console.log(`      ID ${m.id.slice(0, 8)}: "${oldName}" → "${targetNombre}" (receta ${m.receta_id.slice(0, 8)})`)
            recetasAfectadas.add(m.receta_id)

            if (EJECUTAR) {
                const { error } = await supabase
                    .from('receta_ingredientes')
                    .update({ alimento_id: targetId })
                    .eq('id', m.id)

                if (error) {
                    console.log(`        ❌ Error: ${error.message}`)
                }
            }
        }
        totalCorregidos += malos.length
    }

    // ── Recalcular macros ──
    if (EJECUTAR && recetasAfectadas.size > 0) {
        console.log(`\n📊 Recalculando macros para ${recetasAfectadas.size} recetas...`)
        for (const rid of recetasAfectadas) {
            // Obtener todos los ingredientes de la receta con sus alimentos
            const { data: ings } = await supabase
                .from('receta_ingredientes')
                .select('cantidad_gramos, alimento_id')
                .eq('receta_id', rid)

            if (!ings || ings.length === 0) continue

            // Obtener datos nutricionales de los alimentos
            const alIds = [...new Set(ings.map(i => i.alimento_id).filter(Boolean))]
            const { data: alimentos } = await supabase
                .from('alimentos')
                .select('id, kcal, proteinas, carbohidratos, grasas, fibra')
                .in('id', alIds)

            if (!alimentos) continue

            const alMap = {}
            for (const al of alimentos) alMap[al.id] = al

            let totalKcal = 0, totalP = 0, totalC = 0, totalG = 0, totalFibra = 0
            for (const ing of ings) {
                if (!ing.alimento_id || !ing.cantidad_gramos) continue
                const al = alMap[ing.alimento_id]
                if (!al) continue
                const f = ing.cantidad_gramos / 100
                totalKcal += (al.kcal || 0) * f
                totalP += (al.proteinas || 0) * f
                totalC += (al.carbohidratos || 0) * f
                totalG += (al.grasas || 0) * f
                totalFibra += (al.fibra || 0) * f
            }

            const { data: receta } = await supabase
                .from('recetas')
                .select('nombre, porciones')
                .eq('id', rid)
                .single()

            if (!receta) continue

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

            console.log(`   📊 ${receta.nombre || rid.slice(0, 8)}: ${Math.round(totalKcal)} kcal`)
        }
    }

    console.log('\n═══════════════════════════════════')
    console.log(`  Total corregidos: ${totalCorregidos}`)
    console.log(`  Recetas afectadas: ${recetasAfectadas.size}`)
    if (!EJECUTAR) {
        console.log('\n  Para aplicar: node scripts/fix-cebolla-y-similares.mjs --ejecutar')
    }
    console.log('═══════════════════════════════════\n')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

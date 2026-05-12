#!/usr/bin/env node
/**
 * fix-miel-y-otros.mjs
 *
 * Corrige ingredientes cuyo nombre_libre es un nombre de alimento que
 * EXISTE en la tabla alimentos pero no se linkearon automáticamente.
 * 
 * Casos: "miel" → "Miel", "fresa" → "Fresa", "arándanos" → "Arándanos",
 * "sésamo" → "sésamo"
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

function loadEnv() {
    const envPath = resolve('.env.local')
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

const MAP = {
    'miel': 'Miel',
    'fresa': 'Fresa',
    'arándanos': 'Arándanos',
    'sésamo': 'sésamo',
}

async function main() {
    console.log('🔍 Estado de ingredientes que ya existen en alimentos pero no linkeados\n')

    const { data: allAlimentos } = await supabase.from('alimentos').select('id, nombre')
    if (!allAlimentos) { console.error('❌ No se pudieron cargar alimentos'); process.exit(1) }

    const alimentoMap = {}
    for (const a of allAlimentos) alimentoMap[a.nombre.toLowerCase()] = a

    let total = 0
    const recetasSet = new Set()

    for (const [nombreLibre, targetNombre] of Object.entries(MAP)) {
        const targetKey = targetNombre.toLowerCase()
        const target = alimentoMap[targetKey]

        if (!target) {
            console.log(`⚠️  No se encuentra "${targetNombre}" en alimentos — se omite`)
            continue
        }

        const { data: registros } = await supabase
            .from('receta_ingredientes')
            .select('id, receta_id, nombre_libre, alimento_id')
            .ilike('nombre_libre', nombreLibre)

        if (!registros || registros.length === 0) {
            console.log(`   "${nombreLibre}": 0 registros`)
            continue
        }

        const nulos = registros.filter(r => r.alimento_id === null)
        const malos = registros.filter(r => r.alimento_id !== null && r.alimento_id !== target.id)
        const buenos = registros.filter(r => r.alimento_id === target.id)

        if (nulos.length === 0 && malos.length === 0) {
            console.log(`   ✅ "${nombreLibre}": ${registros.length} registros, todos → "${targetNombre}"`)
            continue
        }

        if (nulos.length > 0) {
            console.log(`   🔴 "${nombreLibre}": ${nulos.length} nulos + ${malos.length} malos / ${registros.length} total`)
            for (const r of nulos) {
                console.log(`      ID ${r.id.slice(0, 8)}: null → "${targetNombre}" (receta ${r.receta_id.slice(0, 8)})`)
                if (EJECUTAR) {
                    await supabase.from('receta_ingredientes').update({ alimento_id: target.id }).eq('id', r.id)
                }
                recetasSet.add(r.receta_id)
                total++
            }
        }

        for (const r of malos) {
            const old = allAlimentos.find(a => a.id === r.alimento_id)?.nombre || 'DESC'
            console.log(`   🔴 ID ${r.id.slice(0, 8)}: "${old}" → "${targetNombre}"`)
            if (EJECUTAR) {
                await supabase.from('receta_ingredientes').update({ alimento_id: target.id }).eq('id', r.id)
            }
            recetasSet.add(r.receta_id)
            total++
        }
    }

    // Recalcular macros
    if (EJECUTAR && recetasSet.size > 0) {
        console.log(`\n📊 Recalculando macros para ${recetasSet.size} recetas...`)
        for (const rid of recetasSet) {
            const { data: ings } = await supabase
                .from('receta_ingredientes')
                .select('cantidad_gramos, alimento_id')
                .eq('receta_id', rid)

            if (!ings || ings.length === 0) continue

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

            const { data: receta } = await supabase.from('recetas').select('nombre, porciones').eq('id', rid).single()
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
    console.log(`  Total corregidos: ${total}`)
    console.log(`  Recetas afectadas: ${recetasSet.size}`)
    if (!EJECUTAR) {
        console.log('\n  Para aplicar: node scripts/fix-miel-y-otros.mjs --ejecutar')
    }
    console.log('═══════════════════════════════════\n')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

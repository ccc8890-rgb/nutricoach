#!/usr/bin/env node
/**
 * crear-alimentos-faltantes.mjs
 *
 * Para cada ingrediente huérfano (sin alimento_id en receta_ingredientes):
 * 1. Busca en alimentos existentes el mejor match (exacto, overlap)
 * 2. Si tiene entrada en MACROS_REF, CREA el alimento con esos macros
 * 3. Si no, intenta match parcial conservador
 *
 * USO:
 *   node scripts/crear-alimentos-faltantes.mjs            → diagnóstico
 *   node scripts/crear-alimentos-faltantes.mjs --ejecutar  → crear+linkear
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

// Macros de referencia por 100g (BEDCA). 
// SÓLO para nombres que NO existen en BD pero DEBERÍAN existir como genéricos.
const MACROS_REF = {
    'Leche entera': { calorias: 66, proteinas: 3.2, carbohidratos: 4.7, grasas: 3.6, fibra: 0, categoria: 'Lácteos' },
    'Harina de trigo': { calorias: 344, proteinas: 10.3, carbohidratos: 71.5, grasas: 1.2, fibra: 3.9, categoria: 'Harinas y cereales' },
    'Avena en copos': { calorias: 366, proteinas: 13.2, carbohidratos: 66.3, grasas: 6.5, fibra: 10.3, categoria: 'Harinas y cereales' },
    'Avena en hojuelas': { calorias: 366, proteinas: 13.2, carbohidratos: 66.3, grasas: 6.5, fibra: 10.3, categoria: 'Harinas y cereales' },
    'Avena (copos)': { calorias: 366, proteinas: 13.2, carbohidratos: 66.3, grasas: 6.5, fibra: 10.3, categoria: 'Harinas y cereales' },
    'Espinacas crudas': { calorias: 23, proteinas: 2.9, carbohidratos: 1.4, grasas: 0.4, fibra: 2.2, categoria: 'Verduras y hortalizas' },
    'Arándanos frescos': { calorias: 57, proteinas: 0.7, carbohidratos: 14.5, grasas: 0.3, fibra: 2.4, categoria: 'Frutas' },
    'Arándanos secos': { calorias: 317, proteinas: 2.5, carbohidratos: 78.0, grasas: 0.8, fibra: 5.0, categoria: 'Frutas deshidratadas' },
    'Fresas frescas': { calorias: 32, proteinas: 0.7, carbohidratos: 7.7, grasas: 0.3, fibra: 2.0, categoria: 'Frutas' },
    'Fresas liofilizadas': { calorias: 342, proteinas: 5.5, carbohidratos: 78.0, grasas: 1.5, fibra: 12.0, categoria: 'Frutas deshidratadas' },
    'Frutos rojos congelados': { calorias: 50, proteinas: 0.8, carbohidratos: 11.5, grasas: 0.3, fibra: 3.0, categoria: 'Frutas congeladas' },
    'Coco rallado': { calorias: 660, proteinas: 6.9, carbohidratos: 23.7, grasas: 64.5, fibra: 16.3, categoria: 'Frutos secos' },
    'Coco rallado deshidratado': { calorias: 660, proteinas: 6.9, carbohidratos: 23.7, grasas: 64.5, fibra: 16.3, categoria: 'Frutos secos' },
    'Cebolla roja': { calorias: 40, proteinas: 1.1, carbohidratos: 9.3, grasas: 0.1, fibra: 1.7, categoria: 'Verduras y hortalizas' },
    'Cebolla (chalotas)': { calorias: 72, proteinas: 2.5, carbohidratos: 16.8, grasas: 0.1, fibra: 3.2, categoria: 'Verduras y hortalizas' },
    'Claras de huevo': { calorias: 48, proteinas: 10.9, carbohidratos: 0.7, grasas: 0.2, fibra: 0, categoria: 'Huevos' },
    'Clara de huevo': { calorias: 48, proteinas: 10.9, carbohidratos: 0.7, grasas: 0.2, fibra: 0, categoria: 'Huevos' },
    'Esencia de vainilla': { calorias: 288, proteinas: 0.1, carbohidratos: 12.7, grasas: 0.1, fibra: 0, categoria: 'Condimentos' },
    'Extracto de vainilla': { calorias: 288, proteinas: 0.1, carbohidratos: 12.7, grasas: 0.1, fibra: 0, categoria: 'Condimentos' },
    'Albahaca seca': { calorias: 251, proteinas: 14.4, carbohidratos: 47.8, grasas: 4.1, fibra: 37.7, categoria: 'Especias' },
    'Polvo de hornear': { calorias: 53, proteinas: 0.1, carbohidratos: 27.7, grasas: 0.1, fibra: 0.1, categoria: 'Repostería' },
    'Proteína en polvo sabor chocolate': { calorias: 380, proteinas: 70.0, carbohidratos: 15.0, grasas: 5.0, fibra: 2.0, categoria: 'Suplementos' },
    'Proteína en polvo (vainilla o chocolate)': { calorias: 380, proteinas: 70.0, carbohidratos: 15.0, grasas: 5.0, fibra: 2.0, categoria: 'Suplementos' },
    'Queso cheddar': { calorias: 403, proteinas: 24.9, carbohidratos: 1.3, grasas: 33.2, fibra: 0, categoria: 'Quesos' },
    'Queso rallado (mezcla)': { calorias: 398, proteinas: 25.0, carbohidratos: 2.0, grasas: 33.0, fibra: 0, categoria: 'Quesos' },
    'Malvaviscos mini': { calorias: 318, proteinas: 1.8, carbohidratos: 78.0, grasas: 0.2, fibra: 0, categoria: 'Dulces' },
    'Cereal de arroz con chocolate (cocoa krispies)': { calorias: 380, proteinas: 5.0, carbohidratos: 85.0, grasas: 2.0, fibra: 1.5, categoria: 'Cereales de desayuno' },
    'Arroz para sushi': { calorias: 357, proteinas: 6.5, carbohidratos: 79.0, grasas: 0.7, fibra: 1.3, categoria: 'Arroces' },
    'Garbanzos cocidos': { calorias: 139, proteinas: 8.9, carbohidratos: 18.0, grasas: 2.6, fibra: 7.6, categoria: 'Legumbres cocidas' },
    'Caldo de pollo (brick)': { calorias: 10, proteinas: 0.8, carbohidratos: 0.6, grasas: 0.5, fibra: 0, categoria: 'Caldos y sopas' },
    'Concentrado de caldo de vacuno': { calorias: 120, proteinas: 12.0, carbohidratos: 15.0, grasas: 0.5, fibra: 0, categoria: 'Caldos y sopas' },
    'Vodka': { calorias: 231, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0, categoria: 'Bebidas alcohólicas' },
    'Crema agria o yogur griego': { calorias: 115, proteinas: 3.0, carbohidratos: 4.0, grasas: 10.0, fibra: 0, categoria: 'Lácteos' },
}

// Alimentos que YA EXISTEN en BD pero con otro nombre; mapeo directo
const LINK_MANUAL = {
    'leche': null,  // se crea como "Leche entera"
    'Proteína en polvo (vainilla o chocolate)': null, // se crea
}

function normalizar(s) {
    return s.toLowerCase().trim().replace(/[^a-záéíóúñü0-9\s]/g, '').replace(/\s+/g, ' ')
}

async function main() {
    console.log('🧬 crear-alimentos-faltantes.mjs')
    console.log(`   Modo: ${EJECUTAR ? '🟢 EJECUTAR' : '🟡 DIAGNÓSTICO'}\n`)

    const { data: allAlimentos, error: errLoad } = await supabase
        .from('alimentos')
        .select('id, nombre, calorias, proteinas, carbohidratos, grasas, fibra')
    if (errLoad || !allAlimentos) {
        console.error('❌ Error cargando alimentos:', errLoad?.message || 'sin datos')
        process.exit(1)
    }
    console.log(`📦 Alimentos en BD: ${allAlimentos.length}`)

    const idx = {}
    for (const a of allAlimentos) {
        const key = normalizar(a.nombre)
        if (!idx[key]) idx[key] = []
        idx[key].push(a)
    }

    const { data: orphans } = await supabase
        .from('receta_ingredientes')
        .select('id, receta_id, nombre_libre')
        .is('alimento_id', null)

    if (!orphans || orphans.length === 0) { console.log('✅ No hay huérfanos'); return }

    const groups = {}
    for (const o of orphans) {
        const key = normalizar(o.nombre_libre)
        if (!groups[key]) groups[key] = { nombre_libre: o.nombre_libre, ids: [], receta_ids: new Set() }
        groups[key].ids.push(o.id)
        groups[key].receta_ids.add(o.receta_id)
    }

    console.log(`📋 ${Object.keys(groups).length} grupos, ${orphans.length} filas\n`)

    let creados = 0, linkeados = 0, sinMatch = 0
    const entries = Object.entries(groups).sort((a, b) => b[1].ids.length - a[1].ids.length)

    for (const [keyNorm, group] of entries) {
        const nombre = group.nombre_libre
        let target = null
        let accion = ''

        // (A) Match exacto normalizado
        if (idx[keyNorm] && idx[keyNorm].length > 0) {
            target = idx[keyNorm][0]
            accion = 'EXACTO'
        }

        // (B) Overlap ≥ 70% (solo funciona cuando realmente es el mismo alimento)
        if (!target) {
            const words = keyNorm.split(/\s+/).filter(Boolean)
            let bestScore = 0, bestMatch = null
            for (const a of allAlimentos) {
                const aNorm = normalizar(a.nombre)
                const aWords = aNorm.split(/\s+/).filter(Boolean)
                if (aNorm === keyNorm) { bestScore = 1; bestMatch = a; break }
                const intersection = words.filter(w => aWords.includes(w)).length
                const union = new Set([...words, ...aWords]).size
                const score = intersection / union
                if (score > bestScore && score >= 0.7) { bestScore = score; bestMatch = a }
            }
            if (bestMatch && bestMatch.nombre.toLowerCase().includes(keyNorm)) {
                target = bestMatch
                accion = `OVERLAP ${Math.round(bestScore * 100)}%`
            }
        }

        // (C) Tiene MACROS_REF → CREAR (prioritario sobre match parcial incorrecto)
        const macrosKey = Object.keys(MACROS_REF).find(k => keyNorm === normalizar(k))
        const macros = macrosKey ? MACROS_REF[macrosKey] : null

        if (!target || macros) {
            // Si hay MACROS_REF, CREAR aunque haya match parcial
            // Así evitamos "leche entera" → "Leche de avena"
            if (macros) {
                if (EJECUTAR) {
                    const { data: newAl, error } = await supabase
                        .from('alimentos')
                        .insert({
                            nombre,
                            calorias: macros.calorias,
                            proteinas: macros.proteinas,
                            carbohidratos: macros.carbohidratos,
                            grasas: macros.grasas,
                            fibra: macros.fibra || 0,
                            categoria: macros.categoria || 'Genérico',
                            custom: true,
                            fuente: 'curada',
                            es_generico: true,
                        })
                        .select('id')
                        .single()

                    if (error) {
                        console.log(`   ❌ Error creando "${nombre}": ${error.message}`)
                        sinMatch++
                        continue
                    }
                    target = { id: newAl.id, nombre }
                    creados++
                    console.log(`   ✅ CREADO "${nombre}": ${macros.calorias} kcal, P${macros.proteinas} C${macros.carbohidratos} G${macros.grasas}`)
                } else {
                    if (target) {
                        console.log(`   ↪️  "${nombre}" → SE CREARÁ en lugar de linkar a "${target.nombre}" (match incorrecto evitado)`)
                    } else {
                        console.log(`   📝 SE CREARÍA "${nombre}": ${macros.calorias} kcal, P${macros.proteinas} C${macros.carbohidratos} G${macros.grasas}`)
                    }
                    // In diagnostic mode, skip the link step below for this item
                    if (!EJECUTAR && !target) {
                        sinMatch++ // will adjust later
                    }
                    if (!EJECUTAR) continue // skip to next in diagnostic mode
                }
            }
        }

        // (D) Fallback: match por primera palabra (solo si pasa chequeo de sensatez)
        if (!target && !macros) {
            const words = keyNorm.split(/\s+/).filter(Boolean)
            const firstWord = words[0]
            if (firstWord && words.length > 1) {
                const candidates = allAlimentos
                    .filter(a => {
                        const aNorm = normalizar(a.nombre)
                        return aNorm === firstWord || aNorm.startsWith(firstWord + ' ')
                    })
                    .sort((a, b) => a.nombre.length - b.nombre.length)

                // Solo aceptar si el match es razonable: misma categoría de alimento
                // "cebolla roja" → "Cebolla cruda" ✅ (misma verdura)
                // "leche entera" → "Leche de avena" ❌ (leche vegetal vs animal)
                // "queso cheddar" → "Queso burgos" ❌ (tipo de queso diferente)
                if (candidates.length > 0) {
                    const cand = candidates[0]
                    const cNorm = normalizar(cand.nombre)
                    // Aceptar solo si el match tiene todas las palabras del huérfano
                    // O si el match es claramente el genérico (nombre corto)
                    const allWordsInMatch = words.every(w => cNorm.includes(w))
                    if (allWordsInMatch || cand.nombre.split(' ').length <= 2) {
                        target = cand
                        accion = `PARCIAL: "${firstWord}"`
                    }
                }
            }
        }

        if (!target) {
            sinMatch++
            console.log(`   ⚠️  "${nombre}": SIN MATCH`)
            continue
        }

        if (target && accion) {
            console.log(`   🔗 "${nombre}" → "${target.nombre}" (${accion})`)
        }

        // Linkear
        if (EJECUTAR && target?.id) {
            const { error } = await supabase
                .from('receta_ingredientes')
                .update({ alimento_id: target.id })
                .in('id', group.ids)
            if (error) console.log(`   ❌ Error linkeando "${nombre}": ${error.message}`)
            else linkeados += group.ids.length
        }
    }

    // Recalcular macros
    if (EJECUTAR) {
        const todasRecetas = new Set()
        for (const [, group] of entries)
            for (const rid of group.receta_ids) todasRecetas.add(rid)

        console.log(`\n📊 Recalculando macros para ${todasRecetas.size} recetas...`)
        for (const rid of todasRecetas) {
            const { data: ings } = await supabase
                .from('receta_ingredientes').select('cantidad_gramos, alimento_id').eq('receta_id', rid)
            if (!ings || ings.length === 0) continue
            const alIds = [...new Set(ings.map(i => i.alimento_id).filter(Boolean))]
            const { data: alimentos } = await supabase
                .from('alimentos').select('id, calorias, proteinas, carbohidratos, grasas, fibra').in('id', alIds)
            if (!alimentos) continue
            const alMap = {}
            for (const al of alimentos) alMap[al.id] = al
            let tKcal = 0, tP = 0, tC = 0, tG = 0, tFib = 0
            for (const ing of ings) {
                if (!ing.alimento_id || !ing.cantidad_gramos) continue
                const al = alMap[ing.alimento_id]
                if (!al) continue
                const f = ing.cantidad_gramos / 100
                tKcal += (al.calorias || 0) * f; tP += (al.proteinas || 0) * f
                tC += (al.carbohidratos || 0) * f; tG += (al.grasas || 0) * f
                tFib += (al.fibra || 0) * f
            }
            const { data: receta } = await supabase.from('recetas').select('nombre, porciones').eq('id', rid).single()
            if (!receta) continue
            const porciones = receta.porciones || 1
            await supabase.from('recetas').update({
                kcal: Math.round(tKcal * 100) / 100, proteinas: Math.round(tP * 100) / 100,
                carbohidratos: Math.round(tC * 100) / 100, grasas: Math.round(tG * 100) / 100,
                fibra: Math.round(tFib * 100) / 100,
                kcal_por_porcion: Math.round((tKcal / porciones) * 100) / 100,
                proteinas_por_porcion: Math.round((tP / porciones) * 100) / 100,
                carbohidratos_por_porcion: Math.round((tC / porciones) * 100) / 100,
                grasas_por_porcion: Math.round((tG / porciones) * 100) / 100,
            }).eq('id', rid)
            console.log(`   📊 ${receta.nombre || rid.slice(0, 8)}: ${Math.round(tKcal)} kcal`)
        }
    }

    const totalGrupos = Object.keys(groups).length
    console.log('\n═══════════════════════════════════')
    if (EJECUTAR) {
        console.log(`  Alimentos creados: ${creados}`)
        console.log(`  Huérfanos linkeados: ${linkeados} (de ${orphans.length})`)
        console.log(`  Sin match: ${sinMatch}`)
    } else {
        console.log(`  Pendientes: ${orphans.length} filas en ${totalGrupos} grupos`)
    }
    if (!EJECUTAR)
        console.log('\n  Para aplicar: node scripts/crear-alimentos-faltantes.mjs --ejecutar')
    console.log('═══════════════════════════════════\n')
}

main().catch(err => { console.error('FATAL:', err); process.exit(1) })

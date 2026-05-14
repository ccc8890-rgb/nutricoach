/**
 * fix-ingredientes-malos.mjs
 *
 * Repara los ingredientes mal linkeados detectados en auditoría 14-05-2026:
 *   - Donuts caseros: mantequilla→soja, huevo→spaghetti, harina trigo→avena, vainilla→overnight oats, aceite 1000g→150g
 *   - Ensalada quinoa: quinoa→muesli hacendado
 *   - Peras al vino: vinagre de vino blanco→vino tinto
 *
 * Después de corregir alimento_id, recalcula macros por porción en cada receta afectada.
 *
 * USO:
 *   node scripts/fix-ingredientes-malos.mjs --dry-run   → muestra cambios sin aplicar
 *   node scripts/fix-ingredientes-malos.mjs --apply     → aplica y recalcula
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
    for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const DRY = !process.argv.includes('--apply')

if (DRY) console.log('🔍 DRY-RUN — añade --apply para ejecutar\n')

// ── FIXES definidos manualmente tras auditoría ─────────────────────────────────
const FIXES_INGREDIENTES = [
    // Donuts caseros esponjosos
    { ing_id: 'f999006b-0000-0000-0000-000000000000', match_nombre_libre: 'mantequilla sin sal', nuevo_alim_id: '72f38f67-0000-0000-0000-000000000000', nota: 'mantequilla→soja (CRÍTICO)' },
    { ing_id: '29910ff3-0000-0000-0000-000000000000', match_nombre_libre: 'huevo',               nuevo_alim_id: '4d64b6ba-0000-0000-0000-000000000000', nota: 'huevo→spaghetti (CRÍTICO)' },
    { ing_id: 'c0d67707-0000-0000-0000-000000000000', match_nombre_libre: 'harina de trigo',     nuevo_alim_id: '20c74a2a-0000-0000-0000-000000000000', nota: 'harina trigo→avena' },
    { ing_id: 'f38c490d-0000-0000-0000-000000000000', match_nombre_libre: 'extracto de vainilla', nuevo_alim_id: 'f75a3721-0000-0000-0000-000000000000', nota: 'vainilla→overnight oats' },
    // Ensalada de quinoa crujiente y salmón
    { ing_id: '1bbbe1d6-0000-0000-0000-000000000000', match_nombre_libre: 'Quinoa',              nuevo_alim_id: '53587262-0000-0000-0000-000000000000', nota: 'quinoa→muesli hacendado' },
    // Peras al vino tinto
    { ing_id: '82a8cb74-0000-0000-0000-000000000000', match_nombre_libre: 'Vinagre de vino blanco', nuevo_alim_id: '7db1991f-0000-0000-0000-000000000000', nuevo_nombre_libre: 'Vino tinto', nota: 'vinagre→vino tinto' },
]

// Fix especial: aceite en donuts era 1000g (aceite de freír, no consumido) → reducir a 150g (absorbido)
const FIX_ACEITE_DONUTS = {
    ing_id: '658678b3-0000-0000-0000-000000000000',
    match_nombre_libre: 'aceite de girasol',
    nueva_cantidad_gramos: 150,
    nota: 'aceite 1000g→150g (solo aceite absorbido en fritura)'
}

// Recetas afectadas para recalcular macros
const RECETAS_AFECTADAS = [
    '15a37c7f-389c-4418-8b7b-42ee161cf565', // Donuts caseros esponjosos
    'cfe79398-a992-4502-9746-f360035e113f', // Ensalada de quinoa crujiente y salmón
    '522b5fdf-95c8-486c-9888-ffce713d776c', // Peras al vino tinto sin azúcar
]

// ── Resolver UUIDs truncados ──────────────────────────────────────────────────
async function resolverIds() {
    // Los IDs que tenemos son solo los primeros 8 chars. Necesitamos los completos.
    // Los obtenemos haciendo lookup por receta_id + nombre_libre
    const recetasDonuts = '15a37c7f-389c-4418-8b7b-42ee161cf565'
    const recetaQuinoa  = 'cfe79398-a992-4502-9746-f360035e113f'
    const recetaPeras   = '522b5fdf-95c8-486c-9888-ffce713d776c'

    const mapa = [
        { receta_id: recetasDonuts, nombre_libre: 'mantequilla sin sal' },
        { receta_id: recetasDonuts, nombre_libre: 'huevo' },
        { receta_id: recetasDonuts, nombre_libre: 'harina de trigo' },
        { receta_id: recetasDonuts, nombre_libre: 'extracto de vainilla' },
        { receta_id: recetasDonuts, nombre_libre: 'aceite de girasol' },
        { receta_id: recetaQuinoa,  nombre_libre: 'Quinoa' },
        { receta_id: recetaPeras,   nombre_libre: 'Vinagre de vino blanco' },
    ]

    const resultado = {}
    for (const { receta_id, nombre_libre } of mapa) {
        const { data } = await sb.from('receta_ingredientes').select('id, nombre_libre').eq('receta_id', receta_id).ilike('nombre_libre', nombre_libre).single()
        if (data) resultado[nombre_libre.toLowerCase()] = data.id
        else console.log('⚠️  No encontrado:', nombre_libre)
    }
    return resultado
}

// ── Recalcular macros por porción ─────────────────────────────────────────────
async function recalcularMacros(receta_id) {
    const { data: receta } = await sb.from('recetas').select('nombre, porciones').eq('id', receta_id).single()
    const porciones = receta?.porciones || 1

    const { data: ings } = await sb
        .from('receta_ingredientes')
        .select('cantidad_gramos, alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
        .eq('receta_id', receta_id)

    let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
    for (const i of (ings || [])) {
        const g = i.cantidad_gramos || 0
        const a = i.alimento
        if (!a) continue
        kcal += (a.calorias || 0) * g / 100
        prot += (a.proteinas || 0) * g / 100
        carb += (a.carbohidratos || 0) * g / 100
        gras += (a.grasas || 0) * g / 100
        fib  += (a.fibra || 0) * g / 100
    }

    const pesoTotal = (ings || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
    const kcal100g  = pesoTotal > 0 ? kcal / pesoTotal * 100 : 0

    const porPorcion = {
        kcal: Math.round(kcal / porciones * 10) / 10,
        proteinas: Math.round(prot / porciones * 10) / 10,
        carbohidratos: Math.round(carb / porciones * 10) / 10,
        grasas: Math.round(gras / porciones * 10) / 10,
        fibra: Math.round(fib / porciones * 10) / 10,
        kcal_100g: Math.round(kcal100g * 10) / 10,
        peso_total_g: Math.round(pesoTotal),
    }

    console.log(`  📊 ${receta.nombre} (${porciones} porciones):`)
    console.log(`     kcal: ${porPorcion.kcal} | P: ${porPorcion.proteinas}g | C: ${porPorcion.carbohidratos}g | G: ${porPorcion.grasas}g`)
    return porPorcion
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
    console.log('🔧 Fix ingredientes mal linkeados\n')

    // Resolver UUIDs completos
    const ids = await resolverIds()
    console.log('IDs resueltos:', Object.keys(ids).length, '\n')

    // Aplicar fixes de alimento_id
    const todosLosFixes = [
        { nombre_libre: 'mantequilla sin sal',    nuevo_alim_id: '72f38f67-e4a5-437c-a1f6-df5e60492a91', nuevo_nombre: null,        nota: 'mantequilla→Mantequilla sin sal añadida (717 kcal)' },
        { nombre_libre: 'huevo',                  nuevo_alim_id: '4d64b6ba-9a1d-4f13-8e25-2c10b18fb1b3', nuevo_nombre: null,        nota: 'huevo→Huevo (155 kcal)' },
        { nombre_libre: 'harina de trigo',         nuevo_alim_id: '20c74a2a-e6f5-4fd9-8778-39e123d50333', nuevo_nombre: null,        nota: 'harina trigo→Harina de trigo (364 kcal)' },
        { nombre_libre: 'extracto de vainilla',   nuevo_alim_id: 'f75a3721-b594-4e4f-8a14-9c2bb165df15', nuevo_nombre: null,        nota: 'vainilla→extracto de vainilla (288 kcal)' },
        { nombre_libre: 'Quinoa',                  nuevo_alim_id: '53587262-7a4e-4654-8593-53230565fd31', nuevo_nombre: null,        nota: 'quinoa→Quinoa (368 kcal)' },
        { nombre_libre: 'Vinagre de vino blanco',  nuevo_alim_id: '7db1991f-ca01-4ec3-b38d-4058ea58a43d', nuevo_nombre: 'Vino tinto', nota: 'vinagre→Vino tinto Bobal (85 kcal)' },
    ]

    for (const fix of todosLosFixes) {
        const ing_id = ids[fix.nombre_libre.toLowerCase()]
        if (!ing_id) { console.log('⚠️  No se encontró ID para:', fix.nombre_libre); continue }

        console.log(`${DRY ? '🔍' : '✏️'} ${fix.nota}`)
        console.log(`   \"${fix.nombre_libre}\" → alim_id: ${fix.nuevo_alim_id.substring(0,8)}...`)

        if (!DRY) {
            const updates = { alimento_id: fix.nuevo_alim_id }
            if (fix.nuevo_nombre) updates.nombre_libre = fix.nuevo_nombre
            const { error } = await sb.from('receta_ingredientes').update(updates).eq('id', ing_id)
            if (error) console.log('   ❌ Error:', error.message)
            else console.log('   ✅ Actualizado')
        }
    }

    // Fix especial: aceite en donuts
    const aceite_id = ids['aceite de girasol']
    if (aceite_id) {
        console.log(`\n${DRY ? '🔍' : '✏️'} Aceite donuts: 1000g → 150g (solo aceite absorbido en fritura)`)
        if (!DRY) {
            const { error } = await sb.from('receta_ingredientes').update({ cantidad_gramos: 150 }).eq('id', aceite_id)
            if (error) console.log('   ❌ Error:', error.message)
            else console.log('   ✅ Actualizado')
        }
    }

    // Recalcular macros
    console.log('\n📊 Recalculando macros...')
    for (const receta_id of RECETAS_AFECTADAS) {
        const macros = await recalcularMacros(receta_id)
        if (!DRY) {
            const { error } = await sb.from('recetas').update(macros).eq('id', receta_id)
            if (error) console.log('   ❌ Error actualizando macros:', error.message)
            else console.log('   ✅ Macros actualizadas')
        }
    }

    if (DRY) console.log('\n⚠️  DRY-RUN completado. Para aplicar: node scripts/fix-ingredientes-malos.mjs --apply')
    else console.log('\n✅ Todos los fixes aplicados')
}

main().catch(e => { console.error(e); process.exit(1) })

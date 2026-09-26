/**
 * fix-auditoria-procesados-t18.mjs
 *
 * Aplica las correcciones encontradas en la auditoría T18 (salidas/auditoria-procesados-2026-09-26.json):
 * receta_ingredientes vinculados a alimentos con calorias=0 (muchos marcados es_comestible=false
 * por el guard) o a productos procesados cuando el ingrediente libre pedía un alimento base.
 *
 * Cada fix reemplaza el alimento_id por uno YA EXISTENTE y comestible en la BD — no se inventan
 * macros nuevos. Después recalcula kcal/proteinas/carbohidratos/grasas de las recetas afectadas.
 *
 * USO:
 *   node scripts/fix-auditoria-procesados-t18.mjs            → dry-run (muestra cambios)
 *   node scripts/fix-auditoria-procesados-t18.mjs --apply    → aplica
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnv() {
    const p = resolve(ROOT, '.env.local')
    if (!existsSync(p)) return
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq === -1) continue
        process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    }
}
loadEnv()

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const DRY = !process.argv.includes('--apply')

// receta_ingrediente.id -> { alimento_id nuevo, nombre del alimento nuevo (para log), motivo }
const FIXES = [
    // Grupo A — alimentos con calorias=0 (varios es_comestible=false), relinkados a un alimento real equivalente ya existente en BD
    { id: '66da0861-631f-4183-8865-9023e922aada', nuevo: '2c188a89-41b8-413b-839d-8bfdea691fcd', nuevoNombre: 'Spaghetti (350 kcal)', motivo: 'Spaghetti huevo (0kcal, no comestible) → Spaghetti real' },
    { id: '616569db-b5aa-47d3-aca5-8afa2d3dcd65', nuevo: '2c188a89-41b8-413b-839d-8bfdea691fcd', nuevoNombre: 'Spaghetti (350 kcal)', motivo: 'Spaghetti huevo (0kcal, no comestible) → Spaghetti real' },
    { id: '4f1a198b-e79d-4150-90d4-a54cbcd0c337', nuevo: '2c188a89-41b8-413b-839d-8bfdea691fcd', nuevoNombre: 'Spaghetti (350 kcal)', motivo: 'Spaghetti huevo (0kcal, no comestible) → Spaghetti real' },
    { id: 'dbbc82c4-63ec-4b53-abbe-c684a5fe7fe5', nuevo: '2c188a89-41b8-413b-839d-8bfdea691fcd', nuevoNombre: 'Spaghetti (350 kcal)', motivo: 'Spaghetti huevo (0kcal, no comestible) → Spaghetti real' },
    { id: '794689e7-e8d4-4b10-b2a5-d085ee8a212d', nuevo: 'a1da5edf-d169-4b55-a6f7-c378534900a9', nuevoNombre: 'Granola casera sin azúcar (471 kcal)', motivo: 'Granola Fitness Chocolate (0kcal) → granola real sin azúcar' },
    { id: 'ed1b36b4-e1d4-4717-a51c-b65150012b53', nuevo: '6f3847f9-f93a-4ebd-aa6a-5a75d48ff848', nuevoNombre: 'Aceituna Negra del Sur (120 kcal)', motivo: 'Aceituna Negra Sur (0kcal, no comestible) → duplicado real' },
    { id: '013b9263-718a-4932-b97a-23c064bfd0bf', nuevo: '350806e1-8a27-485e-8ac4-66cf9c169e87', nuevoNombre: 'Croqueta Jamón Ibérico Horneable (250 kcal)', motivo: 'Croquetas Artesanas Jamón Ibérico (0kcal, no comestible) → croqueta real' },
    { id: '4ab10e6f-c23a-4ac6-ba13-a6766b91ba78', nuevo: '350806e1-8a27-485e-8ac4-66cf9c169e87', nuevoNombre: 'Croqueta Jamón Ibérico Horneable (250 kcal)', motivo: 'Croquetas Artesanas Jamón Ibérico (0kcal, no comestible) → croqueta real' },
    { id: '2918312c-da31-473a-b2d4-1f23b84443f6', nuevo: 'c8a23525-ce6b-4d57-8239-0ef45501556a', nuevoNombre: 'Burger Meat Pollo y Pavo (160 kcal)', motivo: 'Burger pavo espinacas (0kcal, no comestible) → burger real con pavo' },
    { id: '9f1a6e23-d008-48fd-bf5f-7f2617fa4ac2', nuevo: '7fcfe0b8-9929-4617-86ca-137ae397aee3', nuevoNombre: 'Yogur griego natural 0% (57 kcal)', motivo: 'Yogur Estilo Griego (0kcal, no comestible) → yogur griego real' },
    { id: '5af47060-e982-4ee1-8675-6990a1fca35e', nuevo: '7fcfe0b8-9929-4617-86ca-137ae397aee3', nuevoNombre: 'Yogur griego natural 0% (57 kcal)', motivo: 'Yogur Estilo Griego (0kcal, no comestible) → yogur griego real' },

    // Grupo B — ingrediente base auto-matcheado a producto procesado equivocado (mismo patrón que hallazgo de Carlos)
    { id: '5a0c167b-b186-42c8-aff6-818b3cffbdd8', nuevo: 'a373be7f-1460-4536-8721-4e82b4a73e34', nuevoNombre: 'Mix frutos rojos Hacendado ultracongeladas (50 kcal)', motivo: '"frutos rojos congelados" → Barritas de Muesli (380kcal) → fruta congelada real' },
    { id: 'a1accf52-dead-4813-82cc-18a300190415', nuevo: 'a373be7f-1460-4536-8721-4e82b4a73e34', nuevoNombre: 'Mix frutos rojos Hacendado ultracongeladas (50 kcal)', motivo: '"frutos del bosque congelados" → Barritas de Muesli (380kcal) → fruta congelada real' },
    { id: '7ef24197-5a4a-4744-98a8-ce49fb5703b7', nuevo: 'e3012f44-f60c-4d62-895e-29608cb8c4f7', nuevoNombre: 'Leche de almendras (sin azúcar) (17 kcal)', motivo: '"leche de almendras sin azúcar" → Barritas de chocolate Hacendado (480kcal) → leche de almendras real' },
]

if (DRY) console.log('🔍 DRY-RUN — usa --apply para ejecutar\n')
else console.log('✏️  APLICANDO CAMBIOS\n')

async function aplicarFixes() {
    const recetaIdsAfectadas = new Set()

    for (const f of FIXES) {
        const { data: ri, error } = await sb
            .from('receta_ingredientes')
            .select('id, nombre_libre, receta_id, alimento:alimento_id (nombre, calorias)')
            .eq('id', f.id)
            .single()

        if (error || !ri) {
            console.log(`  ⚠️  No encontrado: ${f.id}`)
            continue
        }

        recetaIdsAfectadas.add(ri.receta_id)

        console.log(`  ${DRY ? '🔍' : '✅'} [${ri.nombre_libre}] "${ri.alimento?.nombre}" (${ri.alimento?.calorias}kcal) → "${f.nuevoNombre}"`)
        console.log(`      ${f.motivo}`)

        if (!DRY) {
            const { error: errUpdate } = await sb
                .from('receta_ingredientes')
                .update({ alimento_id: f.nuevo })
                .eq('id', f.id)
            if (errUpdate) console.log(`      ❌ Error al actualizar: ${errUpdate.message}`)
        }
    }

    return [...recetaIdsAfectadas]
}

async function recalcularMacros(recetaIds) {
    if (!recetaIds.length) return
    console.log(`\n  📊 Recalculando macros para ${recetaIds.length} recetas afectadas...`)

    for (const receta_id of recetaIds) {
        const { data: receta } = await sb.from('recetas').select('nombre, porciones').eq('id', receta_id).single()
        const porciones = receta?.porciones || 1

        const { data: ings } = await sb.from('receta_ingredientes')
            .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
            .eq('receta_id', receta_id)

        let kcal = 0, prot = 0, carb = 0, gras = 0, fib = 0
        for (const i of (ings || [])) {
            const g = i.cantidad_gramos || 0
            const a = i.alimentos
            if (!a) continue
            kcal += (a.calorias || 0) * g / 100
            prot += (a.proteinas || 0) * g / 100
            carb += (a.carbohidratos || 0) * g / 100
            gras += (a.grasas || 0) * g / 100
            fib += (a.fibra || 0) * g / 100
        }

        const pesoTotal = (ings || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
        const macros = {
            kcal: Math.round(kcal / porciones * 10) / 10,
            proteinas: Math.round(prot / porciones * 10) / 10,
            carbohidratos: Math.round(carb / porciones * 10) / 10,
            grasas: Math.round(gras / porciones * 10) / 10,
            fibra: Math.round(fib / porciones * 10) / 10,
        }

        console.log(`  ${DRY ? '🔍' : '✅'} ${receta?.nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)

        if (!DRY) {
            await sb.from('recetas').update(macros).eq('id', receta_id)
        }
    }
}

async function main() {
    const recetaIds = await aplicarFixes()
    await recalcularMacros(recetaIds)
    console.log(DRY ? '\n🔍 Dry-run completo. Ejecuta con --apply para aplicar de verdad.' : '\n✅ Cambios aplicados.')
}

main().catch(console.error)

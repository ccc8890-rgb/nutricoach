/**
 * Corrige el lote de 50 recetas creadas el 07-06-2026 entre 16:20 y 16:27
 * (generador de esqueletos). Causa raíz documentada en TAREAS.md T43c:
 * el auto-match de ingredientes vinculó muchas filas a un alimento que
 * encajaba con el NOMBRE de la receta (generado libremente por DeepSeek,
 * poco fiable) en vez de con su propio `nombre_libre` (el ingrediente real
 * del esqueleto determinista) — por eso "salmón fresco" en una receta
 * llamada "Caballa al horno..." acabó vinculado a "Caballa fresca", y
 * "brócoli" jamás se vinculó a "Brócoli" en NINGUNA receta del lote.
 *
 * Este script relinca cada fila a un alimento genérico y correcto según su
 * `nombre_libre` (verdad determinista), buscado y verificado a mano contra
 * la tabla `alimentos` real — no es una búsqueda difusa automática.
 *
 * Uso:
 *   node scripts/fix-batch-060726-ingredientes.mjs             (dry-run)
 *   node scripts/fix-batch-060726-ingredientes.mjs --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
function loadEnv() {
  const p = resolve(ROOT, '.env.local')
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
const APPLY = process.argv.includes('--apply')

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// nombre_libre normalizado -> alimento_id correcto, verificado uno a uno
// contra `alimentos` (es_comestible = true, generico donde existía opción).
const MAPA = {
  'aceite de coco virgen': '63d65619-822a-4077-996e-a433e86c0b29',
  'almendras': '3cbe24f8-42b5-4cf4-8c6e-107b303d0859',
  'arroz blanco': 'd262ebde-dc7b-4713-a816-2ca82f23e535',
  'arroz blanco cocido': '3980edd4-7df9-43a3-8db7-c36c90f81472',
  'avena en copos': '808d4c66-edf4-4c45-9933-c03b2254ad8a',
  'brocoli': '8820b293-e98a-4262-8348-341708828228',
  'calabacin': 'f8586302-dd47-4bfc-8b34-90928845e770',
  'datiles medjoul': '3a88a7b8-7ab1-49be-ac28-6e3260d6fd19',
  'espinacas': 'eea44971-e245-4855-a8e3-7e55ebdcba41',
  'espinacas salteadas': 'eea44971-e245-4855-a8e3-7e55ebdcba41',
  'frutos rojos': '785456ce-af0a-4ffb-96c6-10b233e1739a',
  'hierbas provenzales': 'ed75d159-7a63-44d4-9abf-b0b09a5db4a7',
  'huevo entero': '4d64b6ba-9a1d-4f13-8e25-2c10b18fb1b3',
  'jamon york bajo en sal': '10b2b6c5-9449-430a-99b7-3563a117119a',
  'judias verdes': '95efbbab-e8fb-4055-9c8a-a1670f4caac7',
  'leche semidesnatada': '8469bf72-2459-4c27-8124-527c81f8559d',
  'limon': '9fc2b223-ab6a-4b8f-b9c3-3dffaacb4f08',
  'merluza': '974247da-c085-4d9c-8cc3-9417f544b024',
  'mermelada de fresa': '92b3c5d9-b581-4960-a296-2e8c44caf1e7',
  'naranja': '5e122ac4-7d21-4be1-ae8e-d83ac371b8ed',
  'nueces': '63c26672-da4f-4588-9db0-b8eb3ad5a60e',
  'pan de centeno': '80dffe34-c123-4aba-81ed-0a28d8231bc4',
  'pan de espelta': 'daccd85d-01ab-42aa-b3b1-04626612c5c4',
  'pasta blanca': 'cc22b5ae-b409-4e5b-a59e-67df5d965aa0',
  'pasta integral': '79744190-666f-49ef-b30a-2feef9d7de7a',
  'patata': 'c5ef20c7-556d-40fe-8406-7b6b6efda64b',
  'patata cocida': 'b0b14be3-4715-4f32-b093-6283cf49a465',
  'pechuga de pavo': '7312fdee-6c3c-4a15-806c-546ccd0ffc80',
  'pechuga de pollo': '4ad8714c-a916-461b-9736-3ae17ec80c0c',
  'pimiento asado': '3bc9d77b-2de6-4cf5-b135-8bc7df50edc5',
  'platano': '1131a576-ae8a-407d-84c6-b2deaf970a1b',
  'platano maduro': 'e4ffd0ee-e9c4-4642-abbf-d8eac2c2234b',
  'proteina en polvo': 'd1b4f76d-3ec6-41aa-9467-4540823a51fa',
  'proteina en polvo sabor natural': 'd1b4f76d-3ec6-41aa-9467-4540823a51fa',
  'queso fresco en porciones': 'b068c019-ece9-4bd1-b826-6af4459f2f41',
  'quinoa': 'fa56e340-23fc-4802-bbe3-c44d7180b3d6',
  'salmon fresco': '09a34011-8fbb-4b4d-a689-cf0efe00b55e',
  'tomate': '7f40a393-4f21-4196-bcd6-9c6e9a413532',
  'tomate triturado': '1390b7a4-693d-47c4-9a54-cf03649b8033',
  'tortita de arroz': 'ab86c341-6d99-4a92-85a7-021309fda23e',
  'yogur griego natural 0%': '7fcfe0b8-9929-4617-86ca-137ae397aee3',
  'yogur natural 0%': 'b0646b89-c2f8-4189-a4b1-09cb87ca1347',
  'zanahoria cocida': '4dacb910-6496-4be8-8876-8d96eea6b357',
  'zumo de naranja': 'a7b4fb94-007c-4332-9935-f0415f668012',
}

async function recalcularMacros(recetaId) {
  const { data: receta } = await sb.from('recetas').select('porciones').eq('id', recetaId).single()
  const porciones = receta?.porciones || 1
  const { data: ings } = await sb.from('receta_ingredientes')
    .select('cantidad_gramos, alimentos(calorias, proteinas, carbohidratos, grasas, fibra)')
    .eq('receta_id', recetaId)
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
  const macros = {
    kcal: Math.round(kcal / porciones * 10) / 10,
    proteinas: Math.round(prot / porciones * 10) / 10,
    carbohidratos: Math.round(carb / porciones * 10) / 10,
    grasas: Math.round(gras / porciones * 10) / 10,
    fibra: Math.round(fib / porciones * 10) / 10,
  }
  if (APPLY) await sb.from('recetas').update(macros).eq('id', recetaId)
  return macros
}

async function main() {
  console.log(APPLY ? '✏️  APLICANDO\n' : '🔍 DRY-RUN\n')

  // 0. Fix del propio catálogo: "Salmón fresco" (BEDCA, 208kcal, datos
  // completos) estaba marcado es_comestible=false por error — por eso el
  // auto-match nunca podía encontrarlo para ninguna receta del sistema,
  // no solo este lote.
  if (APPLY) {
    const { error } = await sb.from('alimentos').update({ es_comestible: true }).eq('id', '09a34011-8fbb-4b4d-a689-cf0efe00b55e')
    if (error) console.log('  ❌ fix es_comestible Salmón fresco:', error.message)
    else console.log('✅ "Salmón fresco" (BEDCA) marcado como comestible de nuevo\n')
  } else {
    console.log('🔍 Marcaría "Salmón fresco" (09a34011) como es_comestible=true\n')
  }

  const { data: recetas } = await sb.from('recetas').select('id, nombre')
    .gte('created_at', '2026-06-07T15:00:00Z').lte('created_at', '2026-06-07T19:00:00Z')

  let filasCambiadas = 0
  const recetasAfectadas = new Set()

  for (const r of recetas) {
    const { data: ings } = await sb.from('receta_ingredientes').select('id, nombre_libre, alimento_id').eq('receta_id', r.id)
    for (const i of ings) {
      const key = norm(i.nombre_libre)
      const correcto = MAPA[key]
      if (!correcto) continue
      if (i.alimento_id !== correcto) {
        filasCambiadas++
        recetasAfectadas.add(r.id)
        console.log(`  ${APPLY ? '✏️ ' : '🔍'} [${r.nombre}] "${i.nombre_libre}": ${i.alimento_id} → ${correcto}`)
        if (APPLY) {
          const { error } = await sb.from('receta_ingredientes').update({ alimento_id: correcto }).eq('id', i.id)
          if (error) console.log(`     ❌ ${error.message}`)
        }
      }
    }
  }

  console.log(`\n${filasCambiadas} filas de ingrediente corregidas en ${recetasAfectadas.size} recetas.\n`)

  console.log(`📊 Recalculando macros de ${recetasAfectadas.size} recetas afectadas...\n`)
  for (const id of recetasAfectadas) {
    const macros = await recalcularMacros(id)
    console.log(`  ${APPLY ? '✅' : '🔍'} ${macros.kcal} kcal`)
  }

  console.log(APPLY ? '\n✅ Aplicado.' : '\n🔍 Dry-run completo — ejecutar con --apply para escribir.')
}

main().catch(console.error)

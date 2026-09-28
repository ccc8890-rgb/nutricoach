/**
 * fix-auditoria-matches-2026-09-29.mjs
 *
 * Corrige los hallazgos de la auditoría de matches 28-09-2026:
 * - 2 casos reportados por Carlos (pepino/tzatziki, bollos boniato/caseína falsa)
 * - 3 patrones sistémicos (aguacate→agua, whey→natillas, cottage→queso añejo)
 *
 * USO:
 *   node scripts/fix-auditoria-matches-2026-09-29.mjs            # dry-run
 *   node scripts/fix-auditoria-matches-2026-09-29.mjs --apply    # aplica cambios
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const DRY = !process.argv.includes('--apply')
const envPath = resolve(process.cwd(), '.env.local')
if (!existsSync(envPath)) { console.error('❌ No se encuentra .env.local'); process.exit(1) }
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const [key, ...rest] = line.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Alimentos destino correctos
const AGUACATE_ID = '91ad5545-3529-47c8-abea-e194a6543a93'       // "Aguacate" genérico
const WHEY_VAINILLA_ID = '9076c191-d2a5-4b24-9974-45dda11a5067'  // "Proteína en polvo sabor vainilla"
const COTTAGE_LIGHT_ID = '30dbfc8a-e3d6-4d19-887a-797ccdc6619a'  // "Cottage 0% Materia Grasa"
const PEPINO_REAL_ID = '2e8d5d64-567a-498d-ab7f-f249dce8d8e3'    // "Pepino"

async function relink(nombreLibrePattern, alimentoDestinoId, alimentoDestinoNombre, etiqueta) {
  const { data: rows, error } = await sb
    .from('receta_ingredientes')
    .select('id, receta_id, nombre_libre, alimento_id, alimentos(nombre)')
    .ilike('nombre_libre', nombreLibrePattern)
  if (error) { console.error('  ❌', error.message); return [] }

  const afectadas = []
  for (const r of rows || []) {
    if (r.alimento_id === alimentoDestinoId) continue // ya correcto
    console.log(`  ${DRY ? '🔍' : '✅'} [${etiqueta}] receta_ingredientes ${r.id} — "${r.nombre_libre}" (${r.alimentos?.nombre}) → "${alimentoDestinoNombre}"`)
    if (!DRY) {
      const { error: upErr } = await sb.from('receta_ingredientes').update({ alimento_id: alimentoDestinoId }).eq('id', r.id)
      if (upErr) console.error('    ❌', upErr.message)
    }
    afectadas.push(r.receta_id)
  }
  return afectadas
}

async function actualizarCantidad(recetaIngredienteId, nuevaCantidad, etiqueta) {
  console.log(`  ${DRY ? '🔍' : '✅'} [${etiqueta}] receta_ingredientes ${recetaIngredienteId} → cantidad_gramos = ${nuevaCantidad}`)
  if (!DRY) {
    const { error } = await sb.from('receta_ingredientes').update({ cantidad_gramos: nuevaCantidad }).eq('id', recetaIngredienteId)
    if (error) console.error('    ❌', error.message)
  }
}

async function recalcularMacros(recetaIds) {
  const ids = [...new Set(recetaIds)]
  console.log(`\n📊 Recalculando macros para ${ids.length} recetas afectadas...`)
  for (const receta_id of ids) {
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
      fib  += (a.fibra || 0) * g / 100
    }
    const pesoTotal = (ings || []).reduce((s, i) => s + (i.cantidad_gramos || 0), 0)
    const macros = {
      kcal: Math.round(kcal / porciones * 10) / 10,
      proteinas: Math.round(prot / porciones * 10) / 10,
      carbohidratos: Math.round(carb / porciones * 10) / 10,
      grasas: Math.round(gras / porciones * 10) / 10,
      fibra: Math.round(fib / porciones * 10) / 10,
      kcal_100g: pesoTotal > 0 ? Math.round(kcal / pesoTotal * 100 * 10) / 10 : 0,
      peso_total_g: Math.round(pesoTotal),
    }
    console.log(`  ${DRY ? '🔍' : '✅'} ${receta?.nombre}: ${macros.kcal} kcal | P:${macros.proteinas}g | C:${macros.carbohidratos}g | G:${macros.grasas}g`)
    if (!DRY) await sb.from('recetas').update(macros).eq('id', receta_id)
  }
}

async function main() {
  console.log(`🔧 Fix auditoría matches — modo: ${DRY ? 'DRY-RUN' : 'APLICAR'}\n`)
  let recetasAfectadas = []

  console.log('1) Ensalada de pepino chafado con aliño de sésamo')
  recetasAfectadas.push(...await relink('Pepino mediano', PEPINO_REAL_ID, 'Pepino', 'pepino-tzatziki'))
  await actualizarCantidad('16e0a6c3-d011-4ed6-b06d-fa3a199ac4cb', 30, 'piparras-cantidad')
  recetasAfectadas.push('adf4a285-caf8-48c7-8e51-a346824d92d0')

  console.log('\n2) Bollos de patata dulce saludables — caseína hallucinada')
  const BOLLOS_ID = '4a998463-af82-4bb3-81f2-e01784e81ac4'
  const { data: caseina } = await sb.from('receta_ingredientes').select('id').eq('receta_id', BOLLOS_ID).ilike('nombre_libre', '%caseína%')
  for (const c of caseina || []) {
    console.log(`  ${DRY ? '🔍' : '✅'} eliminar receta_ingredientes ${c.id} (caseína micelar, no está en la receta original)`)
    if (!DRY) await sb.from('receta_ingredientes').delete().eq('id', c.id)
  }
  const nuevaInstruccion = "1. Pelar y hervir la patata dulce hasta que esté tierna. Escurrir y hacer puré.\n2. Mezclar el puré de patata con la harina de avena, el huevo, la sal y la pimienta. Amasar hasta obtener una masa homogénea.\n3. Dividir la masa en 4 porciones y formar discos de aproximadamente 1 cm de grosor.\n4. Colocar en una bandeja de horno forrada con papel vegetal. Hornear a 180°C durante 15-20 minutos o hasta que estén dorados.\n5. Dejar enfriar sobre una rejilla. Usar como pan para hamburguesas."
  console.log(`  ${DRY ? '🔍' : '✅'} actualizar instrucciones (quitar mención a caseína)`)
  if (!DRY) await sb.from('recetas').update({ instrucciones: nuevaInstruccion }).eq('id', BOLLOS_ID)
  recetasAfectadas.push(BOLLOS_ID)

  console.log('\n3) Patrón sistémico: Aguacate → Agua')
  recetasAfectadas.push(...await relink('%aguacate%', AGUACATE_ID, 'Aguacate', 'aguacate-agua'))

  console.log('\n4) Patrón sistémico: Proteína whey vainilla → Natillas con proteína')
  recetasAfectadas.push(...await relink('%proteína whey vainilla%', WHEY_VAINILLA_ID, 'Proteína en polvo sabor vainilla', 'whey-natillas'))
  console.log('  ⚠️  "pan de proteína (rebanada)" en Pan proteico con AOVE y tomate NO se toca — necesita alimento propio (pan proteico), no proteína en polvo. Revisar manualmente.')

  console.log('\n5) Patrón sistémico: Queso cottage/batido bajo en grasa → Queso añejo de oveja')
  recetasAfectadas.push(...await relink('%cottage bajo en grasa%', COTTAGE_LIGHT_ID, 'Cottage 0% Materia Grasa', 'cottage-anejo'))
  recetasAfectadas.push(...await relink('%queso fresco batido 0%%', COTTAGE_LIGHT_ID, 'Cottage 0% Materia Grasa', 'cottage-anejo-batido'))
  recetasAfectadas.push(...await relink('%queso crema batido 0%%', COTTAGE_LIGHT_ID, 'Cottage 0% Materia Grasa', 'cottage-anejo-crema'))

  await recalcularMacros(recetasAfectadas)
  console.log(`\n${DRY ? '🔍 DRY-RUN completo. Ejecuta con --apply para aplicar.' : '✅ Cambios aplicados.'}`)
}

main()

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function diagnostic() {
  // Alimentos sin micros
  const { data, error } = await supabase
    .from('alimentos')
    .select('id, nombre, fuente, calorias, proteinas, carbohidratos, grasas, categoria')
    .is('vitamina_a_ug', null)

  if (error) { console.error(error); return }

  const total = data.length
  const sinKcal = data.filter(a => !a.calorias || a.calorias === 0)
  const sinProteinas = data.filter(a => !a.proteinas || a.proteinas === 0)
  const sinGrasas = data.filter(a => !a.grasas || a.grasas === 0)
  const sinCarbs = data.filter(a => !a.carbohidratos || a.carbohidratos === 0)

  const fuentes: Record<string, number> = {}
  for (const a of data) {
    const f = a.fuente || '(null)'
    fuentes[f] = (fuentes[f] || 0) + 1
  }

  // sin macros completos (al menos calorias, proteinas, carbs, grasas)
  const sinMacros = data.filter(a =>
    (!a.calorias || a.calorias === 0) ||
    (!a.proteinas || a.proteinas === 0) ||
    (!a.carbohidratos || a.carbohidratos === 0) ||
    (!a.grasas || a.grasas === 0)
  )

  // Con macros pero sin micros
  const conMacrosSinMicros = data.filter(a =>
    a.calorias && a.calorias > 0 &&
    a.proteinas && a.proteinas > 0 &&
    a.carbohidratos && a.carbohidratos > 0 &&
    a.grasas && a.grasas > 0
  )

  console.log('=== DIAGNÓSTICO DE ALIMENTOS SIN MICRONUTRIENTES ===')
  console.log(`Total sin micros: ${total}`)
  console.log(`Sin kcal: ${sinKcal.length}`)
  console.log(`Sin proteinas: ${sinProteinas.length}`)
  console.log(`Sin carbohidratos: ${sinCarbs.length}`)
  console.log(`Sin grasas: ${sinGrasas.length}`)
  console.log(`Sin macros COMPLETOS: ${sinMacros.length}`)
  console.log(`Con macros pero sin micros: ${conMacrosSinMicros.length}`)
  console.log('')
  console.log('Por fuente:')
  for (const [f, c] of Object.entries(fuentes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${f}: ${c}`)
  }

  // Sample de nombres para ver qué tipo de alimentos son
  console.log('\nMuestra (20 primeros):')
  for (const a of data.slice(0, 20)) {
    const kcal = a.calorias ?? 0
    const p = a.proteinas ?? 0
    const c = a.carbohidratos ?? 0
    const g = a.grasas ?? 0
    const tieneMacros = kcal > 0 && p > 0 && c > 0 && g > 0
    console.log(`  [${a.fuente || '?'}] ${a.nombre} → ${kcal}kc ${p}p ${c}c ${g}g ${tieneMacros ? '✅macros' : '❌sinMacros'}`)
  }
}

diagnostic()

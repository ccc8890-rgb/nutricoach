import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hopeqzwzmlrpktoeygxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcGVxend6bWxycGt0b2V5Z3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyMjUxOSwiZXhwIjoyMDkyNjk4NTE5fQ.e0iP547fppOHFfFiWEo053tjl7FmcQMAZzvCPwcVSkc'
)

console.log('=== DIAGNÓSTICO: Alimentos duplicados / es_generico=true ===\n')

// ─── 1. ALIMENTOS CON es_generico=true (creados por scraping) ───
// Estos son los "~84 productos duplicados" del ESTADO
const { data: genericos, error: err1, count: c1 } = await supabase
  .from('alimentos')
  .select('id, nombre, calorias, proteinas, carbohidratos, grasas, custom', { count: 'exact' })
  .eq('es_generico', true)
  .limit(200)

if (err1) { console.error('ERROR consulta genéricos:', err1); process.exit(1) }

console.log(`Alimentos con es_generico=true: ${c1}`)
if (genericos && genericos.length > 0) {
  const conMacros = genericos.filter(a => (a.calorias || 0) > 0)
  const sinMacros = genericos.filter(a => !a.calorias || a.calorias === 0)
  const delSeed = genericos.filter(a => a.custom === true)
  console.log(`  ├─ Con macros (>0 kcal): ${conMacros.length}`)
  console.log(`  ├─ Sin macros (0 kcal): ${sinMacros.length}`)
  console.log(`  └─ Del seed (custom=true): ${delSeed.length}`)

  console.log('\nMuestra (primeros 20):')
  genericos.slice(0, 20).forEach(a => {
    console.log(`  ${a.id.slice(0, 8)}... | ${(a.nombre || '').slice(0, 55).padEnd(55)} | kcal=${a.calorias ?? 0}  P=${a.proteinas ?? 0}  C=${a.carbohidratos ?? 0}  G=${a.grasas ?? 0}  ${a.custom ? '[SEED]' : '[SCRAPING]'}`)
  })
}

console.log('\n───\n')

// ─── 2. ¿CUÁNTOS DE ESOS GENÉRICOS TIENEN PRODUCTOS VINCULADOS? ───
// Para saber cuáles siguen "activos" (tienen productos_supermercado apuntando)
for (const a of (genericos || []).slice(0, 30)) {
  const { data: prods, error: errP } = await supabase
    .from('productos_supermercado')
    .select('id, supermercado_id, nombre_original, precio_por_kg')
    .eq('alimento_id', a.id)
    .limit(5)

  if (!errP && prods && prods.length > 0) {
    console.log(`  ${a.id.slice(0, 8)}... "${a.nombre.slice(0, 40)}" → ${prods.length} producto(s):`)
    prods.forEach(p => {
      console.log(`    [${p.supermercado_id.slice(0, 8)}...] ${(p.nombre_original || '').slice(0, 40).padEnd(40)} ${p.precio_por_kg}€/kg`)
    })
  }
}

console.log('\n───\n')

// ─── 3. TOTAL PRODUCTOS POR SUPERMERCADO ───
const { data: totalPorSuper, error: err3 } = await supabase
  .from('productos_supermercado')
  .select('supermercado_id')

if (!err3 && totalPorSuper) {
  const superCount = {}
  for (const p of totalPorSuper) {
    superCount[p.supermercado_id] = (superCount[p.supermercado_id] || 0) + 1
  }

  // Traer nombres de supermercados
  const smIds = Object.keys(superCount)
  const { data: sms } = await supabase
    .from('supermercados')
    .select('id, nombre')
    .in('id', smIds)

  const smMap = {}
  if (sms) for (const s of sms) smMap[s.id] = s.nombre

  console.log('\nProductos totales por supermercado:')
  for (const [id, count] of Object.entries(superCount).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${(smMap[id] || id).padEnd(20)} ${count} productos`)
  }
}

console.log('\n───\n')

// ─── 4. ALIMENTOS DUPLICADOS POR NOMBRE ───
// Busca alimentos con el mismo nombre (independientemente de es_generico)
const { data: todosAlimentos, error: err4 } = await supabase
  .from('alimentos')
  .select('id, nombre, calorias, proteinas, carbohidratos, grasas, es_generico, custom')
  .order('nombre')

if (!err4 && todosAlimentos) {
  const nombreCount = {}
  for (const a of todosAlimentos) {
    const key = (a.nombre || '').toLowerCase().trim()
    nombreCount[key] = (nombreCount[key] || 0) + 1
  }

  const duplicados = Object.entries(nombreCount).filter(([_, c]) => c > 1)
  console.log(`\nNombres de alimento duplicados: ${duplicados.length}`)

  // Mostrar los más relevantes (donde al menos uno sea genérico o del scraping)
  let mostrados = 0
  for (const [nombre, count] of duplicados) {
    if (mostrados >= 15) break
    const alims = todosAlimentos.filter(a => (a.nombre || '').toLowerCase().trim() === nombre)
    const hayGenerico = alims.some(a => a.es_generico === true)
    const haySeed = alims.some(a => a.custom === false && !a.es_generico)
    if (hayGenerico || (count > 2)) {
      console.log(`  "${nombre}" (${count}x):`)
      alims.forEach(a => {
        const etiqueta = a.es_generico ? '[GENÉRICO]' : a.custom ? '[CUSTOM]' : '[SEED]'
        console.log(`    ${a.id.slice(0, 8)}... ${etiqueta} kcal=${a.calorias ?? 0} P=${a.proteinas ?? 0} C=${a.carbohidratos ?? 0} G=${a.grasas ?? 0}`)
      })
      mostrados++
    }
  }
  if (mostrados === 0) console.log('  (ninguno con mezcla seed+genérico)')
}

console.log('\n=== DIAGNÓSTICO COMPLETADO ===')

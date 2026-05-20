/**
 * test-kb-flow.mjs — Prueba del flujo Knowledge Base + DeepSeek
 *
 * Simula exactamente lo que hace /api/generar-dieta-ia:
 *   1. Consulta knowledge_base con disciplinas y condiciones
 *   2. Construye el contexto científico
 *   3. Muestra el prompt final que recibe DeepSeek
 *
 * Uso: node scripts/test-kb-flow.mjs
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://hopeqzwzmlrpktoeygxz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvcGVxend6bWxycGt0b2V5Z3h6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzEyMjUxOSwiZXhwIjoyMDkyNjk4NTE5fQ.e0iP547fppOHFfFiWEo053tjl7FmcQMAZzvCPwcVSkc'
)

// ── Test 1: Query general (disciplinas: nutricion, general) ──
console.log('═══ TEST 1: Knowledge Base — Query General ═══\n')

const { data: generalData, error: generalError } = await supabase
  .from('knowledge_base')
  .select('titulo, disciplina, categoria, resumen, puntos_clave, nivel_evidencia')
  .eq('activo', true)
  .is('coach_id', null)
  .in('disciplina', ['nutricion', 'general'])
  .order('verificado', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(8)

if (generalError) {
  console.log('❌ Error:', generalError.message)
  process.exit(1)
}

console.log(`✅ ${generalData.length} artículos encontrados en knowledge_base\n`)

generalData.forEach((row, i) => {
  const nivel = row.nivel_evidencia ? ` [${row.nivel_evidencia}]` : ''
  console.log(`\n--- Artículo ${i + 1}${nivel} ---`)
  console.log(`  Título:     ${row.titulo}`)
  console.log(`  Disciplina: ${row.disciplina}`)
  console.log(`  Categoría:  ${row.categoria || '(sin categoría)'}`)
  if (row.resumen) console.log(`  Resumen:    ${row.resumen.slice(0, 150)}...`)
  if (row.puntos_clave && row.puntos_clave.length > 0) {
    console.log(`  Puntos clave (${row.puntos_clave.length}):`)
    row.puntos_clave.slice(0, 3).forEach(p => console.log(`    • ${p}`))
  }
})

// ── Test 2: Query con condición (ej: diabetes) ──
console.log('\n\n═══ TEST 2: Knowledge Base — Query con condición "diabetes" ═══\n')

const { data: diabetesData, error: diabetesError } = await supabase
  .from('knowledge_base')
  .select('titulo, disciplina, categoria, resumen, puntos_clave, nivel_evidencia')
  .eq('activo', true)
  .is('coach_id', null)
  .in('disciplina', ['nutricion', 'general'])
  .or('condiciones.ov.{"diabetes"}')
  .order('verificado', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(8)

if (diabetesError) {
  console.log('❌ Error:', diabetesError.message)
} else {
  console.log(`✅ ${diabetesData.length} artículos encontrados para "diabetes"\n`)
  diabetesData.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.titulo} [${row.nivel_evidencia || 'N/E'}]`)
    if (row.resumen) console.log(`     ${row.resumen.slice(0, 120)}...`)
  })
}

// ── Test 3: Query con condición (ej: hipertension) ──
console.log('\n\n═══ TEST 3: Knowledge Base — Query con condición "hipertension" ═══\n')

const { data: htaData, error: htaError } = await supabase
  .from('knowledge_base')
  .select('titulo, disciplina, categoria, resumen, puntos_clave, nivel_evidencia')
  .eq('activo', true)
  .is('coach_id', null)
  .in('disciplina', ['nutricion', 'general'])
  .or('condiciones.ov.{"hipertension"}')
  .order('verificado', { ascending: false })
  .order('created_at', { ascending: false })
  .limit(8)

if (htaError) {
  console.log('❌ Error:', htaError.message)
} else {
  console.log(`✅ ${htaData.length} artículos encontrados para "hipertension"\n`)
  htaData.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.titulo} [${row.nivel_evidencia || 'N/E'}]`)
    if (row.resumen) console.log(`     ${row.resumen.slice(0, 120)}...`)
  })
}

// ── Test 4: Mostrar el contexto formateado como lo recibe DeepSeek ──
console.log('\n\n═══ TEST 4: Contexto formateado (como lo ve DeepSeek) ═══\n')

function formatContext(data) {
  if (!data || data.length === 0) return '(sin contexto científico)'
  const parts = ['=== CONOCIMIENTO CIENTÍFICO RELEVANTE ===\n']
  for (const row of data) {
    const cat = row.categoria ? `/${row.categoria}` : ''
    const nivel = row.nivel_evidencia ? ` [${row.nivel_evidencia}]` : ''
    const header = `${row.titulo}${nivel} — ${row.disciplina}${cat}`
    const resumen = row.resumen ? `Resumen: ${row.resumen}` : ''
    const puntos = row.puntos_clave?.length
      ? `Puntos clave:\n- ${row.puntos_clave.join('\n- ')}`
      : ''
    parts.push([header, resumen, puntos].filter(Boolean).join('\n') + '\n')
  }
  return parts.join('\n')
}

const contexto = formatContext([...(generalData || []), ...(diabetesData || []), ...(htaData || [])])
console.log(contexto.slice(0, 2000))

// ── Test 5: Disciplinas disponibles ──
console.log('\n\n═══ TEST 5: Disciplinas disponibles en knowledge_base ═══\n')

const { data: discData, error: discError } = await supabase
  .from('knowledge_base')
  .select('disciplina')
  .eq('activo', true)
  .is('coach_id', null)

if (!discError && discData) {
  const disciplinas = [...new Set(discData.map(r => r.disciplina))]
  console.log(`  ${disciplinas.length} disciplinas: ${disciplinas.join(', ')}`)

  // Contar por disciplina
  for (const d of disciplinas.sort()) {
    const count = discData.filter(r => r.disciplina === d).length
    console.log(`    ${d}: ${count} artículos`)
  }

  console.log(`\n  Total: ${discData.length} artículos activos`)
}

console.log('\n✅ Test completado')
process.exit(0)

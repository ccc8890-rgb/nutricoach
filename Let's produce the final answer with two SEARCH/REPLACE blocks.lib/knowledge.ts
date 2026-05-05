import { SupabaseClient } from '@supabase/supabase-js'

interface KnowledgeRow {
  titulo: string
  disciplina: string
  categoria: string | null
  resumen: string | null
  puntos_clave: string[] | null
}

export async function fetchKnowledgeContext(
  supabase: SupabaseClient,
  opts: {
    disciplinas: string[]
    condiciones?: string[]
    limite?: number
  }
): Promise<string> {
  const { disciplinas, condiciones, limite = 8 } = opts

  // Build query
  let query = supabase
    .from('knowledge_base')
    .select('titulo, disciplina, categoria, resumen, puntos_clave')
    .eq('activo', true)
    .is('coach_id', null)
    .in('disciplina', disciplinas)
    .order('disciplina', { ascending: true })
    .limit(limite)

  // If condiciones provided, add OR condition
  if (condiciones && condiciones.length > 0) {
    // Use .or() with overlaps operator
    const condArray = condiciones.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')
    query = query.or(`condiciones.ov.{${condArray}}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('fetchKnowledgeContext error:', error)
    return ''
  }

  if (!data || data.length === 0) {
    return ''
  }

  const rows = data as KnowledgeRow[]

  const parts: string[] = []
  parts.push('=== CONOCIMIENTO CIENTÍFICO RELEVANTE ===\n')

  for (const row of rows) {
    const title = row.titulo
    const disc = row.disciplina
    const cat = row.categoria ? `/${row.categoria}` : ''
    const header = `[${title} — ${disc}${cat}]`
    const resumen = row.resumen ? `Resumen: ${row.resumen}` : ''
    const puntos = row.puntos_clave && row.puntos_clave.length > 0
      ? `Puntos clave:\n- ${row.puntos_clave.join('\n- ')}`
      : ''

    const block = [header, resumen, puntos].filter(Boolean).join('\n')
    parts.push(block + '\n')
  }

  return parts.join('\n')
}

import { SupabaseClient } from '@supabase/supabase-js'

interface KnowledgeRow {
  titulo: string
  disciplina: string
  categoria: string | null
  resumen: string | null
  puntos_clave: string[] | null
  nivel_evidencia: string | null
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

  // Priorizar estudios verificados primero, luego por fecha de ingesta (más recientes primero)
  let query = supabase
    .from('knowledge_base')
    .select('titulo, disciplina, categoria, resumen, puntos_clave, nivel_evidencia')
    .eq('activo', true)
    .is('coach_id', null)
    .in('disciplina', disciplinas)
    .order('verificado', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite)

  if (condiciones && condiciones.length > 0) {
    const condArray = condiciones.map(c => `"${c.replace(/"/g, '\\"')}"`).join(',')
    query = query.or(`condiciones.ov.{${condArray}}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('fetchKnowledgeContext error:', error)
    return ''
  }

  if (!data || data.length === 0) return ''

  const rows = data as KnowledgeRow[]
  const parts: string[] = ['=== CONOCIMIENTO CIENTÍFICO RELEVANTE ===\n']

  for (const row of rows) {
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

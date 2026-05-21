import { SupabaseClient } from '@supabase/supabase-js'
import { expandirTags, formatearEvidenciaParaPrompt, type ProtocoloCientifico } from './knowledge-base'

/**
 * Versión legacy de consulta de conocimiento científico.
 * AHORA usa TAG_BRIDGE internamente para expandir condiciones a tags de KB.
 *
 * @deprecated Usa seleccionarProtocolos() + formatearEvidenciaParaPrompt() para nuevo código
 */
export async function fetchKnowledgeContext(
  supabase: SupabaseClient,
  opts: {
    disciplinas?: string[]
    condiciones?: string[]
    limite?: number
  }
): Promise<string> {
  const { condiciones, limite = 8 } = opts

  try {
    // 1. Construir tags de búsqueda desde las condiciones (usando TAG_BRIDGE donde aplique)
    const tagsBusqueda = condiciones && condiciones.length > 0
      ? expandirTags(condiciones)
      : []

    // 2. Construir query base sobre knowledge_base
    let query = supabase
      .from('knowledge_base')
      .select('titulo, resumen, contenido_completo, fuente, tags, condiciones, nivel_evidencia')
      .eq('activo', true)
      .is('coach_id', null)
      .order('verificado', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite)

    // 3. Filtrar por tags expandidos si hay condiciones
    if (tagsBusqueda.length > 0) {
      const tagsArray = tagsBusqueda.map(t => `"${t.replace(/"/g, '\\"')}"`).join(',')
      query = query.or(`tags.ov.{${tagsArray}}`)
    }

    const { data, error } = await query

    if (error) {
      console.error('fetchKnowledgeContext error:', error)
      return ''
    }

    if (!data || data.length === 0) return ''

    // 4. Mapear a ProtocoloCientifico[] para usar formatearEvidenciaParaPrompt
    const protocolos: ProtocoloCientifico[] = (data as Array<{
      titulo: string
      resumen: string | null
      contenido_completo: string | null
      fuente: string | null
      tags: string[]
      condiciones: string[]
      nivel_evidencia: string | null
    }>).map((row, i) => {
      const resumen = row.resumen && row.resumen.length > 50
        ? row.resumen
        : (row.contenido_completo || row.resumen || '')

      const referencias = row.fuente
        ? row.fuente.split('|').map(r => r.trim()).filter(Boolean)
        : []

      return {
        id: `kb_${i}`,
        titulo: row.titulo,
        tags: row.tags || [],
        resumen,
        referencias,
      }
    })

    return formatearEvidenciaParaPrompt(protocolos)
  } catch (err) {
    console.error('fetchKnowledgeContext exception:', err)
    return ''
  }
}

// ── Orquestador del pipeline de ingesta ──────────────────────────
// fetch → extract → evaluate → store
//
// Flujo completo:
// 1. Fetch RSS feeds activos
// 2. Parsear XML → PaperRaw[]
// 3. Extraer campos con DeepSeek → PaperExtraido[]
// 4. Evaluar calidad/relevancia → PaperEvaluado[]
// 5. Insertar en knowledge_base los que pasen el threshold

import { createServiceSupabase } from '@/lib/supabase-server'
import { getFuentesActivas } from './fuentes'
import { fetchRSS } from './rss-parser'
import { extractPapers } from './extractor'
import { evaluarPapers } from './evaluador'
import type { ResultadoIngesta, PaperRaw, PaperExtraido, PaperEvaluado } from './tipos'

/**
 * Filtra papers duplicados contra la knowledge_base existente.
 * Usa el DOI si está disponible, o el título como fallback.
 */
async function filtrarDuplicados(
  papers: PaperEvaluado[]
): Promise<{ nuevos: PaperEvaluado[]; duplicados: number }> {
  const supabase = createServiceSupabase()

  const doids = papers.map(p => p.doi).filter(Boolean) as string[]
  const titulos = papers.map(p => p.titulo.toLowerCase().trim())

  let duplicados = 0
  const nuevos: PaperEvaluado[] = []

  // Buscar duplicados por DOI
  if (doids.length > 0) {
    const { data: existentes } = await supabase
      .from('knowledge_base')
      .select('doi')
      .in('doi', doids)

    if (existentes) {
      const doidsExistentes = new Set(existentes.map(e => e.doi))
      for (const paper of papers) {
        if (paper.doi && doidsExistentes.has(paper.doi)) {
          duplicados++
        } else {
          nuevos.push(paper)
        }
      }
    } else {
      nuevos.push(...papers)
    }
  } else {
    nuevos.push(...papers)
  }

  return { nuevos, duplicados }
}

/**
 * Mapea un PaperEvaluado a una fila de knowledge_base.
 */
function mapToKnowledgeBaseRow(paper: PaperEvaluado): Record<string, unknown> {
  return {
    disciplina: paper.disciplina_sugerida,
    categoria: paper.categoria_sugerida,
    tipo: mapTipo(paper.diseno_estudio),
    titulo: paper.titulo,
    resumen: paper.hallazgo_principal,
    contenido_completo: paper.abstract,
    puntos_clave: [
      `Población: ${paper.poblacion}`,
      `Intervención: ${paper.intervencion}`,
      `Resultado: ${paper.resultado_principal}`,
    ],
    fuente: paper.revista ?? paper.autores ?? '',
    url_origen: paper.enlace,
    doi: paper.doi ?? null,
    tags: paper.tags_sugeridos,
    poblacion: paper.keywords,
    condiciones: paper.condiciones_relacionadas,
    nivel_evidencia: mapNivelEvidencia(paper.diseno_estudio),
    fuente_tipo: paper.fuente_tipo === 'pubmed_rss' ? 'scrapeado' : 'manual',
    verificado: false,
    activo: true,
    coach_id: null,
  }
}

/**
 * Mapea diseño de estudio al tipo de knowledge_base.
 */
function mapTipo(diseno: string): string {
  switch (diseno) {
    case 'meta_analisis':
      return 'meta_analisis'
    case 'revision_sistematica':
      return 'revision'
    case 'rct':
      return 'estudio'
    case 'cohorte':
    case 'caso_control':
    case 'transversal':
      return 'estudio'
    default:
      return 'referencia'
  }
}

/**
 * Mapea diseño de estudio a nivel_evidencia.
 */
function mapNivelEvidencia(diseno: string): string {
  switch (diseno) {
    case 'meta_analisis':
      return 'meta_analisis'
    case 'revision_sistematica':
      return 'revision_sistematica'
    case 'rct':
      return 'rct'
    case 'cohorte':
      return 'estudio_observacional'
    case 'caso_control':
      return 'estudio_observacional'
    case 'transversal':
      return 'estudio_observacional'
    default:
      return 'opinion_experto'
  }
}

/**
 * Inserta papers evaluados en knowledge_base.
 * Filtra duplicados y solo inserta los 'incluir'.
 */
async function insertarEnKnowledgeBase(
  papers: PaperEvaluado[]
): Promise<number> {
  if (papers.length === 0) return 0

  const supabase = createServiceSupabase()
  const rows = papers.map(mapToKnowledgeBaseRow)

  const { error, count } = await supabase
    .from('knowledge_base')
    .insert(rows)
    .select('count')

  if (error) {
    console.error('[ingestador] Error insertando en knowledge_base:', error)
    throw error
  }

  return count ?? 0
}

/**
 * Pipeline completo de ingesta:
 * 1. Fetch RSS de todas las fuentes activas
 * 2. Parsear XML
 * 3. Extraer con DeepSeek
 * 4. Evaluar calidad
 * 5. Filtrar duplicados
 * 6. Insertar en knowledge_base
 */
export async function ejecutarIngesta(options?: {
  fuentesIds?: string[]
  skipExtraction?: boolean
  dryRun?: boolean
}): Promise<ResultadoIngesta> {
  const startTime = Date.now()
  const errores: string[] = []

  // 1. Obtener fuentes activas
  const fuentes = options?.fuentesIds
    ? getFuentesActivas().filter(f => options.fuentesIds!.includes(f.id))
    : getFuentesActivas()

  if (fuentes.length === 0) {
    return {
      fuentes_consultadas: 0,
      papers_encontrados: 0,
      papers_extraidos: 0,
      papers_evaluados: 0,
      papers_incluidos: 0,
      papers_insertados: 0,
      errores: ['No hay fuentes activas configuradas'],
      duracion_ms: Date.now() - startTime,
    }
  }

  // 2. Fetch RSS de todas las fuentes
  const rawResults = await Promise.allSettled(
    fuentes.map(f =>
      fetchRSS(f.url, f.tipo).catch(e => {
        throw new Error(`Error en fuente "${f.nombre}": ${e instanceof Error ? e.message : 'error desconocido'}`)
      })
    )
  )

  const todosRaw: PaperRaw[] = []
  for (let i = 0; i < rawResults.length; i++) {
    const result = rawResults[i]
    if (result.status === 'fulfilled') {
      todosRaw.push(...result.value)
    } else {
      errores.push(result.reason.message)
    }
  }

  if (todosRaw.length === 0) {
    return {
      fuentes_consultadas: fuentes.length,
      papers_encontrados: 0,
      papers_extraidos: 0,
      papers_evaluados: 0,
      papers_incluidos: 0,
      papers_insertados: 0,
      errores: errores.length > 0 ? errores : ['No se encontraron papers en las fuentes consultadas'],
      duracion_ms: Date.now() - startTime,
    }
  }

  // 3. Extraer campos con DeepSeek
  let extraidos: PaperExtraido[] = []
  if (options?.skipExtraction) {
    // Modo skip: crear PaperExtraido mínimo desde PaperRaw
    extraidos = todosRaw.map(r => ({
      ...r,
      hallazgo_principal: r.abstract.slice(0, 500),
      poblacion: '',
      intervencion: '',
      resultado_principal: '',
      diseno_estudio: 'no_especificado' as const,
      tamano_muestral: 0,
      keywords: [],
      disciplina_sugerida: 'general',
      categoria_sugerida: 'otro',
      tags_sugeridos: [],
      condiciones_relacionadas: [],
    }))
  } else {
    try {
      extraidos = await extractPapers(todosRaw)
    } catch (e) {
      errores.push(`Error en extracción DeepSeek: ${e instanceof Error ? e.message : 'error desconocido'}`)
    }
  }

  // 4. Evaluar calidad
  const { incluidos } = evaluarPapers(extraidos)

  // 5. Filtrar duplicados
  const { nuevos, duplicados } = await filtrarDuplicados(incluidos)

  // 6. Insertar (excepto si es dry run)
  let insertados = 0
  if (!options?.dryRun && nuevos.length > 0) {
    try {
      insertados = await insertarEnKnowledgeBase(nuevos)
    } catch (e) {
      errores.push(`Error insertando en knowledge_base: ${e instanceof Error ? e.message : 'error desconocido'}`)
    }
  }

  return {
    fuentes_consultadas: fuentes.length,
    papers_encontrados: todosRaw.length,
    papers_extraidos: extraidos.length,
    papers_evaluados: incluidos.length,
    papers_incluidos: nuevos.length,
    papers_insertados: insertados,
    errores,
    duracion_ms: Date.now() - startTime,
  }
}

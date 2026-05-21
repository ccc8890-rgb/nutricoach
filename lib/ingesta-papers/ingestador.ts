// ── Orquestador del pipeline de ingesta ──────────────────────────
// fetch → extract → evaluate → store
//
// Flujo completo:
// 1. Búsqueda PubMed API (esearch + efetch) → PaperRaw[]
// 2. Extraer campos con DeepSeek → PaperExtraido[]
// 3. Evaluar calidad/relevancia → PaperEvaluado[]
// 4. Filtrar duplicados por DOI
// 5. Insertar en knowledge_base los que pasen el threshold

import { createServiceSupabase } from '@/lib/supabase-server'
import { getFuentesActivas } from './fuentes'
import { searchPubMed } from './pubmed-api'
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

  let duplicados = 0
  const nuevos: PaperEvaluado[] = []

  // 1) Filtrar por DOI (primary key)
  if (doids.length > 0) {
    const { data: existentes } = await supabase
      .from('knowledge_base')
      .select('doi')
      .in('doi', doids)

    if (existentes) {
      const doidsExistentes = new Set(existentes.map(e => e.doi))
      const sinDoiRepetido: PaperEvaluado[] = []
      for (const paper of papers) {
        if (paper.doi && doidsExistentes.has(paper.doi)) {
          duplicados++
        } else {
          sinDoiRepetido.push(paper)
        }
      }
      // Reemplazar papers con los que pasaron el filtro DOI
      papers = sinDoiRepetido
    }
  }

  // 2) Fallback: filtrar por título (para papers sin DOI o con DOI nuevo)
  const { data: existentesTitulos } = await supabase
    .from('knowledge_base')
    .select('titulo')

  const titulosExistentes = new Set(
    (existentesTitulos ?? []).map(t => t.titulo.toLowerCase().trim())
  )

  const titulosVistos = new Set<string>()
  for (const paper of papers) {
    const tituloKey = paper.titulo.toLowerCase().trim()
    if (titulosExistentes.has(tituloKey) || titulosVistos.has(tituloKey)) {
      duplicados++
    } else {
      titulosVistos.add(tituloKey)
      nuevos.push(paper)
    }
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
    poblacion: paper.poblacion ? [paper.poblacion] : [],
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

  const { error } = await supabase
    .from('knowledge_base')
    .insert(rows)
    .select()

  if (error) {
    console.error('[ingestador] Error insertando en knowledge_base:', error)
    throw error
  }

  // Todas las filas se insertaron (transacción) o ninguna
  return rows.length
}

/**
 * Registra el resultado de una ejecución en la tabla de auditoría.
 * Proporciona trazabilidad de cada ingesta ejecutada.
 */
async function registrarAuditoria(resultado: ResultadoIngesta): Promise<void> {
  try {
    const supabase = createServiceSupabase()
    await supabase.from('ingesta_auditoria').insert({
      tipo: 'ingesta_pipeline',
      resultado,
      created_at: new Date().toISOString(),
    })
  } catch (e) {
    // El logging no debe romper el pipeline
    console.warn('[ingestador] Error registrando auditoría:', e instanceof Error ? e.message : 'error desconocido')
  }
}

/**
 * Pipeline completo de ingesta:
 * 1. Búsqueda PubMed API (esearch + efetch) → PaperRaw[]
 * 2. Extraer campos con DeepSeek → PaperExtraido[]
 * 3. Evaluar calidad/relevancia → PaperEvaluado[]
 * 4. Filtrar duplicados por DOI
 * 5. Insertar en knowledge_base los que pasen el threshold
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
      papers_duplicados: 0,
      papers_insertados: 0,
      errores: ['No hay fuentes activas configuradas'],
      duracion_ms: Date.now() - startTime,
    }
  }

  // 2. Buscar en PubMed API (esearch + efetch) secuencialmente
  // para respetar rate limiting de NCBI (10 req/s max)
  const todosRaw: PaperRaw[] = []
  for (const fuente of fuentes) {
    try {
      console.log(`[ingestador] Consultando fuente: ${fuente.nombre}...`)
      const papers = await searchPubMed(fuente.query, 'pubmed_rss' as any, 15)
      console.log(`[ingestador]   → ${papers.length} papers encontrados`)
      todosRaw.push(...papers)
    } catch (e) {
      const msg = `Error en fuente "${fuente.nombre}": ${e instanceof Error ? e.message : 'error desconocido'}`
      errores.push(msg)
      console.warn(`[ingestador] ${msg}`)
    }
  }

  if (todosRaw.length === 0) {
    return {
      fuentes_consultadas: fuentes.length,
      papers_encontrados: 0,
      papers_extraidos: 0,
      papers_evaluados: 0,
      papers_incluidos: 0,
      papers_duplicados: 0,
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

  const resultado: ResultadoIngesta = {
    fuentes_consultadas: fuentes.length,
    papers_encontrados: todosRaw.length,
    papers_extraidos: extraidos.length,
    papers_evaluados: incluidos.length,
    papers_incluidos: nuevos.length,
    papers_duplicados: duplicados,
    papers_insertados: insertados,
    errores,
    duracion_ms: Date.now() - startTime,
  }

  // Registrar en auditoría (fire & forget — no debe romper el pipeline)
  registrarAuditoria(resultado)

  return resultado
}

// ── Tipos compartidos del pipeline de ingesta de papers ───────────

export type FuenteTipo =
  | 'pubmed_rss'
  | 'arxiv'
  | 'google_scholar'
  | 'twitter'
  | 'manual'

export type DisenoEstudio =
  | 'rct'
  | 'meta_analisis'
  | 'revision_sistematica'
  | 'cohorte'
  | 'caso_control'
  | 'transversal'
  | 'opinion_experto'
  | 'no_especificado'

export interface PaperRaw {
  /** Título del paper */
  titulo: string
  /** URL/DOI del paper */
  enlace: string
  /** Abstract o resumen */
  abstract: string
  /** Fecha de publicación */
  fecha_publicacion: string
  /** DOI si está disponible */
  doi?: string
  /** Fuente de donde se obtuvo */
  fuente_tipo: FuenteTipo
  /** Revista o venue */
  revista?: string
  /** Autores (primer autor + et al) */
  autores?: string
}

export interface PaperExtraido {
  titulo: string
  abstract: string
  doi?: string
  enlace: string
  fecha_publicacion: string
  fuente_tipo: FuenteTipo
  revista?: string
  autores?: string

  /** Campos extraídos por DeepSeek */
  hallazgo_principal: string
  poblacion: string
  intervencion: string
  resultado_principal: string
  diseno_estudio: DisenoEstudio
  tamano_muestral: number
  keywords: string[]
  disciplina_sugerida: string
  categoria_sugerida: string
  tags_sugeridos: string[]
  condiciones_relacionadas: string[]
}

export interface PaperEvaluado extends PaperExtraido {
  score_revista: number       // 0-3
  score_diseno: number        // 1-5
  score_muestra: number       // 1-3
  score_relevancia: number    // 0-5
  score_total: number         // Suma (threshold >= 7)
  recomendacion: 'incluir' | 'revisar' | 'descartar'
  motivo_rechazo?: string
}

export interface ResultadoIngesta {
  fuentes_consultadas: number
  papers_encontrados: number
  papers_extraidos: number
  papers_evaluados: number
  papers_incluidos: number
  papers_duplicados: number
  papers_insertados: number
  errores: string[]
  duracion_ms: number
}

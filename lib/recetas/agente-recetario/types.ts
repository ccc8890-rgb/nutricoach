export type RecetaAgenteEstado = 'en_revision' | 'descartada'
export type RecetaAgentePrioridad = 'alta' | 'media' | 'baja'

export type RecetaCoverageGap = {
  objetivo: string
  deporte?: string
  momento?: string
  tipoPlato?: string
  actuales: number
  minimo: number
  prioridad: RecetaAgentePrioridad
  motivo: string
}

export type IngredienteCandidato = {
  nombre: string
  alimentoId?: string
  alimentoNombre?: string
  cantidadGramos: number
  rolIngrediente: string
  esCantidadFija?: boolean
}

export type RecetaCandidata = {
  nombre: string
  descripcion: string
  instrucciones: string[]
  objetivos: string[]
  deportes: string[]
  momentos: string[]
  tipoPlato: string
  digestibilidad?: string
  ingredientes: IngredienteCandidato[]
  macrosCalculados?: {
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
  }
  trazabilidad: {
    plantillaId: string
    motivoGeneracion: string
    modo: 'dry-run' | 'apply'
  }
}

export type ResultadoValidacionAgente = {
  valida: boolean
  estado: RecetaAgenteEstado
  score: number
  errores: string[]
  warnings: string[]
}

export const AGENTE_RECETARIO_DEFAULTS = {
  dryRun: true,
  forceReviewState: 'en_revision',
  allowAutoApproval: false,
  allowUnmatchedIngredients: false,
  allowImageAutoApproval: false,
  minQualityScore: 75,
  maxCandidatesPerRun: 10,
} as const

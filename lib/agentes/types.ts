// ================================================================
// SISTEMA DE AGENTES IA — Tipos compartidos
// ================================================================

export type TipoAgente = 'revisor_semanal' | 'riesgo' | 'memoria' | 'director'

export type TipoTarea =
  | 'revision_semanal'
  | 'ajuste_macros'
  | 'alerta_riesgo'
  | 'mensaje_motivacion'
  | 'propuesta_receta'
  | 'actualizacion_plan'

export type EstadoTarea =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado'
  | 'modificado'
  | 'aplicado'

export interface AgenteTarea {
  id: string
  tipo: TipoTarea
  cliente_id: string | null
  agente: TipoAgente
  estado: EstadoTarea
  prioridad: number
  payload: Record<string, unknown>
  propuesta: string | null
  comentario_coach: string | null
  razonamiento: string | null
  fuentes: FuenteCientifica[]
  created_at: string
  updated_at: string
  revisado_at: string | null
  aplicado_at: string | null
}

export interface FuenteCientifica {
  autores: string
  año: number
  titulo: string
  conclusión: string
}

export interface ClientePerfilAprendizaje {
  id: string
  cliente_id: string
  adherencia_media: number
  dias_activos_30d: number
  checkins_completados: number
  mejor_dia_semana: string | null
  peor_dia_semana: string | null
  hora_checkin_habitual: string | null
  macros_cumplidos_pct: number
  peso_tendencia: 'bajando' | 'subiendo' | 'estable'
  variabilidad_peso: number
  alimentos_preferidos: PreferenciaAlimento[]
  alimentos_evitados: PreferenciaAlimento[]
  recetas_mejor_valoradas: string[]
  riesgo_abandono: number
  semanas_sin_mejora: number
  ultima_actualizacion: string
}

export interface PreferenciaAlimento {
  alimento_id: string
  nombre: string
  score: number
}

export interface AgenteAprendizaje {
  id: string
  tarea_id: string
  cliente_id: string
  agente: TipoAgente
  tipo_tarea: TipoTarea
  decision: 'aprobado' | 'rechazado' | 'modificado'
  propuesta_original: string | null
  propuesta_final: string | null
  comentario_coach: string | null
  score_confianza: number | null
  created_at: string
}

export interface CoachMemoria {
  id: string
  categoria: 'metodologia' | 'preferencia' | 'regla' | 'excepcion'
  clave: string
  valor: string
  contexto: string | null
  ejemplos: unknown[]
  peso: number
  veces_usado: number
  creado_por: 'coach' | 'agente_aprendizaje'
  created_at: string
  updated_at: string
}

// ── Contexto que recibe cada agente al ejecutarse ──────────────
export interface ContextoCliente {
  cliente: {
    id: string
    nombre: string | null
    apellidos: string | null
    objetivo: string | null
    peso_inicial: number | null
    altura: number | null
    edad: number | null
    sexo: string | null
  }
  plan_activo: {
    id: string
    kcal_objetivo: number
    proteinas_objetivo: number
    carbohidratos_objetivo: number
    grasas_objetivo: number
  } | null
  checkins_recientes: CheckinResumen[]
  perfil_aprendizaje: ClientePerfilAprendizaje | null
  metodologia_coach: CoachMemoria[]
}

export interface CheckinResumen {
  id: string
  fecha_checkin: string
  peso_kg: number | null
  adherencia_dieta: number | null
  nivel_energia: number | null
  calidad_sueno: number | null
  notas_cliente: string | null
}

// ── Resultado que devuelve cada agente ────────────────────────
export interface ResultadoAgente {
  tipo: TipoTarea
  propuesta: string
  razonamiento: string
  payload: Record<string, unknown>
  fuentes: FuenteCientifica[]
  prioridad: number
  score_confianza: number  // 0-1
  requiere_aprobacion: boolean  // false = auto-aplica (ajuste menor)
}

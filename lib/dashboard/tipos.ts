export type Severity = 'critica' | 'alta' | 'media' | 'baja'
export type TodayAction = {
  id: string
  tipo: string
  title: string
  cliente_id: string | null
  cliente_nombre: string
  detail: string
  meta: string
  severity: Severity
  href: string
  cta: string
}

export type ClienteRiesgo = {
  cliente_id: string
  cliente_nombre: string
  riesgo: 'alto' | 'medio' | 'bajo'
  score: number
  signals: string[]
  accion: string
  href: string
}

export type InboxIa = {
  id: string
  tipo: string
  agente: string
  prioridad: number
  propuesta: string | null
  cliente_id: string | null
  cliente_nombre: string
  href: string
  created_at: string
}

export type Competicion = {
  id: string
  nombre: string
  disciplina: string | null
  fecha_competicion: string
  dias: number
  estado: 'hoy' | 'race_week' | 'tapering' | 'normal'
  cliente_id: string
  cliente_nombre: string
}

export type CommandData = {
  hoy: TodayAction[]
  clientes_riesgo: ClienteRiesgo[]
  inbox_ia: InboxIa[]
  operacion: {
    clientes_activos: number
    planes_nutricion_activos: number
    planes_entreno_activos: number
    checkins_pendientes: number
    revisiones_7d: number
    revisiones_30d: number
    membresias_30d: number
    respuestas_pendientes: number
  }
  competiciones: Competicion[]
  timestamp: string
}

export type CosteCliente = {
  cliente_id: string
  nombre: string
  plan_nombre: string | null
  coste_semanal_min: number
  coste_semanal_max: number
  coste_diario: number
  ingredientes_sin_precio: number
  total_ingredientes: number
}

export type NegocioData = {
  resumen: {
    ingresos_30d: number
    ingresos_mes_actual: number
    mrr_estimado: number
    transacciones_30d: number
    clientes_membresia_activa: number
    membresias_7d: number
    membresias_30d: number
    clientes_sin_membresia: number
  }
  transacciones_recientes: Array<{
    id: string
    cliente_id: string
    cliente_nombre: string
    importe: number
    fecha: string
    estado: string
    origen: string
    plan_tipo: string | null
    href: string
  }>
  pagos_pendientes: Array<{
    id: string
    cliente_id: string
    cliente_nombre: string
    motivo: string
    severity: 'alta' | 'media'
    importe_estimado: number
    href: string
  }>
  renovaciones: Array<{
    cliente_id: string
    cliente_nombre: string
    tipo_membresia: string | null
    fecha_fin_membresia: string | null
    dias: number | null
    importe_estimado: number
    href: string
  }>
  embudo: {
    nuevos_sin_pago: number
    links_generados: number
    pagos_completados: number
    clientes_activados: number
  }
  timestamp: string
}

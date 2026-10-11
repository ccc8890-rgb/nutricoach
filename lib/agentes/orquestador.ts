export type ModoDirector = 'diario' | 'semanal'
export type EstadoEjecucionDirector = 'completado' | 'completado_con_errores'

export type PasoDirector =
  | 'perfil_aprendizaje'
  | 'perfil_gusto'
  | 'riesgo_nutricion'
  | 'riesgo_entreno'
  | 'readiness'
  | 'supercoach'
  | 'revisor_semanal'
  | 'revisor_semanal_entreno'
  | 'training_brain'
  | 'motivacion'
  | 'retencion'

export interface SenalesDirectorCliente {
  clienteId: string
  tienePlanNutricion: boolean
  tienePlanEntreno: boolean
  diasSinCheckin: number | null
  diasSinSesion: number | null
  sesiones7d: number
  pendientes: Array<{ tipo: string; agente: string }>
}

export interface PlanDirectorCliente {
  clienteId: string
  modo: ModoDirector
  ejecutar: Record<PasoDirector, boolean>
  motivos: string[]
  presionInbox: 'normal' | 'alta'
}

const ORDEN_PASOS_DIRECTOR: PasoDirector[] = [
  'perfil_aprendizaje',
  'perfil_gusto',
  'riesgo_nutricion',
  'retencion',
  'riesgo_entreno',
  'readiness',
  'supercoach',
  'revisor_semanal',
  'motivacion',
  'revisor_semanal_entreno',
  'training_brain',
]

export function resolverPasosDirector(
  plan: PlanDirectorCliente,
  dryRun: boolean
): PasoDirector[] {
  if (dryRun) return []
  return ORDEN_PASOS_DIRECTOR.filter(paso => plan.ejecutar[paso])
}

export function resolverEstadoEjecucion(errores: string[]): EstadoEjecucionDirector {
  return errores.length === 0 ? 'completado' : 'completado_con_errores'
}

function hasPending(s: SenalesDirectorCliente, tipo: string, agente?: string): boolean {
  return s.pendientes.some(t => t.tipo === tipo && (!agente || t.agente === agente))
}

function inboxPressure(s: SenalesDirectorCliente): 'normal' | 'alta' {
  return s.pendientes.length >= 12 ? 'alta' : 'normal'
}

// Agentes de entreno del sistema antiguo, apagados el 11-10-2026: leían tablas
// que nadie rellena (registros_sets, actividad_externa_cliente) y daban avisos
// falsos («99 días sin sesiones»); lo cubren el panel de Rendimiento
// (avisos-rendimiento, analisis-rendimiento) y «Planificar con IA».
// Para reactivarlos basta poner esto a true.
const AGENTES_ENTRENO_ANTIGUOS_ACTIVOS = false

export function crearPlanDirectorCliente(
  senales: SenalesDirectorCliente,
  modo: ModoDirector
): PlanDirectorCliente {
  const presionInbox = inboxPressure(senales)
  const semanal = modo === 'semanal'
  const sinCheckin = senales.diasSinCheckin === null || senales.diasSinCheckin >= 7
  const sinEntreno = senales.diasSinSesion === null || senales.diasSinSesion >= 7
  const checkinReciente = senales.diasSinCheckin !== null && senales.diasSinCheckin <= 7
  const entrenoReciente = senales.diasSinSesion !== null && senales.diasSinSesion <= 3
  const hayCargaReciente = senales.sesiones7d > 0 || entrenoReciente

  const riesgoNutricion =
    sinCheckin &&
    !hasPending(senales, 'alerta_riesgo') &&
    presionInbox === 'normal'

  const riesgoEntreno =
    senales.tienePlanEntreno &&
    sinEntreno &&
    !hasPending(senales, 'alerta_riesgo_entreno') &&
    presionInbox === 'normal'

  const readiness =
    senales.tienePlanEntreno &&
    !hasPending(senales, 'alerta_readiness') &&
    !hasPending(senales, 'ajuste_nutricion_carga') &&
    (semanal || hayCargaReciente)

  const supercoach =
    (senales.tienePlanNutricion || senales.tienePlanEntreno) &&
    !hasPending(senales, 'ajuste_nutricion_carga', 'supercoach') &&
    !hasPending(senales, 'actualizacion_plan', 'supercoach') &&
    (semanal || hayCargaReciente || checkinReciente)

  const revisorSemanal = semanal && senales.tienePlanNutricion
  const revisorSemanalEntreno = semanal && senales.tienePlanEntreno
  const trainingBrain =
    semanal &&
    senales.tienePlanEntreno &&
    senales.sesiones7d >= 2 &&
    !hasPending(senales, 'training_brain') &&
    presionInbox === 'normal'
  const motivacion = semanal && checkinReciente && presionInbox === 'normal'

  const ejecutar: Record<PasoDirector, boolean> = {
    perfil_aprendizaje: true,
    perfil_gusto: true,
    riesgo_nutricion: riesgoNutricion,
    riesgo_entreno: AGENTES_ENTRENO_ANTIGUOS_ACTIVOS && riesgoEntreno,
    readiness: AGENTES_ENTRENO_ANTIGUOS_ACTIVOS && readiness,
    supercoach: AGENTES_ENTRENO_ANTIGUOS_ACTIVOS && supercoach,
    revisor_semanal: revisorSemanal,
    revisor_semanal_entreno: AGENTES_ENTRENO_ANTIGUOS_ACTIVOS && revisorSemanalEntreno,
    training_brain: AGENTES_ENTRENO_ANTIGUOS_ACTIVOS && trainingBrain,
    motivacion,
    retencion: true,
  }

  const motivos: string[] = []
  if (presionInbox === 'alta') motivos.push('inbox_con_muchas_tareas_pendientes')
  if (riesgoNutricion) motivos.push(`riesgo_nutricion_${senales.diasSinCheckin ?? 'sin'}d_sin_checkin`)
  if (ejecutar.riesgo_entreno) motivos.push(`riesgo_entreno_${senales.diasSinSesion ?? 'sin'}d_sin_sesion`)
  if (ejecutar.readiness) motivos.push('readiness_por_carga_o_revision')
  if (ejecutar.supercoach) motivos.push('supercoach_con_contexto_suficiente')
  if (ejecutar.revisor_semanal || ejecutar.revisor_semanal_entreno) motivos.push('revision_semanal_programada')
  if (motivacion) motivos.push('motivacion_semanal_con_checkin_reciente')

  return {
    clienteId: senales.clienteId,
    modo,
    ejecutar,
    motivos,
    presionInbox,
  }
}

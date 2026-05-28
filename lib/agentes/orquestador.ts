export type ModoDirector = 'diario' | 'semanal'

export type PasoDirector =
  | 'perfil_aprendizaje'
  | 'perfil_gusto'
  | 'riesgo_nutricion'
  | 'riesgo_entreno'
  | 'readiness'
  | 'supercoach'
  | 'revisor_semanal'
  | 'revisor_semanal_entreno'
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

function hasPending(s: SenalesDirectorCliente, tipo: string, agente?: string): boolean {
  return s.pendientes.some(t => t.tipo === tipo && (!agente || t.agente === agente))
}

function inboxPressure(s: SenalesDirectorCliente): 'normal' | 'alta' {
  return s.pendientes.length >= 12 ? 'alta' : 'normal'
}

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
  const motivacion = semanal && checkinReciente && presionInbox === 'normal'

  const ejecutar: Record<PasoDirector, boolean> = {
    perfil_aprendizaje: true,
    perfil_gusto: true,
    riesgo_nutricion: riesgoNutricion,
    riesgo_entreno: riesgoEntreno,
    readiness,
    supercoach,
    revisor_semanal: revisorSemanal,
    revisor_semanal_entreno: revisorSemanalEntreno,
    motivacion,
    retencion: true, // always check for retention risk daily
  }

  const motivos: string[] = []
  if (presionInbox === 'alta') motivos.push('inbox_con_muchas_tareas_pendientes')
  if (riesgoNutricion) motivos.push(`riesgo_nutricion_${senales.diasSinCheckin ?? 'sin'}d_sin_checkin`)
  if (riesgoEntreno) motivos.push(`riesgo_entreno_${senales.diasSinSesion ?? 'sin'}d_sin_sesion`)
  if (readiness) motivos.push('readiness_por_carga_o_revision')
  if (supercoach) motivos.push('supercoach_con_contexto_suficiente')
  if (revisorSemanal || revisorSemanalEntreno) motivos.push('revision_semanal_programada')
  if (motivacion) motivos.push('motivacion_semanal_con_checkin_reciente')

  return {
    clienteId: senales.clienteId,
    modo,
    ejecutar,
    motivos,
    presionInbox,
  }
}


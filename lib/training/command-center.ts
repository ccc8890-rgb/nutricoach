export type CommandCenterEstado = 'fatiga' | 'revision_ia' | 'sin_actividad' | 'progreso' | 'estable'
export type CommandCenterTono = 'critico' | 'atencion' | 'ok' | 'neutro'

export interface CommandCenterTask {
  id: string
  tipo: string
  prioridad: number | null
  propuesta: string | null
}

export interface CommandCenterInput {
  cliente_id: string
  plan_id: string
  nombre: string
  apellidos: string
  plan_nombre: string
  sesiones_objetivo: number | null
  sesiones_7d: number
  sesiones_28d: number
  rpe_media_7d: number | null
  pr_count_7d: number
  ultima_fecha: string | null
  dots: boolean[]
  tareas_pendientes: CommandCenterTask[]
  flags_altas: number
}

export interface CommandCenterRow extends CommandCenterInput {
  estado: CommandCenterEstado
  tono: CommandCenterTono
  prioridad_score: number
  requiere_accion: boolean
  accion_principal: string
  razon: string
  adherencia_7d_pct: number | null
  carga_score: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function round1(value: number) {
  return Math.round(value * 10) / 10
}

function calcularAdherencia(sesiones: number, objetivo: number | null): number | null {
  if (!objetivo || objetivo <= 0) return null
  return Math.round((sesiones / objetivo) * 100)
}

function mejorPrioridad(tareas: CommandCenterTask[]): number | null {
  const valores = tareas
    .map(t => t.prioridad)
    .filter((v): v is number => typeof v === 'number')
  if (!valores.length) return null
  return Math.min(...valores)
}

export function calcularCommandCenterRow(input: CommandCenterInput): CommandCenterRow {
  const adherencia = calcularAdherencia(input.sesiones_7d, input.sesiones_objetivo)
  const rpe = input.rpe_media_7d
  const fatiga = input.flags_altas > 0 || (rpe !== null && rpe >= 8.5) || input.sesiones_7d >= 6
  const revisionIa = input.tareas_pendientes.length > 0
  const sinActividad = !input.ultima_fecha || (adherencia !== null && adherencia < 50)
  const progreso = input.pr_count_7d > 0 || (adherencia !== null && adherencia >= 90 && (rpe ?? 10) <= 7)

  let estado: CommandCenterEstado = 'estable'
  let tono: CommandCenterTono = 'neutro'
  let prioridad = 100
  let accion = 'Revisar'
  let razon = 'Cliente estable. Revisar progresión y próxima sesión cuando toque.'

  if (fatiga) {
    estado = 'fatiga'
    tono = 'critico'
    prioridad = 500
    accion = 'Revisar carga'
    razon = rpe !== null && rpe >= 8.5
      ? `RPE medio ${round1(rpe)} en la última semana. Conviene revisar intensidad antes de progresar.`
      : input.flags_altas > 0
        ? 'Hay señales altas de carga, recuperación o riesgo en los datos recientes.'
        : `${input.sesiones_7d} sesiones en 7 días. Revisar acumulación de fatiga.`
  } else if (revisionIa) {
    estado = 'revision_ia'
    tono = 'atencion'
    prioridad = 400
    accion = 'Aprobar IA'
    razon = input.tareas_pendientes[0]?.propuesta || 'Hay recomendaciones IA pendientes de revisión.'
  } else if (sinActividad) {
    estado = 'sin_actividad'
    tono = 'atencion'
    prioridad = 300
    accion = 'Reactivar'
    razon = !input.ultima_fecha
      ? 'Sin sesiones registradas recientemente. Conviene revisar adherencia o fricción.'
      : `Adherencia semanal ${adherencia}%. Priorizar cumplimiento antes de subir carga.`
  } else if (progreso) {
    estado = 'progreso'
    tono = 'ok'
    prioridad = 200
    accion = 'Progresar'
    razon = input.pr_count_7d > 0
      ? `${input.pr_count_7d} PR${input.pr_count_7d === 1 ? '' : 's'} esta semana. Revisar si toca progresar o consolidar.`
      : `Adherencia ${adherencia}% con RPE controlado. Hay margen para progresión.`
  }

  const taskPriority = mejorPrioridad(input.tareas_pendientes)
  const taskBonus = taskPriority !== null ? Math.max(0, 20 - taskPriority) : 0
  const cargaScore = clamp(Math.round(input.sesiones_7d * ((rpe ?? 6.5) / 10) * 100), 0, 999)

  return {
    ...input,
    estado,
    tono,
    prioridad_score: prioridad + taskBonus,
    requiere_accion: estado !== 'estable' && estado !== 'progreso',
    accion_principal: accion,
    razon,
    adherencia_7d_pct: adherencia,
    carga_score: cargaScore,
  }
}

export function ordenarCommandCenterRows(rows: CommandCenterRow[]): CommandCenterRow[] {
  return [...rows].sort((a, b) => {
    if (b.prioridad_score !== a.prioridad_score) return b.prioridad_score - a.prioridad_score
    const aFecha = a.ultima_fecha ? new Date(a.ultima_fecha).getTime() : 0
    const bFecha = b.ultima_fecha ? new Date(b.ultima_fecha).getTime() : 0
    return aFecha - bFecha
  })
}

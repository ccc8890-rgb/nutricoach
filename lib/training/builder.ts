const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export interface BuilderExerciseDraft {
  id: string
  ejercicio_id: string
  ejercicio_nombre: string
  ejercicio_grupo: string
  ejercicio_tipo: string
  series: number
  repeticiones: string
  descanso_segundos: number
  peso_sugerido: string
  notas: string
  orden: number
}

export interface BuilderSessionDraft {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  notas: string
  expandida: boolean
  ejercicios: BuilderExerciseDraft[]
}

export interface BuilderLoadSummary {
  totalSesiones: number
  totalSets: number
  diasProgramados: number
  sesionesFuertes: number
  minutosEstimados: number
  tone: 'ok' | 'warn' | 'alert'
  alertas: string[]
}

function siguienteDia(dia: string) {
  const idx = DIAS.indexOf(dia)
  return idx >= 0 ? DIAS[(idx + 1) % DIAS.length] : ''
}

function renumerarSesiones(sesiones: BuilderSessionDraft[]) {
  return sesiones.map((sesion, index) => ({
    ...sesion,
    orden: index,
    ejercicios: sesion.ejercicios.map((ejercicio, ejercicioIndex) => ({
      ...ejercicio,
      orden: ejercicioIndex,
    })),
  }))
}

export function duplicarSesionBuilder(
  sesiones: BuilderSessionDraft[],
  sesionId: string,
  createId: (prefix: string) => string
) {
  const index = sesiones.findIndex(sesion => sesion.id === sesionId)
  if (index < 0) return sesiones

  const original = sesiones[index]
  const copiaId = createId('sesion')
  const copia: BuilderSessionDraft = {
    ...original,
    id: copiaId,
    nombre: `${original.nombre} copia`,
    dia_semana: siguienteDia(original.dia_semana),
    expandida: true,
    ejercicios: original.ejercicios.map((ejercicio, ejercicioIndex) => ({
      ...ejercicio,
      id: `${copiaId}-ej-${ejercicioIndex}`,
      orden: ejercicioIndex,
    })),
  }

  return renumerarSesiones([
    ...sesiones.slice(0, index + 1),
    copia,
    ...sesiones.slice(index + 1),
  ])
}

export function moverSesionBuilder(
  sesiones: BuilderSessionDraft[],
  sesionId: string,
  direction: 'up' | 'down'
) {
  const index = sesiones.findIndex(sesion => sesion.id === sesionId)
  if (index < 0) return sesiones

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= sesiones.length) return renumerarSesiones(sesiones)

  const next = [...sesiones]
  const current = next[index]
  next[index] = next[targetIndex]
  next[targetIndex] = current

  return renumerarSesiones(next)
}

export function crearBuilderLoadSummary(sesiones: BuilderSessionDraft[]): BuilderLoadSummary {
  const totalSesiones = sesiones.length
  const totalSets = sesiones.reduce((total, sesion) => total + sesion.ejercicios.reduce((sum, ejercicio) => sum + (ejercicio.series || 0), 0), 0)
  const diasProgramados = new Set(sesiones.map(sesion => sesion.dia_semana).filter(Boolean)).size
  const sesionesFuertes = sesiones.filter(sesion => {
    const sets = sesion.ejercicios.reduce((sum, ejercicio) => sum + (ejercicio.series || 0), 0)
    const fuerzaSets = sesion.ejercicios
      .filter(ejercicio => ejercicio.ejercicio_tipo === 'fuerza' || ejercicio.ejercicio_tipo === 'funcional' || ejercicio.ejercicio_tipo === 'cardio')
      .reduce((sum, ejercicio) => sum + (ejercicio.series || 0), 0)
    return sets >= 8 || fuerzaSets >= 6
  }).length
  const descansoMin = sesiones.reduce((total, sesion) => (
    total + sesion.ejercicios.reduce((sum, ejercicio) => sum + ((ejercicio.series || 0) * (ejercicio.descanso_segundos || 0) / 60), 0)
  ), 0)
  const ejecucionMin = totalSets * 1.5
  const minutosEstimados = Math.round(descansoMin + ejecucionMin + totalSesiones * 8)

  const alertas = [
    totalSesiones > 5 ? 'Más de 5 sesiones: revisa sostenibilidad semanal' : null,
    sesionesFuertes >= 2 ? 'Semana exigente: revisa recuperación y distribución de intensidad' : null,
    diasProgramados > 0 && totalSesiones > diasProgramados ? 'Hay días con varias sesiones: comprueba solapamientos' : null,
  ].filter((alerta): alerta is string => Boolean(alerta))

  const tone: BuilderLoadSummary['tone'] = alertas.length >= 2 ? 'alert' : alertas.length === 1 ? 'warn' : 'ok'

  return {
    totalSesiones,
    totalSets,
    diasProgramados,
    sesionesFuertes,
    minutosEstimados,
    tone,
    alertas,
  }
}

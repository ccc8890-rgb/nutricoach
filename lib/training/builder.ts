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

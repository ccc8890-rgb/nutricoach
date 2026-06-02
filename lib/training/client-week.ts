export interface ClienteWeekSession {
  id: string
  nombre: string
  dia_semana: string
  duracion_estimada_min: number | null
  ejercicios_count: number
  completada: boolean
  esHoy: boolean
}

export interface ClienteWeekSummary {
  totalSesiones: number
  completadas: number
  pendientes: number
  progresoPct: number
  minutosPlanificados: number
  estadoSemana: 'sin_plan' | 'pendiente' | 'en_curso' | 'completa'
  sesionPrincipal: ClienteWeekSession | null
  mensajeCliente: string
}

export function crearClienteWeekSummary({ sesiones }: { sesiones: ClienteWeekSession[] }): ClienteWeekSummary {
  const totalSesiones = sesiones.length
  const completadas = sesiones.filter(s => s.completada).length
  const pendientes = Math.max(totalSesiones - completadas, 0)
  const progresoPct = totalSesiones > 0 ? Math.round((completadas / totalSesiones) * 100) : 0
  const minutosPlanificados = sesiones.reduce((total, s) => total + (s.duracion_estimada_min ?? 0), 0)
  const sesionHoy = sesiones.find(s => s.esHoy)
  const siguientePendiente = sesiones.find(s => !s.completada)
  const sesionPrincipal = sesionHoy ?? siguientePendiente ?? sesiones[0] ?? null

  const estadoSemana: ClienteWeekSummary['estadoSemana'] = totalSesiones === 0
    ? 'sin_plan'
    : completadas === totalSesiones
      ? 'completa'
      : completadas === 0
        ? 'pendiente'
        : 'en_curso'

  let mensajeCliente = 'Tu coach todavía no ha cargado sesiones para esta semana.'
  if (estadoSemana === 'completa') {
    mensajeCliente = 'Semana completada. Registra sensaciones si falta algún detalle para tu coach.'
  } else if (sesionHoy && !sesionHoy.completada) {
    mensajeCliente = `Hoy toca ${sesionHoy.nombre}. Ejecuta con control y registra sensaciones al terminar.`
  } else if (sesionHoy?.completada) {
    mensajeCliente = `${sesionHoy.nombre} ya está marcada como hecha. Revisa recuperación y prepara la siguiente.`
  } else if (siguientePendiente) {
    mensajeCliente = `Próxima sesión: ${siguientePendiente.nombre}. Puedes revisarla antes de entrenar.`
  }

  return {
    totalSesiones,
    completadas,
    pendientes,
    progresoPct,
    minutosPlanificados,
    estadoSemana,
    sesionPrincipal,
    mensajeCliente,
  }
}

export function aplicarSesionesCompletadas(
  sesiones: ClienteWeekSession[],
  completadasIds: string[]
): ClienteWeekSession[] {
  const completadas = new Set(completadasIds)
  return sesiones.map(sesion => ({
    ...sesion,
    completada: completadas.has(sesion.id),
  }))
}

export type EstadoSaludFuente =
  | 'desconectada'
  | 'sin_datos'
  | 'saludable'
  | 'retrasada'
  | 'desactualizada'
  | 'error'

export interface SaludFuente {
  estado: EstadoSaludFuente
  ultimaRecepcion: string | null
  antiguedadHoras: number | null
  puedeInterpretarAusencia: boolean
  mensaje: string
  accion: string | null
}

export interface SaludFuenteInput {
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
  ultima_fecha_datos: string | null
  ahora?: Date
}

export function sanitizarErrorIntegracion(error: string | null | undefined): string | null {
  if (!error?.trim()) return null
  return error
    .replace(/([?&](?:access_token|refresh_token|token|code|secret|password)=)[^&\s]+/gi, '$1[oculto]')
    .replace(/(["']?(?:access_token|refresh_token|token|code|secret|password)["']?\s*[:=]\s*["']?)[^"',;\s}&]+/gi, '$1[oculto]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [oculto]')
    .slice(0, 180)
}

const HORAS_SALUDABLE = 48
const HORAS_RETRASADA = 168

function parseFecha(value: string | null): Date | null {
  if (!value) return null
  const fecha = new Date(value)
  return Number.isFinite(fecha.getTime()) ? fecha : null
}

/**
 * Clasifica el estado operativo de una fuente. Los umbrales son de operación,
 * no clínicos: hasta 48 h saludable, hasta 168 h retrasada y después
 * desactualizada.
 */
export function evaluarSaludFuente(input: SaludFuenteInput): SaludFuente {
  const ahora = input.ahora ?? new Date()
  const recepciones = [parseFecha(input.ultima_sync), parseFecha(input.ultima_fecha_datos)]
    .filter((fecha): fecha is Date => fecha !== null)
  const ultimaFecha = recepciones.length > 0
    ? new Date(Math.max(...recepciones.map(fecha => fecha.getTime())))
    : null
  const ultimaRecepcion = ultimaFecha?.toISOString() ?? null
  const antiguedadHorasExacta = ultimaFecha
    ? Math.max(0, (ahora.getTime() - ultimaFecha.getTime()) / 3_600_000)
    : null
  const antiguedadHoras = antiguedadHorasExacta === null
    ? null
    : Math.round(antiguedadHorasExacta * 10) / 10

  if (!input.activa) {
    return {
      estado: 'desconectada',
      ultimaRecepcion,
      antiguedadHoras,
      puedeInterpretarAusencia: false,
      mensaje: 'Fuente desconectada.',
      accion: 'Conectar la fuente para recibir datos.',
    }
  }

  if (input.error_ultimo?.trim()) {
    return {
      estado: 'error',
      ultimaRecepcion,
      antiguedadHoras,
      puedeInterpretarAusencia: false,
      mensaje: 'La última sincronización terminó con un error.',
      accion: 'Revisar la conexión y volver a sincronizar.',
    }
  }

  if (antiguedadHoras === null) {
    return {
      estado: 'sin_datos',
      ultimaRecepcion: null,
      antiguedadHoras: null,
      puedeInterpretarAusencia: false,
      mensaje: 'Fuente conectada, todavía sin datos recibidos.',
      accion: 'Sincronizar la fuente por primera vez.',
    }
  }

  if (antiguedadHorasExacta !== null && antiguedadHorasExacta <= HORAS_SALUDABLE) {
    return {
      estado: 'saludable',
      ultimaRecepcion,
      antiguedadHoras,
      puedeInterpretarAusencia: true,
      mensaje: 'Datos recibidos con normalidad.',
      accion: null,
    }
  }

  if (antiguedadHorasExacta !== null && antiguedadHorasExacta <= HORAS_RETRASADA) {
    return {
      estado: 'retrasada',
      ultimaRecepcion,
      antiguedadHoras,
      puedeInterpretarAusencia: true,
      mensaje: 'La recepción de datos lleva más de 48 horas de retraso.',
      accion: 'Abrir la app del proveedor y volver a sincronizar.',
    }
  }

  return {
    estado: 'desactualizada',
    ultimaRecepcion,
    antiguedadHoras,
    puedeInterpretarAusencia: false,
    mensaje: 'Los datos llevan más de 7 días sin actualizarse.',
    accion: 'Reconectar la fuente antes de interpretar la actividad.',
  }
}

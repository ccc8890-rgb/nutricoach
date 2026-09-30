import type { GeneracionInicialResponse } from './generacion-inicial'

export type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class GenerationClientError extends Error {
  constructor(
    public readonly codigo: string,
    message: string,
    public readonly accion: string,
    public readonly retryable: boolean,
  ) {
    super(message)
    this.name = 'GenerationClientError'
  }
}

export interface GenerarPlanInicialDesdeClienteInput {
  cliente_id: string
  idempotency_key: string
  fetchImpl?: FetchImpl
}

interface ApiErrorBody {
  error?: {
    codigo?: string
    mensaje?: string
    accion?: string
  } | string
}

interface MappedGenerationError {
  codigo: string
  mensaje: string
  accion: string
  retryable: boolean
}

const ERROR_BY_STATUS: Record<number, MappedGenerationError> = {
  401: {
    codigo: 'AUTH_EXPIRED',
    mensaje: 'Tu sesión ha caducado.',
    accion: 'Vuelve a iniciar sesión y reintenta.',
    retryable: false,
  },
  403: {
    codigo: 'FORBIDDEN',
    mensaje: 'No tienes permiso para generar este plan.',
    accion: 'No tienes permiso para generar este plan.',
    retryable: false,
  },
  429: {
    codigo: 'RATE_LIMITED',
    mensaje: 'Has alcanzado el límite temporal de solicitudes.',
    accion: 'Espera un momento y reintenta.',
    retryable: true,
  },
}

function errorForResponse(status: number, body: ApiErrorBody): GenerationClientError {
  const mapped = ERROR_BY_STATUS[status] ?? (status >= 500
    ? {
        codigo: 'SERVER_ERROR',
        mensaje: 'No se pudo crear el plan en este momento.',
        accion: 'Reintenta; tu plan anterior sigue activo.',
        retryable: true,
      }
    : {
        codigo: 'GENERATION_REQUEST_FAILED',
        mensaje: 'No se pudo iniciar la generación del plan.',
        accion: 'Revisa los datos e inténtalo de nuevo.',
        retryable: false,
      })
  const apiError = typeof body.error === 'object' ? body.error : undefined

  return new GenerationClientError(
    mapped.codigo,
    apiError?.mensaje ?? (typeof body.error === 'string' ? body.error : mapped.mensaje),
    mapped.accion,
    mapped.retryable,
  )
}

export async function generarPlanInicialDesdeCliente(
  input: GenerarPlanInicialDesdeClienteInput,
): Promise<GeneracionInicialResponse> {
  const fetchImpl = input.fetchImpl ?? globalThis.fetch
  let response: Response

  try {
    response = await fetchImpl('/api/generar-plan-inicial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        cliente_id: input.cliente_id,
        idempotency_key: input.idempotency_key,
        origen: 'onboarding',
      }),
    })
  } catch {
    throw new GenerationClientError(
      'NETWORK_ERROR',
      'No se pudo contactar con el servicio de generación.',
      'Comprueba tu conexión y reintenta.',
      true,
    )
  }

  const body = await response.json().catch(() => ({})) as GeneracionInicialResponse & ApiErrorBody
  if (!response.ok) throw errorForResponse(response.status, body)

  if (!body.ok) {
    const error = typeof body.error === 'object' ? body.error : undefined
    throw new GenerationClientError(
      error?.codigo ?? 'GENERATION_FAILED',
      error?.mensaje ?? 'No se pudo completar la generación inicial.',
      error?.accion ?? 'Reintenta; tu plan anterior sigue activo.',
      true,
    )
  }

  return body
}

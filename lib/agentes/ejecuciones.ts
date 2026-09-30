export type EstadoEjecucion = 'ejecutando' | 'completado' | 'completado_con_errores' | 'fallido'

export interface AgenteEjecucion {
  id: string
  modo: 'diario' | 'semanal'
  origen: 'cron' | 'manual' | 'sistema'
  dry_run: boolean
  estado: EstadoEjecucion
  clientes_procesados: number
  tareas_generadas: number
  errores: string[]
  duracion_ms: number | null
  iniciado_at: string
  finalizado_at: string | null
}

export function normalizarLimiteEjecuciones(valor: string | null): number {
  const parsed = Number.parseInt(valor ?? '', 10)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(50, Math.max(1, parsed))
}

export function formatearDuracionEjecucion(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 60_000) return `${(ms / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`
  const minutos = Math.floor(ms / 60_000)
  const segundos = Math.floor((ms % 60_000) / 1000)
  return `${minutos} min ${segundos} s`
}

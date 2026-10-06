export const TAREAS_REVISION = ['pendientes', 'nuevas_hoy', 'bloqueos', 'sin_foto', 'todas'] as const

export type TareaRevision = (typeof TAREAS_REVISION)[number]

export type QualityIssues = {
  bloqueantes?: string[] | null
  avisos?: string[] | null
}

export function normalizarTareaRevision(value: string | null): TareaRevision {
  return TAREAS_REVISION.includes(value as TareaRevision) ? value as TareaRevision : 'pendientes'
}

export function esRecetaAprobable(estado: string | null, issues: QualityIssues | null): boolean {
  return (estado === 'en_revision' || estado === 'borrador') && (issues?.bloqueantes?.length ?? 0) === 0
}

function partesMadrid(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fecha)
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(p => p.type === tipo)?.value)
  return { year: valor('year'), month: valor('month'), day: valor('day') }
}

function offsetMadridMs(fecha: Date): number {
  const nombre = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'longOffset',
  }).formatToParts(fecha).find(p => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
  const match = nombre.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const minutos = Number(match[2]) * 60 + Number(match[3])
  return (match[1] === '+' ? 1 : -1) * minutos * 60_000
}

function medianocheMadridUtc(year: number, month: number, day: number): Date {
  const aproximada = new Date(Date.UTC(year, month - 1, day))
  return new Date(aproximada.getTime() - offsetMadridMs(aproximada))
}

export function inicioFinDiaMadridUtc(ahora = new Date()): { inicio: string; fin: string } {
  const { year, month, day } = partesMadrid(ahora)
  const siguiente = new Date(Date.UTC(year, month - 1, day + 1))
  return {
    inicio: medianocheMadridUtc(year, month, day).toISOString(),
    fin: medianocheMadridUtc(siguiente.getUTCFullYear(), siguiente.getUTCMonth() + 1, siguiente.getUTCDate()).toISOString(),
  }
}

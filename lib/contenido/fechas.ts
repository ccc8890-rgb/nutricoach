// Fechas como 'YYYY-MM-DD'. Se calcula en UTC a mediodía para evitar saltos por zona horaria u horario de verano.
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const
export const FRANJAS_TANDA = ['Comida', 'Cena'] as const
export const MAX_SEMANAS_FUTURAS = 8
const FORMATO = /^\d{4}-\d{2}-\d{2}$/

function aDate(fecha: string): Date | null {
  if (!FORMATO.test(fecha)) return null
  const d = new Date(`${fecha}T12:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function aTexto(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function sumarDias(fecha: string, n: number): string {
  const d = aDate(fecha)
  if (!d) throw new Error('Fecha no válida')
  d.setUTCDate(d.getUTCDate() + n)
  return aTexto(d)
}

export function lunesDe(fecha: string): string {
  const d = aDate(fecha)
  if (!d) throw new Error('Fecha no válida')
  const desdeLunes = (d.getUTCDay() + 6) % 7
  return sumarDias(fecha, -desdeLunes)
}

/** Semana (1 = la próxima respecto a `hoy`) y día de la semana de una fecha, o null si no cae en las semanas planificables (+1…+8). */
export function semanaYDia(fecha: string, hoy: string): { semana: number; dia: string } | null {
  const d = aDate(fecha)
  const h = aDate(hoy)
  if (!d || !h) return null
  const dias = Math.round((aDate(lunesDe(fecha))!.getTime() - aDate(lunesDe(hoy))!.getTime()) / 86_400_000)
  const semana = dias / 7
  if (!Number.isInteger(semana) || semana < 1 || semana > MAX_SEMANAS_FUTURAS) return null
  return { semana, dia: DIAS[(d.getUTCDay() + 6) % 7] }
}

/** Dos recetas por día (Comida y Cena) desde la fecha de grabación. */
export function repartirEnDieta(n: number, fecha: string): { fecha: string; franja: typeof FRANJAS_TANDA[number] }[] {
  return Array.from({ length: n }, (_, i) => ({
    fecha: sumarDias(fecha, Math.floor(i / FRANJAS_TANDA.length)),
    franja: FRANJAS_TANDA[i % FRANJAS_TANDA.length],
  }))
}

/** Hoy en Madrid como 'YYYY-MM-DD'. */
export function hoyMadrid(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' })
}

export function formatoFecha(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y}`
}

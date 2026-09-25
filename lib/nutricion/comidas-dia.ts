/**
 * Helper compartido para resolver qué comidas corresponden a un día concreto.
 *
 * Reglas:
 * - Comida SIN `dia_semana` (ausente, null, vacío o solo espacios) → recurrente,
 *   aparece todos los días.
 * - Comida CON `dia_semana` válido (nombre completo de día, con o sin acentos,
 *   mayúsculas o espacios sobrantes) → aparece SOLO ese día.
 * - Comida con `dia_semana` DESCONOCIDO (texto no reconocido) → NO pertenece a
 *   ningún día: nunca es recurrente y nunca se asigna a un día concreto.
 *
 * El matching es EXACTO sobre el nombre normalizado del día (sin acentos,
 * minúsculas, sin espacios sobrantes). No se usa `includes`, para evitar
 * falsos positivos (p. ej. "Lun" o "Funday" no son días válidos).
 */

export const DIAS_SEMANA = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
] as const

export const DIAS_SEMANA_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const

export type DiaSemana = typeof DIAS_SEMANA[number]

function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const DIAS_NORMALIZADOS = DIAS_SEMANA.map(normalizarTexto)

/**
 * Devuelve el índice (0=Lunes … 6=Domingo) del día indicado, o `null` si el
 * texto no corresponde a un día válido (incluye vacío, null y undefined).
 */
export function indiceDiaDesdeTexto(dia: string | null | undefined): number | null {
  if (!dia) return null
  const norm = normalizarTexto(dia)
  if (!norm) return null
  const idx = DIAS_NORMALIZADOS.indexOf(norm)
  return idx >= 0 ? idx : null
}

/**
 * Índice del día local actual (0=Lunes … 6=Domingo).
 */
export function diaActualIndex(fecha: Date = new Date()): number {
  const js = fecha.getDay() // 0=Domingo … 6=Sábado
  return (js + 6) % 7
}

/**
 * ¿Esta comida corresponde al día indicado?
 * - Sin `dia_semana` (ausente, null, vacío o solo espacios) → recurrente (true).
 * - Con día válido → true solo si coincide exactamente.
 * - Con texto desconocido → false (no pertenece a ningún día).
 */
export function esComidaDelDia(
  comida: { dia_semana?: string | null },
  diaIndex: number,
): boolean {
  const raw = comida.dia_semana
  // Sin valor (ausente, null, vacío o solo espacios) → recurrente.
  if (raw == null || normalizarTexto(raw) === '') return true
  const idx = indiceDiaDesdeTexto(raw)
  // Texto desconocido → no pertenece a ningún día.
  if (idx === null) return false
  return idx === diaIndex
}

/**
 * Filtra las comidas del día indicado y las ordena por `orden` (ascendente).
 * No muta el array original.
 */
export function comidasDelDia<T extends { dia_semana?: string | null; orden: number }>(
  comidas: T[] | null | undefined,
  diaIndex: number,
): T[] {
  return (comidas ?? [])
    .filter(c => esComidaDelDia(c, diaIndex))
    .slice()
    .sort((a, b) => a.orden - b.orden)
}
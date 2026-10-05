export function normalizarHoraInicio(valor: unknown): string | null | undefined {
  if (valor === null) return null
  if (typeof valor !== 'string') return undefined
  return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(valor) ? valor : undefined
}

export function normalizarComidasDia(valor: unknown): 2 | 3 | 4 | 5 | null | undefined {
  if (valor === null) return null
  return valor === 2 || valor === 3 || valor === 4 || valor === 5 ? valor : undefined
}

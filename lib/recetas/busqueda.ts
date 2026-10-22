// Búsqueda de recetas por palabras sueltas: «tarta chocolate» encuentra «Tarta de chocolate con…».
// Las palabras de relleno («de», «con», «y») no cuentan salvo que sean lo único escrito.

export const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras que deben aparecer todas (en cualquier orden), en minúsculas y con tildes tal como se escribieron. */
export function palabrasDeBusqueda(q: string | null | undefined): string[] {
  const palabras = (q ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const clave = palabras.filter(w => w.length > 2)
  return clave.length > 0 ? clave : palabras
}

/** Filtro en memoria: todas las palabras aparecen en el texto, sin distinguir tildes ni mayúsculas. */
export function coincidePalabras(texto: string | null | undefined, palabras: string[]): boolean {
  if (palabras.length === 0) return true
  const t = sinTildes(texto ?? '')
  return palabras.every(w => t.includes(sinTildes(w)))
}

/** Filtro en una consulta Supabase: un `ilike` por palabra (todas deben aparecer). No ignora tildes (límite de `ilike`). */
export function aplicarBusquedaNombre<T extends { ilike: (columna: string, valor: string) => T }>(consulta: T, q: string | null | undefined, columna = 'nombre'): T {
  let resultado = consulta
  for (const w of palabrasDeBusqueda(q)) resultado = resultado.ilike(columna, `%${w.replace(/[%_,()]/g, ' ').trim()}%`)
  return resultado
}

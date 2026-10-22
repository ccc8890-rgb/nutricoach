// Búsqueda de recetas por palabras sueltas: «tarta chocolate» encuentra «Tarta de chocolate con…».
// Las palabras de relleno («de», «con», «y») no cuentan salvo que sean lo único escrito.

export const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras que deben aparecer todas (en cualquier orden), en minúsculas y con tildes tal como se escribieron. */
export function palabrasDeBusqueda(q: string | null | undefined): string[] {
  const palabras = (q ?? '').toLowerCase().trim().split(/\s+/).filter(Boolean)
  const clave = palabras.filter(w => w.length > 2)
  return clave.length > 0 ? clave : palabras
}

// Nombres que en el recetario se usan indistintamente (español / inglés / coloquial): buscar uno encuentra los demás.
// (No se agrupan «cake» ni «bol»: son subcadenas de «pancake», «cheesecake» y «boloñesa» y traerían resultados que no son.)
const GRUPOS_SINONIMOS: string[][] = [
  ['tarta', 'pastel', 'cheesecake'],
  ['tostada', 'tosta', 'toast'],
  ['galleta', 'cookie'],
  ['tortita', 'pancake'],
  ['hamburguesa', 'burger'],
  ['batido', 'smoothie', 'shake'],
  ['gofre', 'waffle'],
  ['magdalena', 'muffin'],
  ['rosquilla', 'donut'],
]

/** Variantes de una palabra: ella misma y los nombres equivalentes de su grupo (sin tildes, singular). */
export function variantesDe(palabra: string): string[] {
  const base = sinTildes(palabra).replace(/(es|s)$/, '')
  const grupo = GRUPOS_SINONIMOS.find(g => g.includes(base) || g.includes(sinTildes(palabra)))
  return grupo ? [...new Set([palabra.toLowerCase(), ...grupo])] : [palabra.toLowerCase()]
}

/** Filtro en memoria: todas las palabras (o un sinónimo de cada una) aparecen en el texto, sin distinguir tildes ni mayúsculas. */
export function coincidePalabras(texto: string | null | undefined, palabras: string[]): boolean {
  if (palabras.length === 0) return true
  const t = sinTildes(texto ?? '')
  return palabras.every(w => variantesDe(w).some(v => t.includes(sinTildes(v))))
}

/**
 * Filtro en una consulta Supabase sobre `recetas`: por palabra, ella o un sinónimo (`or` de `ilike`); todas deben aparecer.
 * Busca en `nombre_busqueda` (nombre en minúsculas y sin tildes, columna generada) con la palabra también sin tildes:
 * «limon» encuentra «Limón». Migración `20261022170000_recetas_nombre_busqueda.sql`.
 */
export function aplicarBusquedaNombre<T extends { ilike: (columna: string, valor: string) => T; or: (filtros: string) => T }>(consulta: T, q: string | null | undefined, columna = 'nombre_busqueda'): T {
  let resultado = consulta
  for (const w of palabrasDeBusqueda(q)) {
    const variantes = variantesDe(w.replace(/[%_,()]/g, ' ').trim()).map(sinTildes).filter(Boolean)
    resultado = variantes.length > 1
      ? resultado.or(variantes.map(v => `${columna}.ilike.%${v}%`).join(','))
      : resultado.ilike(columna, `%${variantes[0] ?? ''}%`)
  }
  return resultado
}

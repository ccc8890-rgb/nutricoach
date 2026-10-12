import { escalarGramos } from '@/components/premium/SelectorRaciones'

// Equivalencias caseras de uso común. Solo se muestran cuando los gramos encajan
// (±10 %) con un múltiplo de 0,5 unidades (mínimo 1); si no, se deja solo el peso.
const REGLAS: { re: RegExp; no?: RegExp; g: number; uno: string; varios: string; entero?: boolean }[] = [
  { re: /\bclaras?\b/, g: 33, uno: 'clara', varios: 'claras', entero: true },
  { re: /\byemas?\b/, g: 18, uno: 'yema', varios: 'yemas', entero: true },
  { re: /^huevos?\b/, no: /polvo|codorniz|pasteurizado/, g: 60, uno: 'huevo', varios: 'huevos', entero: true },
  { re: /^yogur(es)?\b/, no: /polvo|bebible|liquido|salsa/, g: 125, uno: 'yogur', varios: 'yogures', entero: true },
  { re: /^aceite\b/, g: 10, uno: 'cucharada', varios: 'cucharadas' },
  { re: /^cacao en polvo/, g: 10, uno: 'cucharada', varios: 'cucharadas' },
  { re: /^(crema|mantequilla|pasta) de (avellana|cacahuete|almendra|pistacho|anacardo)s?\b/, g: 15, uno: 'cucharada', varios: 'cucharadas' },
  { re: /^queso (crema|untar)/, g: 30, uno: 'cucharada', varios: 'cucharadas' },
  { re: /^miel\b/, g: 20, uno: 'cucharada', varios: 'cucharadas' },
]

const normalizar = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const CONTABLE = /^(unidad(es)?|u|uds?|piezas?|dientes?|hojas?|rodajas?|lonchas?|rebanadas?|huevos?|claras?|yemas?|yogur(es)?)$/i

function equivalenciaAuto(nombre: string, gramos: number): { n: number; unidad: string; contable: boolean } | null {
  const nom = normalizar(nombre)
  const regla = REGLAS.find(r => r.re.test(nom) && !(r.no && r.no.test(nom)))
  if (!regla || gramos <= 0) return null
  // lo contable (huevos, yogures) va en unidades enteras; las cucharadas admiten medias
  const n = regla.entero ? Math.round(gramos / regla.g) : Math.round((gramos / regla.g) * 2) / 2
  const tope = regla.uno === 'cucharada' ? 6 : 12
  if (n < 1 || n > tope || Math.abs(gramos - n * regla.g) > regla.g * 0.1) return null
  return { n, unidad: n === 1 ? regla.uno : regla.varios, contable: !!regla.entero }
}

/** «120g (2 huevos)»: los gramos mandan (macros), la equivalencia casera evita pesar.
 * Usa la guardada en la receta; si no hay, la deduce del nombre del ingrediente. */
export function formatoCantidad(
  gramos: number,
  factor: number,
  cantidadOriginal?: number | null,
  unidadDisplay?: string | null,
  nombre?: string | null,
): string {
  const base = `${escalarGramos(gramos, factor)}g`
  // Solo se añade el paréntesis cuando ayuda a ver «cuántos» (2 huevos, 3 dientes…). Taza, cucharada, cucharadita,
  // «1 unidad» o los mismos gramos repetidos no aportan: los gramos mandan.
  if (cantidadOriginal && unidadDisplay?.trim()) {
    const n = Math.round(cantidadOriginal * factor * 10) / 10
    const unidad = unidadDisplay.trim()
    return n >= 2 && CONTABLE.test(unidad) ? `${base} (${n} ${unidad})` : base
  }
  const auto = nombre ? equivalenciaAuto(nombre, gramos * factor) : null
  return auto && auto.contable && auto.n >= 2 ? `${base} (${auto.n} ${auto.unidad})` : base
}

// Elaboraciones como ingrediente: aplanado a ingredientes base y macros. Funciones puras (sin Supabase).
// Las cantidades de una receta son de la receta ENTERA; las de una elaboración, de la elaboración entera.

export type AlimentoMacros = {
  id?: string; nombre?: string; categoria?: string | null; es_generico?: boolean | null
  calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra?: number | null
}

export type Linea = {
  id?: string
  alimento_id?: string | null
  elaboracion_id?: string | null
  nombre_libre?: string | null
  cantidad_gramos: number
  orden?: number | null
  es_opcional?: boolean | null
  rol_ingrediente?: string | null
  es_cantidad_fija?: boolean | null
  alimento?: AlimentoMacros | null
}

export type Elaboracion = { peso_final_g: number | null; lineas: Linea[] }

export type Macros = { kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }

export class CicloElaboracion extends Error {
  constructor() { super('Esa elaboración ya contiene a esta receta'); this.name = 'CicloElaboracion' }
}

const PROFUNDIDAD_MAXIMA = 2

/** Peso del producto terminado: el declarado si es > 0; si no, la suma de los gramos de sus líneas. */
export function pesoFinal(e: Elaboracion): number {
  if (e.peso_final_g && e.peso_final_g > 0) return e.peso_final_g
  return e.lineas.reduce((a, x) => a + (Number(x.cantidad_gramos) || 0), 0)
}

/**
 * Sustituye cada línea con `elaboracion_id` por las líneas base de esa elaboración, escaladas por gramos usados / peso final.
 * Lanza CicloElaboracion si una elaboración se contiene a sí misma o a `raiz` (la receta que se está calculando).
 * Lo que no se puede expandir (más de 2 niveles, elaboración ausente o de peso 0) no entra en `lineas` y su id va a `sinResolver`.
 */
export function aplanarLineas(
  lineas: Linea[],
  elaboraciones: Map<string, Elaboracion>,
  opciones: { maxProfundidad?: number; raiz?: string } = {},
): { lineas: Linea[]; sinResolver: string[] } {
  const max = opciones.maxProfundidad ?? PROFUNDIDAD_MAXIMA
  const salida: Linea[] = []
  const sinResolver: string[] = []

  const recorrer = (ls: Linea[], factor: number, profundidad: number, ancestros: string[], prefijo: string, ordenPadre: number | null) => {
    for (const l of ls) {
      const idLinea = l.id ?? ''
      if (!l.elaboracion_id) {
        salida.push({ ...l, id: prefijo ? `${prefijo}:${idLinea}` : l.id, cantidad_gramos: (Number(l.cantidad_gramos) || 0) * factor, orden: ordenPadre ?? l.orden })
        continue
      }
      const eid = l.elaboracion_id
      if (ancestros.includes(eid) || eid === opciones.raiz) throw new CicloElaboracion()
      if (profundidad >= max) { sinResolver.push(idLinea || eid); continue }
      const e = elaboraciones.get(eid)
      const pf = e ? pesoFinal(e) : 0
      if (!e || pf <= 0) { sinResolver.push(idLinea || eid); continue }
      const usados = (Number(l.cantidad_gramos) || 0) * factor
      recorrer(e.lineas, usados / pf, profundidad + 1, [...ancestros, eid], prefijo ? `${prefijo}:${idLinea}` : idLinea, ordenPadre ?? l.orden ?? null)
    }
  }
  recorrer(lineas, 1, 0, [], '', null)
  return { lineas: salida, sinResolver }
}

function sumar(lineas: Linea[]): Macros {
  const t: Macros = { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
  for (const l of lineas) {
    const a = l.alimento
    if (!a || !a.calorias) continue // misma regla que la fase 4 de scripts/pipeline-calidad.mjs
    const f = (Number(l.cantidad_gramos) || 0) / 100
    t.kcal += (a.calorias || 0) * f
    t.proteinas += (a.proteinas || 0) * f
    t.carbohidratos += (a.carbohidratos || 0) * f
    t.grasas += (a.grasas || 0) * f
    t.fibra += (a.fibra || 0) * f
  }
  return t
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Valores por 100 g de producto final de una elaboración (líneas ya planas). */
export function macrosPor100g(lineas: Linea[], pesoFinalG: number): Macros {
  if (!(pesoFinalG > 0)) return { kcal: 0, proteinas: 0, carbohidratos: 0, grasas: 0, fibra: 0 }
  const t = sumar(lineas)
  const k = 100 / pesoFinalG
  return { kcal: t.kcal * k, proteinas: t.proteinas * k, carbohidratos: t.carbohidratos * k, grasas: t.grasas * k, fibra: t.fibra * k }
}

/** Macros por ración de una receta (líneas ya planas), redondeados a 1 decimal. */
export function macrosPorRacion(lineasPlanas: Linea[], porciones: number): Macros {
  const t = sumar(lineasPlanas)
  const p = Math.max(1, Number(porciones) || 1)
  return { kcal: r1(t.kcal / p), proteinas: r1(t.proteinas / p), carbohidratos: r1(t.carbohidratos / p), grasas: r1(t.grasas / p), fibra: r1(t.fibra / p) }
}

/** Suma los gramos de las líneas con el mismo alimento (tras aplanar, harina propia + harina de la masa = una sola línea). */
export function agruparPorAlimento(lineas: Linea[]): Linea[] {
  const porAlimento = new Map<string, Linea>()
  const salida: Linea[] = []
  for (const l of lineas) {
    if (!l.alimento_id) { salida.push(l); continue }
    const previa = porAlimento.get(l.alimento_id)
    if (previa) previa.cantidad_gramos += Number(l.cantidad_gramos) || 0
    else { const copia = { ...l, cantidad_gramos: Number(l.cantidad_gramos) || 0 }; porAlimento.set(l.alimento_id, copia); salida.push(copia) }
  }
  return salida
}

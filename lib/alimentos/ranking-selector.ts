// Orden y agrupación de los resultados al AÑADIR un alimento (editor de recetas, constructor de dietas).
// Meta: ir al grano, 3-5 opciones razonables. El catálogo tiene 12.000 alimentos (la mayoría productos de supermercado) y solo ~1.000 base.
//  1) lo que ES la palabra buscada va antes que lo que solo la contiene («Mantequilla» antes que «Croissant de mantequilla»)
//  2) los alimentos base (usados, BEDCA, del coach) van antes que el resto y las fuentes fiables antes que las estimadas
//  3) las variantes que solo cambian de marca o envase («Mantequilla Tarrina», «Pastilla», «Rulo») se agrupan en una

export type AlimentoBusqueda = { id: string; nombre: string | null; categoria?: string | null; fuente?: string | null; es_base?: boolean | null }

export const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const CATEGORIAS_ELABORADAS = /bebida|condimento|dulce|boller|snack|platos preparados|suplemento/i
const CONECTORES = /\b(de|del|con|sabor|para|en|sin|tipo|estilo|banad[oa]s?|rellen[oa]s?)\b/
const MARCAS = /\b(hacendado|carrefour|eroski|alcampo|lidl|dia|mercadona|bonpreu|esclat|gallina blanca|president|danone|pascual|puleva|kellogg|bimbo|knorr|carbonell)\b/g
const ENVASE = /\b(tarrina|pastilla|rulo|bolsa|bote|botella|paquete|lata|frasco|bandeja|pack|brick|caja|und|unidades|lonchas|porciones|barra|tarro|sobre|sobres)\b/g
const FUENTE: Record<string, number> = { bedca: 0, curada: 1, coach: 1, openfoodfacts: 2, ia: 3 }

/** Dos alimentos con la misma clave son «el mismo» a efectos de elegir: solo cambian marca, envase o cifras del formato. */
export function claveAgrupacion(nombre: string): string {
  return sinTildes(nombre).replace(MARCAS, ' ').replace(ENVASE, ' ').replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|l|%|und)?\b/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function puntuar(a: AlimentoBusqueda, qn: string): number {
  const n = sinTildes(a.nombre ?? '')
  const palabras = qn.split(/\s+/).filter(Boolean)
  const cabeza = n.split(CONECTORES)[0].replace(/[^a-z0-9 ]/g, ' ').trim()
  const toks = cabeza.split(/\s+/)
  let tier: number
  if (palabras.length > 1) {
    tier = n === qn ? 0 : n.startsWith(qn) ? 1 : n.includes(qn) ? 2 : 4 // varias palabras: la frase completa antes que las palabras sueltas
  } else if (n === qn) tier = 0
  else if (cabeza === qn) tier = 1.4 // «Yogur sabor coco», «Chocolate con avellanas»: variantes con apellido, después de «Yogur natural», «Chocolate negro»
  else if (toks[0] === qn) tier = 1
  else if (toks.includes(qn)) tier = 2
  else if (new RegExp(`\\b${qn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(n)) tier = 6 // la palabra solo aparece tras «de/con/sabor»: croissant de mantequilla
  else tier = 9 // dentro de otra palabra (re-pollo)
  // la categoría «dulces/bebidas…» solo penaliza si la palabra no es lo que ES el alimento (el chocolate negro SÍ es un dulce)
  const elaborado = tier >= 2 && CATEGORIAS_ELABORADAS.test(a.categoria ?? '') ? 1.5 : 0
  return tier + elaborado + (a.es_base ? -3 : 0) + (FUENTE[a.fuente ?? 'ia'] ?? 3) * 0.1 + Math.min(n.length, 80) / 1000
}

/** Ordena y agrupa variantes; conserva el primero (el mejor) de cada grupo. */
export function rankearParaSelector<T extends AlimentoBusqueda>(filas: T[], q: string): T[] {
  const qn = sinTildes(q.trim())
  const vistos = new Set<string>()
  const salida: T[] = []
  for (const { a } of filas.map(a => ({ a, s: puntuar(a, qn) })).sort((x, y) => x.s - y.s)) {
    const k = claveAgrupacion(a.nombre ?? '') || (a.id)
    if (vistos.has(k)) continue
    vistos.add(k)
    salida.push(a)
  }
  return salida
}

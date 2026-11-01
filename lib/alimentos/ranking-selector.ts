// Orden y agrupación de los resultados al AÑADIR un alimento (editor de recetas, constructor de dietas).
// Meta: ir al grano, 3-5 opciones razonables. El catálogo tiene 12.000 alimentos (la mayoría productos de supermercado) y solo ~1.000 base.
//  1) lo que ES la palabra buscada va antes que lo que solo la contiene («Mantequilla» antes que «Croissant de mantequilla»)
//  2) los alimentos base (usados, BEDCA, del coach) van antes que el resto y las fuentes fiables antes que las estimadas
//  3) las variantes que solo cambian de marca o envase («Mantequilla Tarrina», «Pastilla», «Rulo») se agrupan en una
//  4) si además tienen los mismos macros y la misma primera palabra («Bacón Hacendado cintas», «Bacón Oscar Mayer lonchas»), son el mismo producto simple:
//     sale una sola fila, con el nombre limpio de marca y formato (la marca es imposible de listar entera, los macros no mienten)

export type AlimentoBusqueda = {
  id: string; nombre: string | null; categoria?: string | null; fuente?: string | null; es_base?: boolean | null
  calorias?: number | null; proteinas?: number | null; carbohidratos?: number | null; grasas?: number | null
}

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

/** Nombre para mostrar: sin marca, envase, medidas ni fracciones de formato («Bacon 1/ 5 M» → «Bacon»). Si queda vacío, el original. */
export function nombreSimple(nombre: string): string {
  const limpio = nombre
    .replace(new RegExp(MARCAS.source, 'gi'), ' ')
    .replace(new RegExp(ENVASE.source, 'gi'), ' ')
    .replace(/\b\d+\s*\/\s*\d+(\s*[a-zA-Z]\b)?/g, ' ')
    .replace(/\b\d+([.,]\d+)?\s*(g|kg|ml|l|und)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim()
  return limpio.length >= 3 ? limpio : nombre
}

/** Producto simple = primera palabra + macros redondeados (+ la frase buscada si son varias palabras). Sin macros, cae a la clave por nombre. */
function claveProducto(a: AlimentoBusqueda, qn: string): string {
  const nombre = a.nombre ?? ''
  if (a.calorias == null || a.calorias <= 0) return claveAgrupacion(nombre) || a.id
  // fuentes fiables (BEDCA/curada/coach): sus apellidos son descriptores reales («Arroz bomba» ≠ «Arroz basmati»); en el resto suelen ser marca
  const toks = sinTildes(nombreSimple(nombre)).replace(/[^a-z ]/g, ' ').trim().split(/\s+/)
  const fiable = ['bedca', 'curada', 'coach'].includes(a.fuente ?? '')
  const primera = (fiable ? toks.slice(0, 2).join(' ') : toks[0])?.replace(/s\b/g, '') ?? ''
  const frase = qn.includes(' ') ? qn : ''
  return `${primera}|${frase}|${Math.round(a.calorias / 25)}|${Math.round((a.proteinas ?? 0) / 3)}|${Math.round((a.carbohidratos ?? 0) / 6)}|${Math.round((a.grasas ?? 0) / 4)}`
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

/** Ordena y agrupa variantes; conserva el primero (el mejor) de cada grupo. Si el grupo junta varias marcas, se muestra solo lo que tienen en común. */
export function rankearParaSelector<T extends AlimentoBusqueda>(filas: T[], q: string): T[] {
  const qn = sinTildes(q.trim())
  const grupos = new Map<string, { mejor: T; nombres: string[] }>()
  const claveDe = new Map<string, string>() // clave por nombre → clave de grupo ya creado
  for (const { a } of filas.map(a => ({ a, s: puntuar(a, qn) })).sort((x, y) => x.s - y.s)) {
    const kn = sinTildes(nombreSimple(a.nombre ?? '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() || claveAgrupacion(a.nombre ?? '') || a.id
    const k = claveDe.get(kn) ?? claveProducto(a, qn)
    claveDe.set(kn, k)
    const g = grupos.get(k)
    if (g) g.nombres.push(a.nombre ?? '')
    else grupos.set(k, { mejor: a, nombres: [a.nombre ?? ''] })
  }
  return [...grupos.values()].map(({ mejor, nombres }) => {
    const simples = nombres.map(nombreSimple)
    return { ...mejor, nombre: simples.length > 1 ? prefijoComun(simples) || simples[0] : simples[0] }
  })
}

function prefijoComun(nombres: string[]): string {
  const toks = nombres.map(n => n.split(/\s+/))
  const comun: string[] = []
  for (let i = 0; i < toks[0].length; i++) {
    if (toks.every(t => t[i] && sinTildes(t[i]) === sinTildes(toks[0][i]))) comun.push(toks[0][i])
    else break
  }
  return comun.join(' ').replace(/\b(de|del|con|sin|en|y)$/i, '').trim()
}

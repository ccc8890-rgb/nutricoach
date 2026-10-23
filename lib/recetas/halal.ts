// Detección de cerdo y alcohol en los ingredientes de una receta (para los filtros «Sin cerdo» y «Halal»).
// Criterio conservador: ante la duda (gelatina, manteca, costilla…) se considera que SÍ lleva.

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

const CERDO = /\b(cerdo|cerda|cochinillo|jamon|jamones|serrano|iberico|bellota|prosciutto|speck|bacon|beicon|panceta|pancetta|guanciale|chorizo|chorizos|salchicha|salchichas|salchichon|fuet|longaniza|sobrasada|morcilla|butifarra|mortadela|chicharron|chicharrones|tocino|lacon|lomo|lomos|costilla|costillas|carrillera|carrilleras|secreto|presa|pluma|gelatina|manteca|pepperoni|salami)\b/
// Lo que NO es cerdo aunque lleve la palabra: otras carnes, pescados o versiones vegetales
const NO_CERDO = /\b(vegetal|vegano|vegana|soja|seitan|tofu)\b|\b(lomo|lomos|costilla|costillas|carrillera|carrilleras|secreto|presa|pluma|jamon|jamones|fiambre|embutido|salchicha|salchichas|chorizo|bacon|beicon|panceta|salami|pepperoni)( cocido| york| serrano| asado| ahumado| picante)? (de|con) (pavo|pollo|ternera|buey|vacuno|cordero|atun|salmon|bacalao|merluza|pescado|gambas|conejo)\b|\b(atun|salmon|bacalao|merluza|pescado|ternera|vaca|pavo|pollo)\b.*\blomos?\b|\blomos? (de |en )?(atun|salmon|bacalao|merluza|pescado|ternera|vaca|pavo|pollo)\b|\b(fiambre|pechuga) de pavo\b|\bsin gelatina\b|\bgelatina vegetal\b|\bagar\b/

const ALCOHOL = /\b(vino|vinos|cerveza|cervezas|ron|whisky|whiskey|vodka|ginebra|gin|tequila|brandy|coñac|cognac|licor|licores|amaretto|vermut|vermouth|sidra|champan|champagne|cava|jerez|oporto|sake|mirin|marsala|kahlua|baileys|aguardiente|cachaca|bourbon|anis seco|orujo|pacharan|grappa|bebida alcoholica)\b/
const NO_ALCOHOL = /\b(sin alcohol|0 0|0 alcohol|vinagre)\b/

type Ingrediente = { nombre_libre?: string | null; alimento?: { nombre?: string | null } | Array<{ nombre?: string | null }> | null }

function textos(nombre: string, ingredientes: Ingrediente[] | null | undefined): string[] {
  const out = [norm(nombre)]
  for (const i of ingredientes ?? []) {
    if (i.nombre_libre) out.push(norm(i.nombre_libre))
    const alimento = Array.isArray(i.alimento) ? i.alimento[0] : i.alimento
    if (alimento?.nombre) out.push(norm(alimento.nombre))
  }
  return out.filter(Boolean)
}

export type RecetaConIngredientes = { nombre: string; receta_ingredientes?: Ingrediente[] | null }

export function contieneCerdo(r: RecetaConIngredientes): boolean {
  return textos(r.nombre, r.receta_ingredientes).some(t => CERDO.test(t) && !NO_CERDO.test(t))
}

export function contieneAlcohol(r: RecetaConIngredientes): boolean {
  return textos(r.nombre, r.receta_ingredientes).some(t => ALCOHOL.test(t) && !NO_ALCOHOL.test(t))
}

/** Halal «por ingredientes»: sin cerdo ni alcohol. No certifica el sacrificio de la carne. */
export function esHalalPorIngredientes(r: RecetaConIngredientes): boolean {
  return !contieneCerdo(r) && !contieneAlcohol(r)
}

/**
 * Restricciones religiosas del cliente («Halal», «Sin cerdo») frente a una receta.
 * Halal manda sobre «Sin cerdo» (incluye también el alcohol). Sin ninguna de las dos → true.
 */
export function cumpleRestriccionesReligiosas(r: RecetaConIngredientes, restricciones: string[] | null | undefined): boolean {
  const set = new Set((restricciones ?? []).map(x => x.toLowerCase().trim()))
  if (set.has('halal')) return esHalalPorIngredientes(r)
  if (set.has('sin cerdo')) return !contieneCerdo(r)
  return true
}

export function pideRestriccionReligiosa(restricciones: string[] | null | undefined): boolean {
  return (restricciones ?? []).some(x => ['halal', 'sin cerdo'].includes(x.toLowerCase().trim()))
}

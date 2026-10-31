// Con qué se endulza una receta, calculado desde los nombres de sus ingredientes. Funciones puras.
// Criterio de Carlos (31-10-2026): refinado = azúcares añadidos de índice glucémico alto (azúcar, panela, sirope de arce,
// mermelada, chocolate con leche/blanco…); natural = miel, dátiles, agave; edulcorante = eritritol, stevia, sucralosa…
// Si hay mezcla gana el peor (refinado > natural > edulcorante). El chocolate negro y el cacao no cuentan.
import { sinTildes } from './busqueda'

export type Endulzante = 'refinado' | 'natural' | 'edulcorante' | 'ninguno'

export const ENDULZANTES: { valor: Endulzante; etiqueta: string }[] = [
  { valor: 'refinado', etiqueta: 'Azúcar refinado' },
  { valor: 'natural', etiqueta: 'Natural (miel, dátiles, agave)' },
  { valor: 'edulcorante', etiqueta: 'Edulcorante (eritritol, stevia…)' },
  { valor: 'ninguno', etiqueta: 'Sin endulzar' },
]

const SIN_AZUCAR = /sin azucar|0 ?% ?azucar|azucares anadidos|sin edulcor/
const EDULCORANTE = /eritritol|stevia|sucralosa|xilitol|edulcorante|monk ?fruit|alulosa/
const REFINADO = /\bazucar\b|panela|melaza|jarabe|mermelada|caramelo|dulce de leche|leche condensada|chocolate (con leche|blanco)|crema de avellana|nutella|cocoa krispies|sirope/
const NATURAL = /\bmiel\b|datil|agave/

export function endulzanteDeNombre(nombre: string): Endulzante {
  const n = sinTildes(nombre)
  if (SIN_AZUCAR.test(n)) return 'ninguno'
  if (EDULCORANTE.test(n)) return 'edulcorante'
  if (/agave/.test(n)) return 'natural'
  if (REFINADO.test(n)) return 'refinado'
  if (NATURAL.test(n)) return 'natural'
  return 'ninguno'
}

export function endulzanteDeReceta(nombresIngredientes: string[]): Endulzante {
  const tipos = new Set(nombresIngredientes.map(endulzanteDeNombre))
  if (tipos.has('refinado')) return 'refinado'
  if (tipos.has('natural')) return 'natural'
  if (tipos.has('edulcorante')) return 'edulcorante'
  return 'ninguno'
}

/**
 * «sin azúcar» en el buscador = sin azúcar refinado; «con azúcar» = con azúcar refinado.
 * Devuelve el texto sin esa frase y los endulzantes que admite (null si no se pidió nada).
 */
export function interpretarBusquedaEndulzante(q: string | null | undefined): { texto: string; admite: Endulzante[] | null } {
  let t = sinTildes(q ?? '')
  let admite: Endulzante[] | null = null
  t = t.replace(/\bsin\s+azucar(es)?(\s+anadid[oa]s?)?\b/g, () => { admite = ['natural', 'edulcorante', 'ninguno']; return ' ' })
  t = t.replace(/\bcon\s+azucar(es)?(\s+anadid[oa]s?)?\b/g, () => { admite = ['refinado']; return ' ' })
  return { texto: admite ? t.replace(/\s+/g, ' ').trim() : (q ?? ''), admite }
}

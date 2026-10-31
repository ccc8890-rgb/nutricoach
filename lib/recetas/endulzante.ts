// Con qué se endulza una receta, calculado desde los nombres de sus ingredientes. Funciones puras.
// Criterio de Carlos (31-10-2026): refinado = azúcares añadidos de índice glucémico alto (azúcar, panela, sirope de arce,
// caramelo…); natural = miel, dátiles, agave; edulcorante = eritritol, stevia, sucralosa…
// Mermelada, chocolate con leche/blanco y crema de avellana se apartan (no cuentan) salvo que lleven mucho azúcar
// (≥ 40 g/100 g según el alimento) o sean tipo Nutella. Si hay mezcla gana el peor (refinado > natural > edulcorante). El chocolate negro y el cacao no cuentan.
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
const REFINADO = /\bazucar\b|panela|melaza|jarabe|caramelo|dulce de leche|leche condensada|nutella|crema de (cacao|chocolate)|cocoa krispies|sirope/
// Dudosos: solo cuentan si el alimento lleva mucho azúcar
const DUDOSO = /mermelada|chocolate (con leche|blanco)|crema de avellana/
export const AZUCAR_ALTO_100G = 40
const NATURAL = /\bmiel\b|datil|agave/

export function endulzanteDeNombre(nombre: string, azucares100g?: number | null): Endulzante {
  const n = sinTildes(nombre)
  if (SIN_AZUCAR.test(n)) return 'ninguno'
  if (EDULCORANTE.test(n)) return 'edulcorante'
  if (/agave/.test(n)) return 'natural'
  if (REFINADO.test(n)) return 'refinado'
  if (DUDOSO.test(n)) return (azucares100g ?? 0) >= AZUCAR_ALTO_100G ? 'refinado' : 'ninguno'
  if (NATURAL.test(n)) return 'natural'
  return 'ninguno'
}

export function endulzanteDeReceta(ingredientes: (string | { nombre: string; azucares?: number | null })[]): Endulzante {
  const tipos = new Set(ingredientes.map(i => typeof i === 'string' ? endulzanteDeNombre(i) : endulzanteDeNombre(i.nombre, i.azucares)))
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

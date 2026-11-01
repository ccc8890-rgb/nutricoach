// ¿Puede una línea de receta («Nata») enlazarse a este alimento del catálogo («Castañas heladas de nata»)?
// Las recetas necesitan alimentos BÁSICOS (tipo BEDCA: nata, nuez moscada, sal); el catálogo de productos de marca/elaborados es para precios y compra.
// Se apoya en calidadVinculo (exacta/buena pasan) y, cuando es «dudosa», solo deja pasar si lo que el alimento añade es forma, corte, estado o envase
// y el alimento no es un producto elaborado. Cualquier otra palabra extra = otro alimento = no se enlaza.
import { calidadVinculo } from '@/lib/recetas/reconstruccion-segura'

const quitar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'o', 'en', 'al', 'un', 'una', 'para', 'a', 'por'])
const singular = (w: string) => w.replace(/(es|s)$/, '')
const tokens = (s: string) => quitar(s).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP.has(w) && !/^\d+$/.test(w)).map(singular)

// Palabras que el alimento puede añadir sin dejar de ser lo mismo (forma, corte, estado, tamaño, envase, presentación)
const BENIGNAS = new Set([
  'molid', 'polvo', 'entero', 'entera', 'fresc', 'fresca', 'hoja', 'fina', 'fino', 'picad', 'picada', 'magra', 'magro', 'natural', 'pelad', 'pelada', 'tostad', 'tostada', 'desgranado',
  'congelad', 'congelada', 'seco', 'seca', 'grano', 'cocid', 'cocida', 'crud', 'cruda', 'liquida', 'liquido', 'pasteurizada', 'pasteurizado', 'light', 'desnatad', 'desnatada', 'baja', 'bajo',
  'grasa', 'azucar', 'anadido', 'sal', 'sodio', 'extracto', 'esencia', 'aroma', 'whey', 'sabor', 'vainilla', 'chocolate', 'brick', 'lata', 'bote', 'tarro', 'caja', 'paquete', 'bolsa',
  'manojo', 'granel', 'vaso', 'malla', 'bandeja', 'lonchas', 'loncha', 'rodajas', 'rebanada', 'filete', 'pieza', 'cubito', 'cubo', 'copo', 'hojuela', 'semilla', 'fileteada', 'laminada',
  'integral', 'blanco', 'blanca', 'negro', 'negra', 'rojo', 'roja', 'verde', 'amarillo', 'dulce', 'virgen', 'extra', 'medjool', 'ecologico', 'bio', 'cascara', 'hueso', 'piel', 'marina', 'gruesa',
  'fino', 'redondo', 'largo', 'asado', 'alimentario', 'exprimido', 'jugo', 'zumo', 'oliva', 'precocido', 'puro', 'polvo', 'materia', 'mezcla', 'variada', 'cherry', 'pera', 'kumato', 'taza', 'molida', 'congelado', 'pelado', 'cocido', 'asada', 'fundir', 'pepita', 'postre', 'pecana', 'pasta', 'tipo', 'queso', 'yogur', 'mantequilla',
])
// Marcas de producto elaborado, plato preparado o formato comercial: nunca para una línea de receta salvo que la propia línea lo diga
const ELABORADO = /\b(con|rellen\w*|sobres?|3 en 1|tarrit\w*|cachit\w*|gourmet|listos?|ultracongelad\w*|crepes?|helad\w*|bebida|cuadradit\w*|lingote|macerad\w*|paqueta|pastillas?|salteado|guisad\w*|campero|docena|d\.?o\.?p\.?)\b/
const MARCA_PROPIA = /\b(hacendado|carrefour|eroski|alcampo|lidl|dia|mercadona|bonpreu|esclat|maredeus|rodolfo|lodosa|ecobasics|we|graza|cero mas)\b/

// Una línea que es un COMPONENTE de la receta (otra preparación), no un ingrediente: «Crema diplomática de mantequilla dorada y arce», «Ganache de crema agria».
// No debe enlazarse a un alimento ni crearse uno con ese nombre (macros inventados): es una elaboración aparte o hay que desglosarla en sus ingredientes.
// Espejo en Python: Content-Radar/scripts/bridge_nutricoach.py (es_sub_receta); al cambiar una, cambiar la otra y sus tests.
const COMPONENTE = /^(crema (diplomatica|pastelera|inglesa|chantilly|de mantequilla)|ganache|caramelo (de|con) \w+|crujiente|praline|glaseado|frosting|cobertura|relleno|streusel|crumble|base de brownie) /
const COMPONENTE_PAN = /^(pan|bizcocho|masa|base|tarta|galleta) de \w+( y \w+| ,)+/
export function esSubReceta(nombre: string): boolean {
  const n = quitar(nombre).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const palabras = n.split(' ').length
  return palabras >= 4 && (COMPONENTE.test(n + ' ') || COMPONENTE_PAN.test(n))
}

export type VinculoReceta = { ok: boolean; motivo?: string }

export function vinculoParaReceta(libre: string, alimento: { nombre: string; categoria?: string | null }): VinculoReceta {
  if (esSubReceta(libre)) return { ok: false, motivo: 'sub-receta (otra preparación, no un ingrediente)' }
  const calidad = calidadVinculo(libre, alimento.nombre)
  if (quitar(libre).trim() === quitar(alimento.nombre).trim()) return { ok: true } // el alimento se llama igual que la línea: lo creó la receta
  const L = new Set(tokens(libre))
  const extra = tokens(alimento.nombre).filter(t => !L.has(t))
  const nl = quitar(libre), na = quitar(alimento.nombre)
  // lo elaborado solo si la línea de receta lo pide también («crepes rellenos de chocolate»)
  const elab = na.match(ELABORADO)?.[0]
  if (elab && !new RegExp(`\\b${elab}`).test(nl)) return { ok: false, motivo: `producto elaborado («${elab}»)` }
  if (MARCA_PROPIA.test(na) && !MARCA_PROPIA.test(nl)) return { ok: false, motivo: 'producto de marca' }
  if (/platos preparados/i.test(alimento.categoria ?? '') && !/preparad|plato|congelad/.test(nl)) return { ok: false, motivo: 'plato preparado' }
  if (calidad === 'exacta' || calidad === 'buena') return { ok: true }
  const raros = extra.filter(t => !BENIGNAS.has(t))
  return raros.length === 0 ? { ok: true } : { ok: false, motivo: `añade «${raros.join(' ')}»` }
}

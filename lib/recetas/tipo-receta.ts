// Tipo de receta (completa / desayuno / snack_postre / guarnicion / bebida / salsa_base).
// Decide qué recetas puede usar el planificador en cada franja (SLOT_TIPOS_PERMITIDOS).
// Regla por PALABRA al inicio del nombre: «Salmón con vinagreta» es un plato,
// «Vinagreta de mostaza» es una salsa. El script antiguo scripts/clasificar-tipo-receta.mjs
// buscaba subcadenas («agua» dentro de «aguacate») y dejó platos completos como bebida o salsa.

import { esCategoriaElaboracion, type CategoriaElaboracion } from '../recetas-constants'

export type TipoRecetaInferido = 'completa' | 'desayuno' | 'snack_postre' | 'guarnicion' | 'bebida' | 'salsa_base'

function palabras(s: string): string[] {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').match(/[a-zñ]+/g) ?? []
}

const SALSA = new Set(['salsa', 'salsas', 'mayonesa', 'mayonesas', 'alioli', 'aliño', 'alino', 'vinagreta', 'chimichurri', 'pesto', 'hummus',
  'guacamole', 'tahini', 'ketchup', 'aderezo', 'dressing', 'poolish', 'mix', 'marinada', 'marinado', 'adobo', 'aceite', 'chili', 'oil'])
const BEBIDA = new Set(['batido', 'batidos', 'smoothie', 'zumo', 'refresco', 'bebida', 'shot', 'tepache', 'migaitoriz', 'isotonica',
  'limonada', 'horchata', 'kombucha', 'infusion'])
// Si el nombre indica que es un plato que lleva la salsa/bebida, no es una salsa/bebida
const PLATO = new Set(['crudites', 'palitos', 'pan', 'pita', 'tosta', 'tostada', 'bowl', 'ensalada', 'pollo', 'salmon', 'verduras', 'tallarines', 'buddha', 'huevo'])

export function inferirTipoReceta(r: { nombre: string; categoria?: string | null; kcal?: number | null; proteinas?: number | null }): TipoRecetaInferido {
  const p = palabras(r.nombre)
  const cabeza = p.slice(0, 2)
  const esPlato = p.some(w => PLATO.has(w))
  const kcal = Number(r.kcal) || 0
  const prot = Number(r.proteinas) || 0

  if (cabeza.some(w => SALSA.has(w)) && !esPlato) return 'salsa_base'
  if (cabeza.some(w => BEBIDA.has(w)) && !p.includes('bowl')) return 'bebida'

  const cat = (r.categoria || '').toLowerCase()
  if (cat === 'desayuno') return 'desayuno'
  if (cat === 'comida' || cat === 'cena') {
    // Ensaladas, cremas y sopas de pocas kcal y poca proteína son acompañamiento, no plato principal
    const acompanamiento = p.some(w => ['ensalada', 'crema', 'sopa', 'pure', 'gazpacho'].includes(w)) && kcal < 350 && prot < 10
    return (kcal < 250 && prot < 10) || acompanamiento ? 'guarnicion' : 'completa'
  }
  // merienda / snack / postre
  return kcal >= 300 && prot >= 15 ? 'completa' : 'snack_postre'
}

// ── Elaboraciones: la categoría es la familia (Elaboración base · Salsa · Condimento) ──
const ELAB_BASE = new Set(['poolish', 'masa', 'fermento', 'levain', 'fondo', 'caldo'])
const ELAB_CONDIMENTO = new Set(['mix', 'adobo', 'adobos', 'marinada', 'marinado', 'especias', 'sazonador', 'rub', 'aceite', 'chili', 'oil'])
const ELAB_SALSA = new Set(['salsa', 'salsas', 'mayonesa', 'mayonesas', 'ajonesa', 'alioli', 'aliño', 'alino', 'vinagreta', 'chimichurri',
  'pesto', 'hummus', 'guacamole', 'tahini', 'ketchup', 'aderezo', 'dressing', 'mostaza'])

// La palabra clave debe estar entre las dos primeras palabras y ninguna palabra de plato puede ir antes:
// «Pollo con salsa barbacoa» es un plato, «Ajonesa de huevo cocido» una salsa («huevo» va después).
export function categoriaElaboracion(nombre: string): CategoriaElaboracion | null {
  const p = palabras(nombre)
  for (let i = 0; i < Math.min(2, p.length); i++) {
    if (PLATO.has(p[i])) return null
    if (ELAB_BASE.has(p[i])) return 'Elaboración base'
    if (ELAB_CONDIMENTO.has(p[i])) return 'Condimento'
    if (ELAB_SALSA.has(p[i])) return 'Salsa'
  }
  return null
}

// Al guardar desde el editor: elegir una categoría de elaboración la convierte en elaboración;
// sacarla de ahí (si era salsa_base) la devuelve a plato; lo demás no se toca.
export function tipoRecetaTrasCambioCategoria(r: { nombre: string; categoria: string | null; kcal?: number | null; proteinas?: number | null; tipoActual: string | null }): { tipo_receta: string | null } {
  if (esCategoriaElaboracion(r.categoria)) return { tipo_receta: 'salsa_base' }
  if (r.tipoActual === 'salsa_base') return { tipo_receta: inferirTipoReceta({ nombre: r.nombre, categoria: r.categoria, kcal: r.kcal, proteinas: r.proteinas }) }
  return { tipo_receta: r.tipoActual }
}

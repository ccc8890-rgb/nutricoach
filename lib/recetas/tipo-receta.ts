// Tipo de receta (completa / desayuno / snack_postre / guarnicion / bebida / salsa_base).
// Decide qué recetas puede usar el planificador en cada franja (SLOT_TIPOS_PERMITIDOS).
// Regla por PALABRA al inicio del nombre: «Salmón con vinagreta» es un plato,
// «Vinagreta de mostaza» es una salsa. El script antiguo scripts/clasificar-tipo-receta.mjs
// buscaba subcadenas («agua» dentro de «aguacate») y dejó platos completos como bebida o salsa.

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

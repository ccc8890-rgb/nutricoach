// Tipo (plato / elaboración) y familia de cocinero de una ficha del recetario. Funciones puras.
// Regla espejo en Content-Radar/scripts/receta_calidad.py: al cambiar una, cambiar la otra y sus tests.
import { FAMILIAS_ELABORACION, FAMILIAS_PLATO } from '../recetas-constants'
import { inferirTipoReceta } from './tipo-receta'

export type TipoContenido = 'plato' | 'elaboracion'
export type TipoVista = 'platos' | 'elaboraciones' | 'todo'
type FamiliaElaboracion = (typeof FAMILIAS_ELABORACION)[number]
type FamiliaPlato = (typeof FAMILIAS_PLATO)[number]

// Sin mayúsculas ni tildes (la ñ pasa a n)
function palabras(s: string): string[] {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '').match(/[a-z]+/g) ?? []
}
const set = (...w: string[]) => new Set(w)

// ── Elaboraciones: la palabra clave debe estar entre las dos primeras palabras y ningún plato puede ir antes ──
const FAMILIAS_CLAVE: [FamiliaElaboracion, Set<string>][] = [
  ['Panes y masas', set('pan', 'brioche', 'focaccia', 'masa', 'poolish', 'levain', 'prefermento')],
  ['Salsas', set('salsa', 'salsas', 'mayonesa', 'mayonesas', 'ajonesa', 'alioli', 'alino', 'vinagreta', 'chimichurri', 'pesto', 'hummus', 'guacamole',
    'tahini', 'ketchup', 'aderezo', 'dressing', 'mostaza', 'sirope', 'hollandaise', 'holandesa', 'bechamel', 'veloute', 'bearnesa')],
  ['Condimentos y mezclas', set('mix', 'adobo', 'adobos', 'marinada', 'marinado', 'especias', 'sazonador', 'rub')],
  ['Fondos y caldos', set('fondo', 'caldo', 'demi', 'glace')],
  ['Grasas aromáticas', set('aceite', 'chili', 'oil')],
  ['Mantequillas compuestas', set('mantequilla')],
  ['Cremas y rellenos', set('ganache', 'caramelo', 'praline', 'confitura')],
  ['Fermentos y curados', set('curado', 'curada', 'curados', 'curadas', 'kimchi', 'encurtido', 'encurtidos', 'fermentado')],
]
// Un plato que aparece primero (o al lado) impide que la palabra clave convierta la ficha en elaboración
const BLOQUEA = set('tostada', 'tostadas', 'tosta', 'tostas', 'bowl', 'ensalada', 'pollo', 'salmon', 'pasta', 'arroz', 'wrap', 'wraps', 'sandwich', 'pizza')

export function familiaElaboracion(nombre: string): FamiliaElaboracion | null {
  const p = palabras(nombre)
  for (let i = 0; i < Math.min(2, p.length); i++) {
    const w = p[i]
    if (BLOQUEA.has(w)) return null
    if (w === 'pan' && p[i + 1] === 'con') return null // «Pan con tomate» es un plato
    for (const [familia, claves] of FAMILIAS_CLAVE) if (claves.has(w)) return familia
  }
  return null
}

// ── Platos: prioridad fija; las etiquetas deciden solo si el nombre no lo hace ──
type EntradaPlato = { nombre: string; categoria?: string | null; tags?: string[] | null; tipo_receta?: string | null }
const POSTRES = set('tarta', 'brownie', 'mousse', 'helado', 'dona', 'donas', 'donut', 'donuts', 'galleta', 'galletas', 'cookie', 'cookies', 'bizcocho', 'pudding', 'natillas', 'flan', 'pastel', 'cheesecake', 'tiramisu', 'coulant')
const SOPAS = set('sopa', 'gazpacho', 'salmorejo')
const BOCADILLOS = set('bowl', 'wrap', 'wraps', 'sandwich', 'burrito', 'tostada', 'tostadas', 'tosta', 'tostas', 'bocadillo', 'burger', 'hamburguesa', 'bao', 'kebab', 'taco', 'tacos', 'fajitas')
const ARROCES = set('arroz', 'risotto', 'paella', 'cuscus', 'bulgur')
const PASTAS = set('pasta', 'noquis', 'noodles', 'tallarines', 'espaguetis', 'macarrones', 'lasana', 'udon', 'fideos')
const HUEVOS = set('huevo', 'huevos', 'tortilla', 'revuelto')
const DESAYUNOS = set('avena', 'gachas', 'porridge', 'overnight', 'yogur', 'tortita', 'tortitas', 'pancake', 'pancakes', 'crepe', 'crepes', 'muffin', 'muffins', 'granola', 'batido', 'smoothie', 'gofre', 'gofres', 'waffle', 'cereales', 'bol')
const PESCADOS = set('pescado', 'salmon', 'atun', 'merluza', 'bacalao', 'gambas', 'dorada', 'lubina', 'sardinas', 'pulpo', 'calamar', 'rape', 'rodaballo', 'lenguado', 'trucha', 'mejillones', 'almejas', 'pescadilla', 'boquerones', 'anchoas', 'langostinos', 'calamares')
const CARNES = set('pollo', 'ternera', 'cerdo', 'carne', 'beef', 'chicken', 'pork', 'cordero', 'filete', 'carrillera', 'carrilleras', 'pavo', 'butifarra', 'costilla', 'costillas', 'chuleta', 'chuletas', 'lomo', 'solomillo', 'entrecot', 'albondigas', 'pechuga', 'muslo', 'muslos', 'conejo', 'pato', 'cochinillo')
const VERDURAS = set('ensalada', 'verdura', 'verduras', 'calabacin', 'berenjena', 'brocoli', 'coliflor', 'calabaza', 'zanahoria', 'espinacas', 'champinones')
const ENTRANTES = set('croqueta', 'croquetas', 'bunuelo', 'bunuelos', 'palitos', 'nachos')
const TAG_A_FAMILIA: Record<string, FamiliaPlato> = {
  pollo: 'Carnes', carne: 'Carnes', pescado: 'Pescados', arroz: 'Arroces y cereales', pasta: 'Pastas', sopa: 'Sopas y cremas', huevo: 'Huevos',
  ensalada: 'Verduras y ensaladas', bowl: 'Bocadillos y bowls', wrap: 'Bocadillos y bowls', sandwich: 'Bocadillos y bowls', tostada: 'Bocadillos y bowls',
}

// Reglas por prioridad sobre un conjunto de palabras (sin tener en cuenta el orden)
function familiaPorPalabras(p: string[], r: EntradaPlato, conVerduras = false): FamiliaPlato | null {
  const tiene = (s: Set<string>) => p.some(w => s.has(w))
  const cat = (r.categoria || '').toLowerCase()
  if (tiene(POSTRES)) return 'Postres'
  if (tiene(SOPAS) || p.some((w, i) => w === 'crema' && p[i + 1] === 'de')) return 'Sopas y cremas'
  if (tiene(BOCADILLOS)) return 'Bocadillos y bowls'
  if (tiene(ARROCES)) return 'Arroces y cereales'
  if (tiene(PASTAS)) return 'Pastas'
  if (tiene(HUEVOS)) return 'Huevos'
  if (tiene(DESAYUNOS)) return 'Desayunos y meriendas'
  if (r.tipo_receta === 'guarnicion' || p[0] === 'pure') return 'Guarniciones'
  if (tiene(PESCADOS)) return 'Pescados'
  if (tiene(CARNES)) return 'Carnes'
  if (cat === 'entrante' || tiene(ENTRANTES)) return 'Entrantes'
  if (conVerduras && tiene(VERDURAS)) return 'Verduras y ensaladas'
  return null
}

/** Manda lo principal del nombre (sus tres primeras palabras): «Costilla con salsa…, puré de maíz» es carne, no guarnición. */
export function familiaPlato(r: EntradaPlato): FamiliaPlato | null {
  const p = palabras(r.nombre)
  if ((r.categoria || '').toLowerCase() === 'postre') return 'Postres'
  // La verdura es la categoría débil: una proteína en cualquier parte del nombre gana a una verdura del principio («Garbanzos con espinacas y bacalao»)
  const f = familiaPorPalabras(p.slice(0, 3), r) ?? familiaPorPalabras(p, r) ?? familiaPorPalabras(p, r, true)
  if (f) return f
  for (const t of r.tags ?? []) { const x = TAG_A_FAMILIA[t.toLowerCase()]; if (x) return x }
  return null
}

export function clasificarFicha(r: EntradaPlato): { tipo_contenido: TipoContenido; familia: string | null } {
  const elab = familiaElaboracion(r.nombre)
  if (elab) return { tipo_contenido: 'elaboracion', familia: elab }
  return { tipo_contenido: 'plato', familia: familiaPlato(r) }
}

/** Campos a guardar cuando el editor cambia el tipo: una elaboración lleva categoría «Elaboración» y la marca interna salsa_base. */
export function camposAlCambiarTipo(r: { nombre: string; tipo: TipoContenido; familia: string | null; categoria: string | null; kcal?: number | null; proteinas?: number | null; tipoRecetaActual: string | null }): { tipo_contenido: TipoContenido; familia: string | null; categoria: string | null; tipo_receta: string | null } {
  if (r.tipo === 'elaboracion') return { tipo_contenido: 'elaboracion', familia: r.familia, categoria: 'Elaboración', tipo_receta: 'salsa_base' }
  const categoria = r.categoria === 'Elaboración' ? null : r.categoria
  // Un plato nunca queda como salsa_base, aunque el nombre lo parezca («Chimichurri»): el planificador no lo usaría
  const inferido = inferirTipoReceta({ nombre: r.nombre, categoria, kcal: r.kcal, proteinas: r.proteinas })
  const tipo_receta = r.tipoRecetaActual === 'salsa_base' ? (inferido === 'salsa_base' ? 'completa' : inferido) : r.tipoRecetaActual
  return { tipo_contenido: 'plato', familia: r.familia, categoria, tipo_receta }
}

// ── Vista del recetario ──
const VISTAS: TipoVista[] = ['platos', 'elaboraciones', 'todo']
/** El tipo elegido en la URL; sin elegir, se busca en todo si hay texto y si no se ven los platos. */
export function tipoEfectivo(tipoUrl: string | null, buscando: boolean): TipoVista {
  if (tipoUrl && (VISTAS as string[]).includes(tipoUrl)) return tipoUrl as TipoVista
  return buscando ? 'todo' : 'platos'
}

export function visibleEnTipo(r: { tipo_contenido?: string | null }, tipo: TipoVista): boolean {
  if (tipo === 'todo') return true
  return tipo === 'elaboraciones' ? r.tipo_contenido === 'elaboracion' : r.tipo_contenido !== 'elaboracion'
}

/** Enlaces antiguos `?cat=Salsa|Condimento|Elaboración base` → tipo y familia nuevos. */
export function migrarCategoriaAntigua(cat: string | null): { tipo: TipoVista; familia: string | null } | null {
  const mapa: Record<string, string> = { Salsa: 'Salsas', Condimento: 'Condimentos y mezclas', 'Elaboración base': 'Panes y masas' }
  return cat && mapa[cat] ? { tipo: 'elaboraciones', familia: mapa[cat] } : null
}

/** Filtros efectivos del recetario a partir de la URL: tipo, momento del día (solo platos) y familia. */
export function filtrosRecetarioDeUrl(p: { tipo: string | null; cat: string | null; fam: string | null; buscando: boolean }): { tipo: TipoVista; categoria: string; familia: string | null } {
  const antigua = !p.tipo ? migrarCategoriaAntigua(p.cat) : null
  if (antigua) return { tipo: antigua.tipo, categoria: 'Todos', familia: p.fam || antigua.familia }
  // Buscar amplía a «todo» solo si no se había elegido nada (ni tipo, ni momento del día, ni familia): así no se pierden filtros
  const sinElegir = (!p.cat || p.cat === 'Todos') && !p.fam
  const tipo = tipoEfectivo(p.tipo, p.buscando && sinElegir)
  return { tipo, categoria: tipo === 'platos' ? (p.cat || 'Todos') : 'Todos', familia: tipo === 'todo' ? null : (p.fam || null) }
}

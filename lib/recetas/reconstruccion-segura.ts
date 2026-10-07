// Puertas de seguridad para reconstruir una receta desde una propuesta sin revisión humana:
// cada vinculación ingrediente→alimento se valida y el resultado debe ser plausible antes de escribir nada.

export type CalidadVinculo = 'exacta' | 'buena' | 'dudosa' | 'sin'
export type AlimentoMacros = { nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra?: number | null }
export type IngredienteResuelto = { nombre: string; gramos: number; alimento: AlimentoMacros | null; calidad: CalidadVinculo }
export type RecetaActual = { porciones: number; kcal: number; tipo_plato: string | null; tipo_receta?: string | null }
export type Evaluacion = {
  ok: boolean
  motivos: string[]
  descartados: string[]
  ingredientesFinales: IngredienteResuelto[]
  porciones_final: number
  ajustes: string[]
  nuevo: { kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number; gramos_racion: number }
}

const quitarAcentos = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'sin', 'y', 'o', 'en', 'al', 'un', 'una', 'para', 'a', 'extra', 'tipo'])
// Envases y variantes que no cambian de qué alimento se trata
const IGNORABLES = new Set(['botella', 'tarro', 'lata', 'caja', 'paquete', 'frasco', 'bandeja', 'bolsa', 'sobre', 'bote', 'doble', 'casero', 'casera', 'pack'])
// Si el ingrediente lleva alguna de estas palabras y el alimento no, siguen siendo lo mismo (forma, variedad o corte)
const FORMAS_SEGURAS = new Set(['fresco', 'fresca', 'picado', 'picada', 'molido', 'molida', 'rallado', 'rallada', 'troceado', 'troceada', 'maduro', 'madura',
  'zumo', 'persa', 'roma', 'cherry', 'baby', 'kosher', 'marina', 'fina', 'gruesa', 'tierno', 'tierna', 'crudo', 'cruda', 'ralladura'])
// Matices que el alimento puede añadir sin dejar de ser lo mismo
const MATICES_OK = new Set(['dulce', 'negra', 'negro', 'blanco', 'blanca', 'rojo', 'roja', 'verde', 'amarillo', 'amarilla', 'virgen', 'vera', 'molida', 'molido', 'picante',
  'ahumado', 'ahumada', 'tostado', 'tostada', 'hueso', 'maxi', 'sal', 'estilo', 'japones', 'natural', 'brote', 'brotes', 'fresco', 'fresca', 'crudo', 'cruda', 'tierno', 'tierna', 'maduro', 'madura'])
// Si el alimento añade alguna de estas palabras es otro producto (sabor, salsa, otra especie, rebozado…)
const OTRO_PRODUCTO = new Set(['salsa', 'fresa', 'chocolate', 'vainilla', 'pesto', 'frito', 'frita', 'empanado', 'empanada', 'rebozado', 'crema', 'helado', 'mermelada',
  'batido', 'bebida', 'galleta', 'barrita', 'snack', 'postre', 'polo', 'coco', 'caramelo', 'cacao', 'canela', 'limon', 'mango', 'platano',
  'sabor', 'aperitivo', 'cabra', 'oveja', 'ensalada', 'tarrito', 'cachitos', 'seco', 'seca', 'entero', 'entera', 'desnatado', 'desnatada', 'vegetal', 'soja'])

const SINONIMOS: [RegExp, string][] = [[/crema agria/g, 'nata agria'], [/\byogurt\b/g, 'yogur'], [/\bcamarones?\b/g, 'gamba']]
const sinonimizar = (s: string) => SINONIMOS.reduce((t, [re, to]) => t.replace(re, to), s)

// Plural/singular tolerante (chipotle/chipotles, zanahoria/zanahorias, pimiento/pimientos, limon/limones)
const variantes = (t: string) => [t, t + 's', t + 'es', t.replace(/es$/, ''), t.replace(/s$/, '')]
const tiene = (set: Set<string>, t: string) => variantes(t).some(v => set.has(v))

function tokensDe(s: string): string[] {
  return quitarAcentos(sinonimizar(quitarAcentos(s))).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOP.has(t) && !/^\d+$/.test(t))
}
/** Separa lo principal de lo que va entre paréntesis (aclaraciones: «Yufka (masa para rollos)», «(5% grasa)») */
function partes(s: string) {
  const paren = [...s.matchAll(/\(([^)]*)\)/g)].map(m => m[1]).join(' ')
  return { principal: tokensDe(s.replace(/\([^)]*\)/g, ' ')), aclaracion: tokensDe(paren) }
}

function calidadUnaAlternativa(libre: string, alimento: string): CalidadVinculo {
  const l = partes(libre), a = partes(alimento)
  const L = new Set(l.principal.filter(t => !IGNORABLES.has(t)))
  const A = new Set(a.principal.filter(t => !IGNORABLES.has(t)))
  const Aamplio = new Set([...A, ...a.aclaracion])           // lo principal + aclaraciones del alimento
  if (L.size === 0 || A.size === 0) return 'dudosa'
  if (![...L].some(t => tiene(A, t))) return 'dudosa'
  const extraA = [...A].filter(t => !tiene(L, t))
  const extraL = [...L].filter(t => !tiene(Aamplio, t))      // las aclaraciones del alimento también "cubren" al ingrediente
  if (extraA.length === 0 && extraL.length === 0) return 'exacta'
  if (extraA.some(t => OTRO_PRODUCTO.has(t))) return 'dudosa'
  // El alimento es más genérico que el ingrediente: vale si lo que falta es solo forma/variedad
  if (extraA.length === 0) return extraL.every(t => tiene(FORMAS_SEGURAS, t)) ? 'buena' : 'dudosa'
  // El alimento añade palabras: solo matices conocidos (dulce, negra, sin hueso…); cualquier otra palabra es otro alimento
  if (extraL.length === 0) return extraA.every(t => tiene(MATICES_OK, t)) ? 'buena' : 'dudosa'
  return 'dudosa'
}

/** Palabras con las que buscar el alimento en el catálogo: las que nombran el producto, sin formas ni envases ("zumo y ralladura de lima" → lima). */
export function raicesBusqueda(nombre: string): string[] {
  const principal = quitarAcentos(nombre).split(/\s+o\s+/)[0]
  const toks = partes(principal).principal.filter(t => t.length >= 3 && !IGNORABLES.has(t) && !tiene(FORMAS_SEGURAS, t))
  const raices = toks.flatMap(t => [...new Set([t, t.replace(/es$/, ''), t.replace(/s$/, '')])].filter(x => x.length >= 3))
  return [...new Set(raices)].slice(0, 6)
}

/**
 * Equivalencias revisadas a mano: ingrediente (normalizado) → nombre EXACTO de un alimento genérico del catálogo.
 * Solo equivalencias nutricionalmente próximas; se aceptan como vínculo "buena". Añadir aquí solo tras comprobar el alimento.
 */
const ALIAS: Record<string, string> = {
  'col verde': 'Repollo',
  'queso cottage bajo en grasa': 'Queso cottage',
  'yogurt griego sin grasa': 'Yogur griego natural (0%)',
  'yogur griego sin grasa': 'Yogur griego natural (0%)',
  'leche vegetal': 'Leche de almendras',
  'tomate enlatado': 'Tomate pelado',
  'queso duro': 'Queso manchego semicurado',
  'carne picada de cordero': 'Cordero',
  'zumaque': 'Pimentón dulce',            // especia en polvo de densidad energética similar (~280 kcal/100 g)
  'pan lavash': 'Pan de pita',
  'cheddar blanco': 'Queso cheddar',
  'queso cheddar rallado bajo en grasa o mezcla mexicana': 'Queso cheddar',
  'pasta de tomate': 'Tomate Doble Concentrado Lata',
  'aceite de aguacate': 'Aceite de Aguacate Cristal',
  'salchicha de pavo para desayuno': 'Salchicha de pavo',
  'huevo frito': 'Huevo',
  'panko': 'Pan Rallado Estilo Japonés Panko',
}
export function aliasAlimento(nombre: string): string | null {
  return ALIAS[quitarAcentos(nombre).replace(/\s+/g, ' ').trim()] ?? null
}

/** El quality gate marca como sospechosa la sal > 10 g por receta: se acota (la sal no cambia los macros). */
export function acotarCantidad(nombre: string, gramos: number): { gramos: number; ajustado: boolean } {
  if (/^sal\b/.test(quitarAcentos(nombre).trim()) && gramos > 10) return { gramos: 10, ajustado: true }
  return { gramos, ajustado: false }
}

/** La ralladura de cítrico no es un ingrediente aparte (el gate la limita a 10 g): "Zumo y ralladura de lima" → "Zumo de lima". */
export function limpiarNombreIngrediente(nombre: string): string {
  return nombre.replace(/\s+y\s+ralladura/i, '').replace(/\s+/g, ' ').trim()
}

const RANGO: Record<CalidadVinculo, number> = { exacta: 3, buena: 2, dudosa: 1, sin: 0 }

/** ¿El alimento vinculado es realmente el ingrediente? exacta/buena se aceptan; dudosa no. Con "A o B" vale la mejor alternativa. */
export function calidadVinculo(libre: string, alimento: string): CalidadVinculo {
  const alternativas = quitarAcentos(libre).split(/\s+o\s+/).filter(Boolean)
  return alternativas.map(a => calidadUnaAlternativa(a, alimento)).sort((x, y) => RANGO[y] - RANGO[x])[0] ?? 'dudosa'
}

const r1 = (v: number) => Math.round(v * 10) / 10

function evaluarConRaciones(p: { ingredientes: IngredienteResuelto[]; porciones_propuesta: number; actual: RecetaActual }): Evaluacion {
  const motivos: string[] = []
  const descartados: string[] = []
  const finales: IngredienteResuelto[] = []
  const completa = (p.actual.tipo_receta ?? 'completa') === 'completa'
  const principal = /comida|cena|almuerzo/i.test(p.actual.tipo_plato ?? '')

  for (const i of p.ingredientes) {
    if (!(i.gramos > 0)) { motivos.push(`Cantidad no válida en «${i.nombre}»`); continue }
    if (i.gramos > 1500) { motivos.push(`Cantidad absurda en «${i.nombre}» (${i.gramos} g)`); continue }
    if (i.calidad === 'exacta' || i.calidad === 'buena') { if (i.alimento) finales.push(i); else motivos.push(`«${i.nombre}» sin alimento`); continue }
    // dudosa o sin alimento: solo se omite si su peso energético es despreciable (≤ 4 % de la receta aunque fuera muy calórico)
    const energiaMax = i.gramos * 3 // 300 kcal/100 g como techo
    const kcalTotal = p.ingredientes.reduce((t, x) => t + (x.alimento ? x.alimento.calorias * x.gramos / 100 : 0), 0)
    if (i.gramos <= 12 && energiaMax <= Math.max(0.04 * kcalTotal, 15)) descartados.push(i.nombre)
    else motivos.push(`Vinculación no fiable de «${i.nombre}» (${i.gramos} g)${i.alimento ? ` con «${i.alimento.nombre}»` : ''}`)
  }

  const por = Math.max(1, p.porciones_propuesta)
  const t = finales.reduce((a, i) => {
    const x = i.gramos / 100, m = i.alimento!
    return { kcal: a.kcal + m.calorias * x, p: a.p + m.proteinas * x, c: a.c + m.carbohidratos * x, g: a.g + m.grasas * x, f: a.f + (m.fibra ?? 0) * x, gr: a.gr + i.gramos }
  }, { kcal: 0, p: 0, c: 0, g: 0, f: 0, gr: 0 })
  const nuevo = { kcal: Math.round(t.kcal / por), proteinas: r1(t.p / por), carbohidratos: r1(t.c / por), grasas: r1(t.g / por), fibra: r1(t.f / por), gramos_racion: Math.round(t.gr / por) }

  if (finales.length < 3) motivos.push('Quedan menos de 3 ingredientes fiables')
  const atwater = t.kcal > 0 ? Math.abs((4 * t.p + 4 * t.c + 9 * t.g) - t.kcal) / t.kcal : 0
  if (atwater > 0.12) motivos.push(`Atwater incoherente (${Math.round(atwater * 100)} % de diferencia): macros de algún alimento mal`)

  const banda: [number, number] = principal && completa ? [150, 1000] : [60, 1100]
  if (nuevo.kcal < banda[0] || nuevo.kcal > banda[1]) {
    const sugeridas = Math.min(12, Math.max(1, Math.round(t.kcal / 600)))
    motivos.push(`${nuevo.kcal} kcal por ración fuera de lo plausible (${banda[0]}-${banda[1]}); con ${sugeridas} ${sugeridas === 1 ? 'ración saldría' : 'raciones saldrían'} ~${Math.round(t.kcal / sugeridas)} kcal`)
  }
  if (principal && completa && (nuevo.gramos_racion < 100 || nuevo.gramos_racion > 900)) motivos.push(`${nuevo.gramos_racion} g por ración no es plausible`)

  // Cambiar mucho las raciones solo es aceptable si la ración sigue pesando lo mismo (tanda mayor del mismo plato)
  const ratio = p.porciones_propuesta / Math.max(1, p.actual.porciones)
  const divergeKcal = p.actual.kcal > 0 ? Math.abs(nuevo.kcal - p.actual.kcal) / p.actual.kcal : 0
  if ((ratio > 2 || ratio < 0.5) && divergeKcal > 0.15) motivos.push(`Cambio de raciones desproporcionado (${p.actual.porciones} → ${p.porciones_propuesta})`)

  // Frente a lo actual: solo se permite un salto grande si lo actual ya era claramente absurdo
  const actualAbsurdo = p.actual.kcal < banda[0] || p.actual.kcal > banda[1]
  if (p.actual.kcal > 0 && !actualAbsurdo && Math.abs(nuevo.kcal - p.actual.kcal) / p.actual.kcal > 0.35) {
    motivos.push(`La propuesta diverge un ${Math.round(Math.abs(nuevo.kcal - p.actual.kcal) / p.actual.kcal * 100)} % de la receta actual (${p.actual.kcal} → ${nuevo.kcal} kcal): revisar`)
  }

  return { ok: motivos.length === 0, motivos, descartados, ingredientesFinales: finales, nuevo, porciones_final: por, ajustes: [] }
}

const SOLO_RACIONES = /kcal por ración|diverge|raciones desproporcionado|g por ración/

/**
 * Evalúa la reconstrucción. Si el único problema es el tamaño de ración, prueba con las raciones que conservarían la ración actual
 * (±15 % de kcal), siempre que no se alejen del doble ni de más de 3 raciones sobre lo propuesto.
 */
export function evaluarReconstruccion(p: { ingredientes: IngredienteResuelto[]; porciones_propuesta: number; actual: RecetaActual }): Evaluacion {
  const base = evaluarConRaciones(p)
  if (base.ok || base.motivos.some(m => !SOLO_RACIONES.test(m)) || p.actual.kcal <= 0) return base
  const kcalTotal = p.ingredientes.filter(i => i.calidad === 'exacta' || i.calidad === 'buena').reduce((t, i) => t + (i.alimento ? i.alimento.calorias * i.gramos / 100 : 0), 0)
  const n = Math.min(12, Math.max(1, Math.round(kcalTotal / p.actual.kcal)))
  const propuesta = Math.max(1, p.porciones_propuesta)
  if (n === propuesta || n > propuesta * 2 || n < propuesta / 2 || Math.abs(n - propuesta) > 3) return base
  const alt = evaluarConRaciones({ ...p, porciones_propuesta: n })
  if (!alt.ok) return base
  return { ...alt, ajustes: [`raciones ${propuesta} → ${n} para conservar el tamaño de ración actual (~${p.actual.kcal} kcal; con ${propuesta} serían ${base.nuevo.kcal})`] }
}

const tokensSinSinonimos = (s: string) => quitarAcentos(s).replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2 && !STOP.has(t))

/** El quality gate exige palabras en común entre el ingrediente y el alimento; si solo son sinónimos, se guarda con ambos nombres. */
export function nombreParaGuardar(libre: string, alimento: string): string {
  const A = new Set(tokensSinSinonimos(alimento))
  return tokensSinSinonimos(libre).some(t => tiene(A, t)) ? libre : `${alimento} (${libre})`
}

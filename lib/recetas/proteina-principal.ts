// Proteína principal de una receta (Pollo, Carne, Pescado…) calculada desde sus ingredientes reales. Funciones puras.
// Alimenta los filtros rápidos del selector de recetas del planificador (`recetas.proteinas_principales`).
import { PROTEINAS_PRINCIPALES, type ProteinaPrincipal } from '../recetas-constants'

export type IngredienteProteina = { nombre: string; gramos: number }

function normalizar(s: string): string {
  return (s || '').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
}

// Palabras clave por grupo (sobre texto sin tildes). Se busca como palabra entera o prefijo de palabra.
const CLAVES: Record<ProteinaPrincipal, string[]> = {
  Pollo: ['pollo', 'pavo', 'pechuga', 'muslo', 'contramuslo', 'gallina', 'pularda', 'codorniz'],
  Carne: ['ternera', 'vaca', 'cerdo', 'lomo', 'cordero', 'carne', 'hamburguesa', 'burger', 'pastrami', 'chorizo', 'solomillo', 'costilla', 'bacon',
    'beicon', 'panceta', 'jamon', 'salchicha', 'pato', 'conejo', 'cochinillo', 'secreto', 'presa', 'entrecot', 'chuleta', 'albondiga', 'kebab'],
  Pescado: ['salmon', 'atun', 'merluza', 'bacalao', 'pescadilla', 'corvina', 'lubina', 'dorada', 'trucha', 'sardina', 'caballa', 'anchoa', 'boqueron',
    'gamba', 'langostino', 'mejillon', 'pulpo', 'calamar', 'sepia', 'almeja', 'bonito', 'rape', 'surimi', 'camaron', 'marisco', 'pescado', 'rodaballo',
    'lenguado', 'emperador', 'pez', 'cigala', 'berberecho', 'vieira', 'gulas', 'zamburina', 'navaja', 'ostra', 'bacaladilla', 'mojama'],
  Huevo: ['huevo', 'huevos', 'clara', 'claras', 'yema', 'yemas'],
  Legumbres: ['lenteja', 'lentejas', 'garbanzo', 'garbanzos', 'alubia', 'alubias', 'judia', 'judias', 'frijol', 'frijoles', 'edamame', 'habas', 'soja'],
  Vegetal: ['tofu', 'tempeh', 'seitan', 'proteina', 'texturizada'],
  Queso: ['queso', 'requeson', 'cottage', 'mozzarella', 'feta', 'parmesano', 'ricotta', 'halloumi', 'burrata', 'mascarpone'],
  Lácteos: [], // solo de respaldo (ver esLacteo): un yogur de aderezo no es la proteína de un plato
}

// Ingredientes que llevan la palabra pero no son la proteína del plato
const NO_CUENTA = /(caldo|salsa|aceite|sabor|aroma|esencia|extracto|pasta de|polvo|vinagre|cubito|concentrado|mantequilla de|crema de cacahuete|bebida|leche|yogur|sopa|chips|galleta|barrita|suero)/
// Excepciones concretas: sí cuentan aunque caigan en lo anterior
const SI_CUENTA = /(proteina vegetal texturizada|soja texturizada|queso)/
// Palabra «pasta»/«fideos» y similares no son proteína; «pez» no debe casar con «pezuña»: se compara por palabras

function palabras(s: string): string[] {
  return normalizar(s).match(/[a-z]+/g) ?? []
}

// Plurales y derivados («gambas», «mejillones», «salmonete»): clave exacta, con plural, o prefijo si la clave es larga
function coincide(palabra: string, clave: string): boolean {
  return palabra === clave || palabra === clave + 's' || palabra === clave + 'es' || (clave.length >= 6 && palabra.startsWith(clave))
}

const LACTEO = /(yogur|yogurt|skyr|kefir|cuajada|petit suisse|leche (entera|desnatada|semidesnatada))/

function grupoDe(nombre: string): ProteinaPrincipal | null {
  const n = normalizar(nombre)
  if (NO_CUENTA.test(n) && !SI_CUENTA.test(n)) return null
  const ps = palabras(n)
  const orden: ProteinaPrincipal[] = ['Vegetal', 'Legumbres', 'Pescado', 'Pollo', 'Carne', 'Huevo', 'Queso']
  for (const g of orden) if (CLAVES[g].some(c => ps.some(p => coincide(p, c)))) return g
  return null
}

function esLacteo(nombre: string): boolean {
  return LACTEO.test(normalizar(nombre))
}

const MIN_GRAMOS = 40 // por debajo es un aderezo o un toque, no la proteína del plato
const RATIO_SEGUNDA = 0.4 // la segunda proteína debe pesar al menos el 40 % de la primera

/** Proteínas principales (1-2) a partir de los ingredientes; si no hay ninguna, mira el nombre de la receta. */
export function proteinasPrincipales(ingredientes: IngredienteProteina[], nombreReceta = ''): ProteinaPrincipal[] {
  const gramos = new Map<ProteinaPrincipal, number>()
  for (const i of ingredientes) {
    const g = grupoDe(i.nombre)
    if (g && i.gramos > 0) gramos.set(g, (gramos.get(g) ?? 0) + i.gramos)
  }
  // Un huevo suelto en una masa (bizcocho) no es la proteína del plato: el huevo solo cuenta si lo demás no la supera
  const ordenados = [...gramos.entries()].filter(([, g]) => g >= MIN_GRAMOS).sort((a, b) => b[1] - a[1])
  if (ordenados.length > 0) {
    const [, max] = ordenados[0]
    return ordenados.filter(([, g], idx) => idx === 0 || g >= max * RATIO_SEGUNDA).slice(0, 2).map(([k]) => k)
  }
  // Desayunos y meriendas: sin otra proteína, el lácteo (yogur, skyr, kéfir) es lo que aporta
  const lacteo = ingredientes.filter(i => i.gramos >= MIN_GRAMOS && esLacteo(i.nombre)).reduce((s, i) => s + i.gramos, 0)
  if (lacteo > 0) return ['Lácteos']
  // Sin ingredientes enlazados o todo en pequeñas cantidades: por el nombre
  const porNombre = grupoDe(nombreReceta)
  return porNombre ? [porNombre] : []
}

export { PROTEINAS_PRINCIPALES }
export type { ProteinaPrincipal }

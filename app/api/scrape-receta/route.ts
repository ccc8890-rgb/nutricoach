import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { completarAlimentoConIA } from '@/lib/deepseek'

const execAsync = promisify(exec)

// ──────────────────────────────────────────────
// Helper: parse ISO 8601 duration → minutes
// ──────────────────────────────────────────────
function parseISODurationToMinutes(duration: string | null | undefined): number | null {
  if (!duration) return null
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  if (!match) return null
  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const seconds = parseInt(match[3] || '0', 10)
  return hours * 60 + minutes + Math.round(seconds / 60)
}

// ──────────────────────────────────────────────
// Helper: map recipeCategory to allowed values
// ──────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
  merienda: 'Merienda',
  snack: 'Snack',
  postre: 'Postre',
}

function mapCategory(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val
  }
  return null
}

// ──────────────────────────────────────────────
// Helper: map cookingMethod to allowed values
// ──────────────────────────────────────────────
const COOKING_METHODS = [
  'No Bake',
  'Sartén/Wok',
  'Horno',
  'Microondas',
  'Freidora de Aire',
  'Vapor',
  'Olla/Cazuela',
  'Plancha',
] as const

function mapCookingMethod(raw: string | null | undefined): string | null {
  if (!raw) return null
  const lower = raw.toLowerCase().trim()
  for (const method of COOKING_METHODS) {
    if (lower.includes(method.toLowerCase())) return method
  }
  return null
}

// ──────────────────────────────────────────────
// Helper: parse ingredient amount to grams
// ──────────────────────────────────────────────
// Palabras clave que indican que un ingrediente se usa en pequeñas cantidades (especias, hierbas, condimentos)
const ESPECIA_KEYWORDS = [
  'sal', 'pimienta', 'orégano', 'oregano', 'romero', 'tomillo', 'laurel',
  'perejil', 'cilantro', 'comino', 'canela', 'pimentón', 'pimenton',
  'nuez moscada', 'jengibre', 'cúrcuma', 'curcuma', 'curry',
  'ajo en polvo', 'cebolla en polvo', 'albahaca', 'eneldo',
  'mostaza', 'vinagre', 'salsa', 'kétchup', 'ketchup', 'tabasco',
  'glutamato', 'levadura', 'bicarbonato', 'impulsor', 'gasificante',
  'clavo', 'anís', 'anis', 'vainilla', 'esencia', 'colorante',
  'edulcorante', 'stevia',
]

// Ingredientes con keywords que también tienen defaults bajos
const ESPECIA_LIKE = (nombre: string): boolean =>
  ESPECIA_KEYWORDS.some(kw => nombre.toLowerCase().includes(kw))

function parseCantidadAGramos(
  nombre: string,
  cantidad: number | null,
  unidad: string | null
): number {
  const u = (unidad ?? '').toLowerCase().trim()

  const unitMap: [string[], number][] = [
    [['g', 'gr', 'gramos'], 1],
    [['kg', 'kilogramos'], 1000],
    [['ml', 'cc'], 1],
    [['l', 'litros'], 1000],
    [['cucharada', 'cucharadas', 'tbsp'], 15],
    [['cucharadita', 'cucharaditas', 'tsp'], 5],
    [['taza', 'tazas', 'cup', 'cups'], 200],
    [['huevo', 'huevos', 'unidad', 'unidades'], 60],
    [['lata', 'latas'], 400],
    [['rebanada', 'rebanadas', 'loncha', 'lonchas'], 30],
  ]

  // ── Buscar unidad conocida ──
  for (const [aliases, multiplier] of unitMap) {
    if (aliases.includes(u)) {
      return (cantidad ?? 1) * multiplier
    }
  }

  // ── Sin cantidad → default inteligente ──
  if (cantidad === null || cantidad === undefined) {
    // Especias / condimentos → 5g (una cucharadita o pizca)
    if (ESPECIA_LIKE(nombre)) return 5
    // Líquidos (aceite, vinagre, salsa, sirope, nata, vino, cerveza, leche) → 15g (una cucharada)
    if (/aceite|vinagre|salsa|sirope|nata|vino|cerveza|leche[^g]|caldo|fondo/i.test(nombre)) return 15
    // Carnes / pescados / huevos → 150g (ración individual estándar)
    if (/pollo|ternera|cerdo|pescado|salmón|salmon|merluza|atún|tuna|trucha|dorada|lubina/i.test(nombre)) return 150
    if (/huevo|huevos/i.test(nombre)) return 150
    // Cereales / legumbres crudos → 80g (ración individual)
    if (/arroz|pasta|quinoa|cuscús|cuscus|lenteja|garbanzo|alubia|judía|judias|avena|pan|copos/i.test(nombre)) return 80
    // Frutas / verduras enteras → 100g (media pieza pequeña)
    if (/manzana|pera|plátano|platano|naranja|kiwi|higo|higos|ciruela/i.test(nombre)) return 100
    // Frutos secos / semillas → 30g (puñado estándar)
    if (/almendra|nuez|nueces|anacardo|cacahuete|pipas|semilla|pistacho|avellana/i.test(nombre)) return 30
    // Condimentos / salsas espesas → 20g
    if (/mostaza|kétchup|ketchup|mayonesa|miel|sirope/i.test(nombre)) return 20
    // Por defecto → 100g
    return 100
  }

  // ── Sin unidad conocida, asumir gramos ──
  return cantidad
}

// ──────────────────────────────────────────────
// Helper: extract number from recipeYield
// ──────────────────────────────────────────────
function extractYieldNumber(yieldStr: string | null | undefined): number | null {
  if (!yieldStr) return null
  const match = yieldStr.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : null
}

// ──────────────────────────────────────────────
// Helper: infer "1 galleta" from "12 galletas"
// ──────────────────────────────────────────────
function inferDescripcionPorcion(yieldStr: string | null | undefined): string | null {
  if (!yieldStr) return null
  const str = yieldStr.trim()
  // Needs a number + text: "12 galletas", "8 tortitas"
  const match = str.match(/^\d+\s+(.+)$/)
  if (!match) return null
  const unit = match[1].trim()
  // Skip generic words that don't describe the food
  const GENERIC = ['porciones', 'raciones', 'servings', 'serving', 'portions', 'portion', 'personas', 'unidades']
  if (GENERIC.some(g => unit.toLowerCase().startsWith(g))) return null
  // Naive singularization: -as → -a (galletas→galleta), -os → -o (bocados→bocado)
  let singular = unit
  if (unit.endsWith('as') && unit.length > 3) singular = unit.slice(0, -1)
  else if (unit.endsWith('os') && unit.length > 3) singular = unit.slice(0, -1)
  return `1 ${singular}`
}

// ──────────────────────────────────────────────
// Helper: extract image URL from JSON-LD image field
// ──────────────────────────────────────────────
function extractImageUrl(image: unknown): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image) && image.length > 0) {
    const first = image[0]
    if (typeof first === 'string') return first
    if (typeof first === 'object' && first !== null && 'url' in first) {
      return (first as { url: string }).url
    }
  }
  if (typeof image === 'object' && image !== null && 'url' in image) {
    return (image as { url: string }).url
  }
  return null
}

// ──────────────────────────────────────────────
// Helper: strip HTML to plain text for AI extraction
// ──────────────────────────────────────────────
function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ──────────────────────────────────────────────
// Helper: parse raw ingredient string from JSON-LD
// ──────────────────────────────────────────────
const UNIDADES_CONOCIDAS = new Set([
  'g', 'gr', 'gramos', 'kg', 'ml', 'l', 'litros',
  'cucharada', 'cucharadas', 'cucharadita', 'cucharaditas',
  'taza', 'tazas', 'lata', 'latas', 'puñado',
  'diente', 'dientes', 'hoja', 'hojas', 'rama', 'ramas',
  'rodaja', 'rodajas', 'loncha', 'lonchas', 'rebanada', 'rebanadas',
  'unidad', 'unidades', 'sobre', 'sobres', 'brick',
])

function parseIngredienteRaw(raw: string): { nombre: string; cantidad: number | null; unidad: string | null } {
  const str = raw.trim()
  // Match: optional number, optional unit, optional "de/para/con", rest
  const match = str.match(/^([\d.,]+(?:\/[\d]+)?|½|¼|¾)?\s*([a-záéíóúüñA-ZÁÉÍÓÚÜÑ]{1,20})?\s*(?:de\s+|para\s+|con\s+)?(.+)$/i)
  if (!match) return { nombre: str, cantidad: null, unidad: null }

  const [, cantStr, maybeUnit, rest] = match

  let cantidad: number | null = null
  if (cantStr) {
    if (cantStr === '½') cantidad = 0.5
    else if (cantStr === '¼') cantidad = 0.25
    else if (cantStr === '¾') cantidad = 0.75
    else if (cantStr.includes('/')) {
      const [n, d] = cantStr.split('/')
      cantidad = parseFloat(n) / parseFloat(d)
    } else {
      cantidad = parseFloat(cantStr.replace(',', '.'))
    }
    if (isNaN(cantidad as number)) cantidad = null
  }

  const unitLower = maybeUnit?.toLowerCase() ?? ''
  const esUnidad = UNIDADES_CONOCIDAS.has(unitLower)

  let nombre: string
  let unidad: string | null

  if (esUnidad) {
    unidad = maybeUnit!
    nombre = (rest ?? '').trim()
  } else {
    unidad = null
    nombre = ((maybeUnit ?? '') + ' ' + (rest ?? '')).trim()
  }

  // Remove trailing descriptors
  nombre = nombre
    .replace(/\s+(grande|pequeño|pequeña|maduro|madura|fresco|fresca|crudo|cruda|picado|picada|cortado|cortada|troceado|troceada|al gusto|limpio|limpia)\b.*/i, '')
    .trim()

  return { nombre: nombre || str, cantidad, unidad }
}

// ──────────────────────────────────────────────
// Helper: call Gemini Flash API
// ──────────────────────────────────────────────
async function callGeminiExtraction(html: string): Promise<any> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const texto = extractTextFromHtml(html).substring(0, 15000)
  const prompt = `Extrae la receta de este texto web y devuelve SOLO un JSON con esta estructura exacta. IMPORTANTE: Traduce TODO a español aunque el texto esté en otro idioma.
{
  nombre: string,
  descripcion: string | null,
  categoria: 'Desayuno'|'Comida'|'Cena'|'Merienda'|'Snack'|'Postre' | null,
  tipo_coccion: 'No Bake'|'Sartén/Wok'|'Horno'|'Microondas'|'Freidora de Aire'|'Vapor'|'Olla/Cazuela'|'Plancha' | null,
  dificultad: 'Fácil'|'Medio'|'Difícil' | null,
  porciones: number | null,
  descripcion_porcion: string | null,
  tiempo_prep_min: number | null,
  tiempo_coccion_min: number | null,
  ingredientes: Array<{ nombre: string (el nombre CANÓNICO del alimento en español, SOLO el ingrediente base sin cantidades ni descriptores. Ej: "Aguacate" no "1 aguacate maduro"; "Harina de avena" no "1 taza de harina de avena"; "Pechuga de pollo" no "500g de pechugas de pollo"; "Arroz" no "arroz blanco cocido". Usa la primera letra mayúscula.), cantidad: number | null, unidad: string | null }>,
  instrucciones: string | null (EN ESPAÑOL, SOLO los pasos de preparación de la receta, cada paso en una línea separada empezando por "1. ", "2. ", etc. NO incluyas ningún otro texto de la página. Ej: "1. Mezcla la harina con los huevos.\n2. Añade la leche y remueve.\n3. Hornea 20 minutos."),
  consejos: string | null,
  imagen_url: string | null,
  autor_original: string | null
}
El campo descripcion_porcion describe qué es físicamente 1 porción. Ejemplos: "1 galleta", "2 tacos", "1 rebanada", "1 bol", "1 donut", "1 porción de tarta". Infierelo del nombre de la receta, el yield y las instrucciones. Si no está claro, pon null.
TEXTO WEB: ${texto}`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  // Remove markdown code fences if present
  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  return JSON.parse(cleaned)
}

async function callDeepSeekExtraction(html: string): Promise<any> {
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not configured')

  const texto = extractTextFromHtml(html).substring(0, 15000)
  const prompt = `Extrae la receta de este texto web y devuelve SOLO un JSON con esta estructura exacta. IMPORTANTE: Traduce TODO a español aunque el texto esté en otro idioma.
{
  nombre: string,
  descripcion: string | null,
  categoria: 'Desayuno'|'Comida'|'Cena'|'Merienda'|'Snack'|'Postre' | null,
  tipo_coccion: 'No Bake'|'Sartén/Wok'|'Horno'|'Microondas'|'Freidora de Aire'|'Vapor'|'Olla/Cazuela'|'Plancha' | null,
  dificultad: 'Fácil'|'Medio'|'Difícil' | null,
  porciones: number | null,
  descripcion_porcion: string | null,
  tiempo_prep_min: number | null,
  tiempo_coccion_min: number | null,
  ingredientes: Array<{ nombre: string (el nombre CANÓNICO del alimento en español, SOLO el ingrediente base sin cantidades ni descriptores. Ej: "Aguacate" no "1 aguacate maduro"; "Harina de avena" no "1 taza de harina de avena"; "Pechuga de pollo" no "500g de pechugas de pollo"; "Arroz" no "arroz blanco cocido". Usa la primera letra mayúscula.), cantidad: number | null, unidad: string | null }>,
  instrucciones: string | null (EN ESPAÑOL, SOLO los pasos de preparación de la receta, cada paso en una línea separada empezando por "1. ", "2. ", etc. NO incluyas ningún otro texto de la página. Ej: "1. Mezcla la harina con los huevos.\n2. Añade la leche y remueve.\n3. Hornea 20 minutos."),
  consejos: string | null,
  imagen_url: string | null,
  autor_original: string | null
}
El campo descripcion_porcion describe qué es físicamente 1 porción. Ejemplos: "1 galleta", "2 tacos", "1 rebanada", "1 bol", "1 donut", "1 porción de tarta". Infierelo del nombre de la receta, el yield y las instrucciones. Si no está claro, pon null.
TEXTO WEB: ${texto}`

  const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`DeepSeek API error: ${response.status} ${errText}`)
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('DeepSeek returned empty response')

  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return JSON.parse(cleaned.trim())
}

async function buscarFotoUnsplash(nombre: string): Promise<string | null> {
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY
  if (!UNSPLASH_KEY) return null
  try {
    const query = encodeURIComponent(nombre + ' food recipe')
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${query}&orientation=landscape&content_filter=high&per_page=1&client_id=${UNSPLASH_KEY}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.results?.[0]?.urls?.regular ?? null
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────
// Helper: singularizar palabra
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Configuración del algoritmo de matching
// ──────────────────────────────────────────────

const CONNECTORS = new Set([
  'de', 'la', 'las', 'los', 'el', 'lo', 'un', 'una', 'del', 'al',
  'con', 'y', 'e', 'a', 'para', 'por', 'en'
])

const PREP_WORDS = new Set([
  'cruda', 'crudo', 'cocida', 'cocido', 'cocidas', 'cocidos',
  'congelada', 'congelado', 'congeladas', 'congelados',
  'natural', 'naturales', 'light',
  'fresco', 'fresca', 'frescos',
  'entero', 'entera', 'enteras', 'enteros',
  'desnatada', 'desnatado', 'semidesnatada',
  'molida', 'molido', 'rallada', 'rallado',
  'tostada', 'tostado', 'tostadas', 'picada', 'picado',
  'asada', 'asado', 'frita', 'frito',
  'ahumado', 'ahumada', 'seca', 'seco',
  'polvo', 'lata', 'brick',
  'sal', 'sin',
  'batido', 'batida',
])

const RESTRICTIVE_WORDS = new Set([
  'sin', 'light', 'desnatada', 'desnatado', 'semidesnatada',
  'cocida', 'cocido', 'cocidas', 'cocidos',
  'ahumado', 'ahumada', 'tostada', 'tostado', 'tostadas',
])

// Palabras de marca/producto — penalizan fuerte en el scoring
const BRAND_WORDS = new Set([
  'hacendado', 'nestle', 'nestlé', 'valor', 'mercadona', 'dia', 'carrefour',
  'coca', 'cola', 'monster', 'bebida', 'refresco', 'cerveza', 'vino',
  'spaghetti', 'papilla', 'rosquillas', 'molinillo', 'sirope',
  'barrita', 'barritas', 'snack', 'snacks', 'deluxe',
  'cereal', 'cereales', 'chocolate',
])

// Palabras de productos NO comestibles para humanos — descarte inmediato
const NON_FOOD_WORDS = new Set([
  // Limpieza hogar
  'limpieza', 'bayeta', 'fregona', 'escoba', 'mopa', 'rasqueta',
  'desatascador', 'desinfectante', 'lejía', 'lejia', 'cloro',
  'lavaparabrisas', 'bolsas', 'multiusos', 'estropajo', 'suavizante',
  'detergente', 'lavavajillas', 'limpia', 'fregasuelos', 'ambientador',
  'alcohol',
  // Higiene personal
  'champú', 'champu', 'acondicionador', 'gel', 'desodorante',
  'antitranspirante', 'jabón', 'pasta de dientes', 'dentífrico',
  'maquillaje', 'corrector', 'deliplus', 'rimmel', 'laca',
  'crema corporal', 'loción', 'aceite corporal', 'manteca corporal',
  'tónico facial', 'sérum', 'serum', 'mascarilla facial',
  'tampones', 'compresas', 'preservativo', 'biberón', 'chupete',
  'cepillo', 'afeitar', 'espuma',
  // Mascotas
  'gato adulto', 'caninos', 'perro', 'mascotas', 'animales', 'pienso',
  // Medicamentos / suplementos no alimentarios
  'laxante', 'cápsulas', 'comprimidos', 'minoxidil',
  'kit', 'analizador',
  // Categorías no comestibles
  'cuidado personal', 'higiene personal', 'hogar', 'limpieza del hogar',
])

const DISH_WORDS = new Set([
  'bowl', 'mousse', 'tortilla', 'muffin', 'brownie', 'burger',
  'galleta', 'galletas', 'tarta', 'bizcocho', 'donut', 'gofre',
  'barrita', 'barritas', 'helado', 'sandwich', 'wrap', 'taco', 'tacos',
  'ensalada', 'sopa', 'guiso', 'salteado', 'revuelto', 'pudding',
  'skillet', 'bites', 'barras', 'tostadas', 'lazanya', 'brochetas',
  'caracolas', 'fideosudon', 'kebaprol', 'kebab', 'patatas',
  'hamburguesa', 'hamburguesas', 'smashed', 'rice', 'crispy',
  'caramelized', 'no bake', 'cookies', 'cookie', 'blondis',
  'snickers', 'snack', 'chips', 'salsa',
  'pan', 'bacon', 'manzanas',
])

const ACENTOS: Record<string, string> = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú' }

// ──────────────────────────────────────────────
// Helper functions
// ──────────────────────────────────────────────

function singularizar(palabra: string): string {
  const p2 = palabra.toLowerCase().trim()
  if (p2.endsWith('ces') && p2.length > 4) return p2.slice(0, -3) + 'z'
  if (p2.endsWith('s') && p2.length > 3) return p2.slice(0, -1)
  return p2
}

function norm(p: string): string {
  return p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function generarVariantesAcento(token: string): string[] {
  const opciones = [token]
  for (let i = 0; i < token.length; i++) {
    if (ACENTOS[token[i]]) {
      const acc = ACENTOS[token[i]]
      opciones.push(token.slice(0, i) + acc + token.slice(i + 1))
    }
  }
  return [...new Set(opciones)]
}

function esSustantiva(palabra: string): boolean {
  if (CONNECTORS.has(palabra)) return false
  if (PREP_WORDS.has(palabra)) return false
  if (DISH_WORDS.has(palabra)) return false
  if (palabra.length <= 2) return false
  return true
}

function sonVariantes(a: string, b: string): boolean {
  if (a === b) return true
  return singularizar(a) === singularizar(b)
}

function palabraEnConsulta(palabraCandidato: string, palabrasConsulta: string[]): boolean {
  for (const pc of palabrasConsulta) {
    if (sonVariantes(palabraCandidato, pc)) return true
  }
  return false
}

async function buscarAlimento(supabaseService: any, token: string): Promise<any[]> {
  const { data: direct } = await supabaseService
    .from('alimentos')
    .select('id, nombre, calorias')
    .ilike('nombre', '%' + token + '%')
  if (direct && direct.length > 0) return direct

  const variantes = generarVariantesAcento(token).filter(v => v !== token)
  if (variantes.length === 0) return []

  const conditions = variantes.map(v => `nombre.ilike.%${v}%`)
  const { data: conAcentos } = await supabaseService
    .from('alimentos')
    .select('id, nombre, calorias')
    .or(conditions.join(','))

  return conAcentos || []
}

// ──────────────────────────────────────────────
// Sistema de puntuación (0-100, normalizado por acentos)
// Basado en el algoritmo de rematch-ingredientes.mjs
// ──────────────────────────────────────────────

function limpiarNombreIngrediente(nombre: string): string {
  return nombre
    .replace(/\(.*?\)/g, '')   // eliminar (notas)
    .replace(/\s+/g, ' ')      // colapsar espacios
    .trim()
}

function palabrasCompletas(str: string): string[] {
  return norm(str.toLowerCase())
    .split(/[\s,()\/\-]+/)
    .filter(p => p.length >= 2)
}

function puntuarCandidato(
  candidato: string,
  _tokensBuscar: string[],
  consultaOriginal: string
): { total: number; palabrasRestrictivas: number; tokensMatchCount: number } {
  const aNorm = norm(candidato)
  const queryNorm = norm(consultaOriginal)

  // Detectar si el candidato contiene palabras NO comestibles → descarte inmediato
  const palabrasCandidato = aNorm.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
  for (const pc of palabrasCandidato) {
    if (NON_FOOD_WORDS.has(pc)) {
      return { total: -999, palabrasRestrictivas: 0, tokensMatchCount: 0 }
    }
  }

  const palabrasIng = palabrasCompletas(consultaOriginal)
  const palabrasFood = palabrasCompletas(candidato)

  if (palabrasIng.length === 0) return { total: 0, palabrasRestrictivas: 0, tokensMatchCount: 0 }

  const ingSet = new Set(palabrasIng)
  const foodSet = new Set(palabrasFood)

  // Palabras exclusivas de cada lado (usando variantes)
  const soloIng = palabrasIng.filter(p => {
    for (const fp of palabrasFood) if (sonVariantes(p, fp)) return false
    return true
  })
  const soloFood = palabrasFood.filter(p => {
    for (const ip of palabrasIng) if (sonVariantes(ip, p)) return false
    return true
  })

  const forwardOk = soloIng.length === 0
  const reverseOk = soloFood.length === 0

  // Si ni forward ni reverse → no hay match
  if (!forwardOk && !reverseOk) return { total: 0, palabrasRestrictivas: 0, tokensMatchCount: 0 }

  // Clasificar tipo de match
  const esBidireccional = forwardOk && reverseOk
  const esReverseOnly = reverseOk && !forwardOk
  const esForwardOnly = forwardOk && !reverseOk

  let score = 0

  if (esBidireccional) {
    if (soloIng.length === 0 && soloFood.length === 0) score = 100 // exacto
    else score = 95 // mismo conjunto de palabras
  } else if (esReverseOnly) {
    // food ⊂ ingredient — seguro
    score = 85
  } else if (esForwardOnly) {
    // ingredient ⊂ food — riesgoso (food tiene palabras extra)
    if (palabrasIng.length === 1 && soloFood.length >= 2) {
      // Una palabra del ing coincide con food que tiene 2+ extras
      const numMarca = soloFood.filter(p => BRAND_WORDS.has(p)).length
      const numDesc = soloFood.filter(p => PREP_WORDS.has(p)).length
      if (numMarca > 0) score = 40
      else if (numDesc >= soloFood.length) score = 80
      else score = 60
    } else {
      const numMarca = soloFood.filter(p => BRAND_WORDS.has(p) || DISH_WORDS.has(p)).length
      if (numMarca > 0) score = Math.max(30, 70 - numMarca * 15)
      else score = Math.max(50, 80 - soloFood.length * 5)
    }
  }

  // Penalizaciones generales
  const marcaEnFood = palabrasFood.filter(p => BRAND_WORDS.has(p)).length
  score -= marcaEnFood * 20

  const dishEnFood = palabrasFood.filter(p => DISH_WORDS.has(p)).length
  score -= dishEnFood * 10

  // Bonus por nombre corto (más genérico = mejor)
  if (palabrasFood.length <= 2) score += 5
  if (palabrasFood.length === 1) score += 5

  // Contar tokens match para el sort
  let tokensMatchCount = 0
  for (const ip of palabrasIng) {
    for (const fp of palabrasFood) {
      if (sonVariantes(ip, fp)) { tokensMatchCount++; break }
    }
  }

  const finalScore = Math.max(0, Math.min(100, score))
  return { total: finalScore, palabrasRestrictivas: 0, tokensMatchCount }
}

// ──────────────────────────────────────────────
// Helper: match ingredient name to alimentos table
// ──────────────────────────────────────────────
async function matchIngredient(
  supabaseService: any,
  nombre: string
): Promise<{ id: string; nombre: string } | null> {
  // Limpiar el nombre: quitar paréntesis descriptivos
  const nombreLimpio = limpiarNombreIngrediente(nombre)
  const q = nombreLimpio.toLowerCase().trim()

  if (!q) return null

  // ── 1. MATCH EXACTO ──
  const { data: exact } = await supabaseService
    .from('alimentos')
    .select('id, nombre')
    .ilike('nombre', q)
  if (exact?.length) return exact[0]

  // ── 1b. MATCH EXACTO CON SINGULAR ──
  const singular = singularizar(q)
  if (singular !== q) {
    const { data: exSing } = await supabaseService
      .from('alimentos')
      .select('id, nombre')
      .ilike('nombre', singular)
    if (exSing?.length) return exSing[0]
  }

  // ── 1c. PREFERIR STARTS-WITH ──
  // "Harina" → "Harina de trigo" (starts-with) mejor que "Harina de coco" (contains)
  // Si solo hay un starts-with con macros, devolverlo directamente
  // Si hay múltiples, preferir el que tenga calorias > 0
  const { data: startsWith } = await supabaseService
    .from('alimentos')
    .select('id, nombre, calorias')
    .ilike('nombre', q + '%')
  if (startsWith?.length === 1) return startsWith[0]
  if (startsWith && startsWith.length > 1) {
    // Preferir el que tenga macros (calorias > 0)
    const conMacros = startsWith.filter((a: any) => (a.calorias ?? 0) > 0)
    if (conMacros.length === 1) return conMacros[0]
    if (conMacros.length > 1) {
      // Entre varios con macros, el de nombre más corto (más genérico)
      conMacros.sort((a: any, b: any) => a.nombre.length - b.nombre.length)
      return conMacros[0]
    }
    // Si todos tienen kcal=0, el primero alfabético
    startsWith.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre))
    return startsWith[0]
  }

  // ── 2. MULTI-TOKEN SCORING ──
  const tokens = q.split(/\s+/).filter((w: string) => w.length > 2)
  const tokensExtra = new Set<string>(tokens)
  if (singular !== q) tokensExtra.add(singular)
  for (const t of tokens) {
    const s = singularizar(t)
    if (s !== t) tokensExtra.add(s)
  }
  const tokensBuscar = Array.from(tokensExtra)

  const candidatosMap = new Map<string, { id: string; nombre: string }>()
  for (const token of tokensBuscar) {
    const results = await buscarAlimento(supabaseService, token)
    if (results) {
      for (const item of results) {
        if (!candidatosMap.has(item.id)) candidatosMap.set(item.id, item)
      }
    }
  }

  if (candidatosMap.size > 0) {
    const scored = Array.from(candidatosMap.values())
      .map(a => {
        const { total, palabrasRestrictivas, tokensMatchCount } = puntuarCandidato(a.nombre, tokensBuscar, q)
        return { ...a, total, palabrasRestrictivas, tokensMatchCount }
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total
        if (a.palabrasRestrictivas !== b.palabrasRestrictivas) {
          return a.palabrasRestrictivas - b.palabrasRestrictivas
        }
        return a.nombre.length - b.nombre.length
      })

    const mejor = scored[0]

    function contarExtraSustantivas(nombreCandidato: string): number {
      const aNorm2 = norm(nombreCandidato)
      const palabrasConsulta = q.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
      const palabrasCandidato = aNorm2.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
      let extras = 0
      for (const pc of palabrasCandidato) {
        if (pc.length <= 2) continue
        if (palabraEnConsulta(pc, palabrasConsulta)) continue
        if (DISH_WORDS.has(pc) || esSustantiva(pc)) extras++
      }
      return extras
    }

    const aMejorNorm = norm(mejor.nombre)
    const qNorm = norm(q)
    const tokensNorm = tokensBuscar.map(t => norm(t))
    const tokensMatchCount = tokensNorm.filter(t => aMejorNorm.includes(t)).length
    const extra = contarExtraSustantivas(mejor.nombre)

    const palabrasSustantivasConsulta = q.split(/\s+/)
      .filter(p => p.length > 0 && !CONNECTORS.has(p) && !PREP_WORDS.has(p))
    const toleranciaExtra = palabrasSustantivasConsulta.length <= 1 ? 0 : 1

    // Penalización: palabras extra sustantivas en el candidato que no están en la consulta
    // y el candidato NO empieza por la consulta (ej: "Harina de coco" para buscar "Harina")
    const esStartsWith = aMejorNorm.startsWith(qNorm)
    const tienePalabrasExtra = extra > toleranciaExtra && !esStartsWith

    if (!tienePalabrasExtra && mejor.total > 0 && extra <= toleranciaExtra) {
      return mejor
    }

    if (!tienePalabrasExtra && extra === 0 && tokensMatchCount >= 1) {
      return mejor
    }

    // Fallback: si el primero fue penalizado pero hay otro mejor, probarlo
    if (tienePalabrasExtra && scored.length > 1) {
      const segundo = scored[1]
      const segundoNorm = norm(segundo.nombre)
      const extraSegundo = contarExtraSustantivas(segundo.nombre)
      const segundoEsStartsWith = segundoNorm.startsWith(qNorm)
      if ((segundoEsStartsWith || extraSegundo <= toleranciaExtra) && segundo.total > 0) {
        return segundo
      }
    }
  }

  return null
}

// ──────────────────────────────────────────────
// Auto-crear alimento base si no existe en BD
// ──────────────────────────────────────────────
async function autoCrearAlimento(
  supabaseService: any,
  nombre: string
): Promise<{ id: string; nombre: string } | null> {
  const q = nombre.toLowerCase().trim()
  if (q.length < 3) return null

  const tokens = q.split(/\s+/).filter((t: string) => t.length > 0)
  const sustantivos = tokens.filter((t: string) => esSustantiva(t))

  // No auto-crear si no hay palabras sustantivas o si es un plato/receta
  if (sustantivos.length === 0) return null

  // No auto-crear si parece un nombre de plato (contiene dish words que no son alimentos)
  const tieneDishWord = tokens.some((t: string) => DISH_WORDS.has(t))
  if (tieneDishWord && !['pasta', 'crema', 'mantequilla', 'salsa'].includes(tokens[0])) return null

  // Capitalizar correctamente
  const nombreFormateado = tokens
    .map((t: string) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ')

  // Insertar con macros a 0 provisionalmente + flag fuente='ia' para revisión
  const { data: nuevo, error } = await supabaseService
    .from('alimentos')
    .insert({
      nombre: nombreFormateado,
      calorias: 0,
      proteinas: 0,
      carbohidratos: 0,
      grasas: 0,
      fibra: 0,
      fuente: 'ia',
    })
    .select('id, nombre')
    .single()

  if (error || !nuevo) {
    console.error('Error auto-creando alimento:', error?.message)
    return null
  }

  console.log(`   🆕 Alimento auto-creado: "${nombreFormateado}" (${nuevo.id})`)

  // ── Completar macros y micros con IA (DeepSeek) ──
  try {
    const { data: macros } = await completarAlimentoConIA(nombreFormateado)
    await supabaseService
      .from('alimentos')
      .update({
        calorias: macros.kcal,
        proteinas: macros.proteinas,
        carbohidratos: macros.carbohidratos,
        grasas: macros.grasas,
        fibra: macros.fibra,
        // Micronutrientes (si DeepSeek los devuelve)
        ...(macros.calcio_mg !== undefined && { calcio_mg: macros.calcio_mg }),
        ...(macros.hierro_mg !== undefined && { hierro_mg: macros.hierro_mg }),
        ...(macros.magnesio_mg !== undefined && { magnesio_mg: macros.magnesio_mg }),
        ...(macros.potasio_mg !== undefined && { potasio_mg: macros.potasio_mg }),
        ...(macros.sodio_mg !== undefined && { sodio_mg: macros.sodio_mg }),
        ...(macros.zinc_mg !== undefined && { zinc_mg: macros.zinc_mg }),
        ...(macros.vitamina_c_mg !== undefined && { vitamina_c_mg: macros.vitamina_c_mg }),
        ...(macros.vitamina_a_ug !== undefined && { vitamina_a_ug: macros.vitamina_a_ug }),
        ...(macros.vitamina_d_ug !== undefined && { vitamina_d_ug: macros.vitamina_d_ug }),
        ...(macros.vitamina_b12_ug !== undefined && { vitamina_b12_ug: macros.vitamina_b12_ug }),
        micros_actualizados_en: new Date().toISOString(),
      })
      .eq('id', nuevo.id)
    console.log(`   🤖 IA completada: ${macros.kcal} kcal | P:${macros.proteinas} | C:${macros.carbohidratos} | G:${macros.grasas} | F:${macros.fibra}`)
  } catch (e: any) {
    console.error(`   ⚠️ No se pudieron completar macros con IA:`, e.message)
  }

  return nuevo
}

// ──────────────────────────────────────────────
// agent-browser: herramientas de scraping headless
// ──────────────────────────────────────────────

/**
 * Abre una URL con agent-browser (el browser queda como proceso daemon).
 */
async function agentBrowserOpen(url: string): Promise<void> {
  await execAsync(`agent-browser open "${url.replace(/"/g, '\\"')}" 2>&1`, { timeout: 30000 })
}

/**
 * Obtiene el árbol de accesibilidad con refs (@e1…@eN) vía snapshot -c.
 * Requiere agent-browser open previo.
 */
async function agentBrowserSnapshot(): Promise<string> {
  const { stdout } = await execAsync(`agent-browser snapshot -c 2>&1`, { timeout: 15000 })
  return stdout
}

/**
 * Ejecuta JavaScript arbitrario en el contexto del browser abierto.
 * Requiere agent-browser open previo.
 */
async function agentBrowserEval(js: string): Promise<string> {
  const { stdout } = await execAsync(`agent-browser eval ${JSON.stringify(js)} 2>&1`, { timeout: 15000 })
  return stdout
}

/**
 * Cierra el browser daemon.
 */
async function agentBrowserClose(): Promise<void> {
  await execAsync(`agent-browser close 2>&1`, { timeout: 10000 }).catch(() => {
    // si ya estaba cerrado, ignoramos el error
  })
}

/**
 * Extrae JSON-LD (schema.org Recipe) de una URL usando agent-browser eval.
 * Devuelve el primer Recipe encontrado o null.
 */
async function agentBrowserExtractJSONLD(url: string): Promise<any | null> {
  const js = `JSON.stringify(Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(s => s.textContent).slice(0, 3))`
  try {
    await agentBrowserOpen(url)
    const raw = await agentBrowserEval(js)
    await agentBrowserClose()

    if (!raw || raw === '""' || raw === '[]') return null

    const parsed: string[] = JSON.parse(raw)
    for (const text of parsed) {
      try {
        const data = JSON.parse(text)
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (item['@type'] === 'Recipe' && item.name) {
            return item
          }
        }
      } catch {
        continue
      }
    }
    return null
  } catch {
    await agentBrowserClose().catch(() => { })
    return null
  }
}

async function extractRecipeFromSocial(url: string, fuenteTipo: string): Promise<any> {
  // Paso 1: abrir URL con agent-browser y obtener snapshot del árbol de accesibilidad
  await agentBrowserOpen(url)
  const tree = await agentBrowserSnapshot()
  await agentBrowserClose()

  if (!tree.trim()) throw new Error('agent-browser: árbol de accesibilidad vacío')

  // Paso 2: enviar el árbol de accesibilidad a DeepSeek para que extraiga la receta
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
  if (!DEEPSEEK_KEY) throw new Error('DEEPSEEK_API_KEY not configured')

  const prompt = `Extrae la receta de este árbol de accesibilidad de un post de ${fuenteTipo}. Devuelve SOLO JSON con esta estructura. Si no hay receta, devuelve {"nombre": null}.
{
  "nombre": string | null,
  "descripcion": string | null,
  "categoria": "Desayuno"|"Comida"|"Cena"|"Merienda"|"Snack"|"Postre" | null,
  "tipo_coccion": "No Bake"|"Sartén/Wok"|"Horno"|"Microondas"|"Freidora de Aire"|"Vapor"|"Olla/Cazuela"|"Plancha" | null,
  "dificultad": "Fácil"|"Medio"|"Difícil" | null,
  "porciones": number | null,
  "descripcion_porcion": string | null,
  "tiempo_prep_min": number | null,
  "tiempo_coccion_min": number | null,
  "ingredientes": [{"nombre": string, "cantidad": number | null, "unidad": string | null}],
  "instrucciones": string | null,
  "consejos": string | null,
  "imagen_url": string | null,
  "autor_original": string | null
}
Árbol: ${tree.substring(0, 10000)}`

  const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro'
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek error: ${response.status}`)
  const data = await response.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  if (!text) throw new Error('DeepSeek: respuesta vacía')

  let cleaned = text.trim()
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7)
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3)
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3)
  return JSON.parse(cleaned.trim())
}

// ──────────────────────────────────────────────
// Helper: construye objeto extracted a partir de un schema.org Recipe JSON-LD
// ──────────────────────────────────────────────
function buildExtractedFromJSONLD(item: any): any {
  const instructions: string[] = []
  if (typeof item.recipeInstructions === 'string') {
    instructions.push(item.recipeInstructions)
  } else if (Array.isArray(item.recipeInstructions)) {
    for (const step of item.recipeInstructions) {
      if (typeof step === 'string') {
        instructions.push(step)
      } else if (step?.['@type'] === 'HowToSection' && Array.isArray(step.itemListElement)) {
        for (const subStep of step.itemListElement) {
          if (subStep?.text) instructions.push(subStep.text)
          else if (subStep?.name) instructions.push(subStep.name)
        }
      } else if (step?.text) {
        instructions.push(step.text)
      } else if (step?.name) {
        instructions.push(step.name)
      }
    }
  }

  return {
    nombre: item.name,
    descripcion: item.description || null,
    categoria: mapCategory(item.recipeCategory),
    tipo_coccion: mapCookingMethod(item.cookingMethod),
    dificultad: null,
    porciones: extractYieldNumber(item.recipeYield),
    descripcion_porcion: inferDescripcionPorcion(typeof item.recipeYield === 'string' ? item.recipeYield : null),
    tiempo_prep_min: parseISODurationToMinutes(item.prepTime),
    tiempo_coccion_min: parseISODurationToMinutes(item.cookTime),
    ...(!item.prepTime && !item.cookTime && item.totalTime
      ? { tiempo_prep_min: parseISODurationToMinutes(item.totalTime) }
      : {}),
    ingredientes: (item.recipeIngredient || []).map((ing: string) => {
      const parsed = parseIngredienteRaw(ing)
      return { nombre: parsed.nombre, cantidad: parsed.cantidad, unidad: parsed.unidad }
    }),
    instrucciones: instructions.length > 0
      ? instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : null,
    consejos: null,
    imagen_url: extractImageUrl(item.image),
    autor_original: item.author?.name || null,
  }
}

// ──────────────────────────────────────────────
// POST handler
// ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const supabaseService = createServiceSupabase()

    // ── Parse body ──
    const body = await req.json()
    const url: string = body?.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Se requiere una URL válida' }, { status: 400 })
    }

    // ── Detect source type ──
    const urlLower = url.toLowerCase()
    let fuenteTipo: string
    if (urlLower.includes('instagram.com')) {
      fuenteTipo = 'instagram'
    } else if (urlLower.includes('tiktok.com')) {
      fuenteTipo = 'tiktok'
    } else if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      fuenteTipo = 'youtube'
    } else {
      fuenteTipo = 'web'
    }

    // ── Fetch HTML (web) o agent-browser (social) ──
    let html = ''
    let extracted: any = null

    if (fuenteTipo !== 'web') {
      // Redes sociales: agent-browser extrae el árbol de accesibilidad → DeepSeek parsea receta
      try {
        extracted = await extractRecipeFromSocial(url, fuenteTipo)
        if (!extracted?.nombre) {
          return NextResponse.json(
            { error: 'No se encontró una receta en este post. El post debe incluir ingredientes y pasos de preparación.' },
            { status: 422 }
          )
        }
        extracted.fuente_tipo_override = fuenteTipo
      } catch (err: any) {
        return NextResponse.json(
          { error: `No se pudo acceder al post: ${(err as Error).message?.slice(0, 120) ?? 'error desconocido'}` },
          { status: 422 }
        )
      }
    } else {
      const fetchResponse = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      })
      html = await fetchResponse.text()
    }

    // ── Strategy A: JSON-LD desde HTML (solo web) ──
    if (fuenteTipo === 'web') {
      const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
      let match: RegExpExecArray | null
      while ((match = jsonLdRegex.exec(html)) !== null) {
        try {
          const parsed = JSON.parse(match[1])
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const item of items) {
            if (item['@type'] === 'Recipe' && item.name) {
              extracted = buildExtractedFromJSONLD(item)
              break
            }
          }
          if (extracted) break
        } catch {
          // ignore invalid JSON-LD blocks
        }
      }

      // ── Strategy A.2: JSON-LD vía agent-browser eval (para JS SPAs que inyectan JSON-LD dinámicamente) ──
      if (!extracted?.nombre) {
        try {
          const jsonldItem = await agentBrowserExtractJSONLD(url)
          if (jsonldItem) {
            extracted = buildExtractedFromJSONLD(jsonldItem)
          }
        } catch {
          // si falla agent-browser, continuamos con las estrategias siguientes
        }
      }
    }

    // ── Strategy A.5: enriquecer con IA si JSON-LD incompleto ──
    // Muchos blogs tienen JSON-LD con nombre pero instrucciones vacías o
    // ingredientes sin cantidades. En ese caso llamamos a Gemini para completar
    // y mergeamos conservando los campos estructurales del JSON-LD (tiempo, porciones…)
    if (extracted?.nombre && fuenteTipo === 'web') {
      const sinInstrucciones = !extracted.instrucciones || extracted.instrucciones.trim().length < 30
      const sinCantidades = (extracted.ingredientes || []).every((i: any) => i.cantidad === null)
      if (sinInstrucciones || sinCantidades) {
        try {
          const enriched = await callGeminiExtraction(html)
          extracted = {
            ...enriched,
            // Preservar campos estructurales del JSON-LD si los tiene
            nombre: extracted.nombre || enriched.nombre,
            porciones: extracted.porciones ?? enriched.porciones,
            tiempo_prep_min: extracted.tiempo_prep_min ?? enriched.tiempo_prep_min,
            tiempo_coccion_min: extracted.tiempo_coccion_min ?? enriched.tiempo_coccion_min,
            imagen_url: extracted.imagen_url || enriched.imagen_url,
            categoria: extracted.categoria || enriched.categoria,
            tipo_coccion: extracted.tipo_coccion || enriched.tipo_coccion,
            autor_original: extracted.autor_original || enriched.autor_original,
          }
        } catch {
          // Si falla el enriquecimiento, continuar con lo que tenemos del JSON-LD
        }
      }
    }

    // ── Strategy B: Gemini Flash → DeepSeek fallback ──
    if (!extracted || !extracted.nombre) {
      try {
        extracted = await callGeminiExtraction(html)
      } catch (geminiErr: any) {
        console.error('Gemini failed, trying DeepSeek fallback:', geminiErr?.message)
        try {
          extracted = await callDeepSeekExtraction(html)
        } catch (deepseekErr) {
          console.error('DeepSeek extraction also failed:', deepseekErr)
          return NextResponse.json(
            { error: 'No se pudo extraer la receta de esta URL' },
            { status: 422 }
          )
        }
      }
    }

    // ── Parse ingredients to grams ──
    type ParsedIngredient = {
      nombre: string
      cantidad_original: number | null
      unidad_display: string | null
      cantidad_gramos: number
      orden: number
      alimento_id?: string | null
      es_opcional?: boolean
    }

    const parsedIngredients: ParsedIngredient[] = (extracted.ingredientes || []).map((ing: any, idx: number) => {
      const cantidadEnGramos = parseCantidadAGramos(
        ing.nombre || '',
        ing.cantidad ?? null,
        ing.unidad ?? null
      )
      return {
        nombre: ing.nombre || '',
        cantidad_original: ing.cantidad ?? null,
        unidad_display: ing.unidad ?? null,
        cantidad_gramos: cantidadEnGramos,
        orden: idx,
      }
    })

    // ── Match ingredients with alimentos table ──
    const matchedIngredients: Array<{
      alimento_id: string | null
      nombre_libre: string
      cantidad_gramos: number
      cantidad_original: number | null
      unidad_display: string | null
      orden: number
      es_opcional: boolean
    }> = []

    for (const ing of parsedIngredients) {
      let match = await matchIngredient(supabaseService, ing.nombre)
      // Si no hay match, auto-crear alimento base en BD
      if (!match) {
        match = await autoCrearAlimento(supabaseService, ing.nombre)
      }
      matchedIngredients.push({
        alimento_id: match?.id ?? null,
        nombre_libre: ing.nombre,
        cantidad_gramos: ing.cantidad_gramos,
        cantidad_original: ing.cantidad_original,
        unidad_display: ing.unidad_display,
        orden: ing.orden,
        es_opcional: false,
      })
    }

    // ── Foto automática si el scrape no trajo imagen ──
    let imagenFinal = extracted.imagen_url ?? null
    if (!imagenFinal) {
      imagenFinal = await buscarFotoUnsplash(extracted.nombre)
    }

    // ── Post-procesar texto ──
    // Propagar alimento_id a parsedIngredients (matchedIngredients ya lo tiene)
    const matchedMap = new Map<string, typeof matchedIngredients[0]>()
    for (const mi of matchedIngredients) {
      matchedMap.set(mi.nombre_libre, mi)
    }

    // Capitalizar ingredientes + añadir alimento_id
    const capitalizedIngredients = parsedIngredients.map((ing: ParsedIngredient) => {
      const match = matchedMap.get(ing.nombre)
      return {
        ...ing,
        nombre: ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1),
        alimento_id: match?.alimento_id ?? null,
        es_opcional: match?.es_opcional ?? false,
      }
    })

    // Formatear instrucciones: si no tiene "1. " al inicio, auto-numerar por líneas
    let instruccionesFinal: string | null = extracted.instrucciones ?? null
    if (instruccionesFinal && !instruccionesFinal.match(/^\d+\.\s/)) {
      const saltos: string[] = instruccionesFinal.split(/\n+/).filter(Boolean)
      if (saltos.length > 0) {
        instruccionesFinal = saltos.map((s: string, i: number) => `${i + 1}. ${s.trim()}`).join('\n')
      }
    }

    // ── Insert receta ──
    const { data: receta, error: insertError } = await supabaseService
      .from('recetas')
      .insert({
        coach_id: user.id,
        nombre: extracted.nombre,
        descripcion: extracted.descripcion ?? null,
        instrucciones: instruccionesFinal,
        consejos: extracted.consejos ?? null,
        categoria: extracted.categoria ?? null,
        tipo_coccion: extracted.tipo_coccion ?? null,
        dificultad: extracted.dificultad ?? null,
        porciones: extracted.porciones ?? 1,
        descripcion_porcion: extracted.descripcion_porcion ?? null,
        tiempo_prep_min: extracted.tiempo_prep_min ?? null,
        tiempo_coccion_min: extracted.tiempo_coccion_min ?? null,
        imagen_url: imagenFinal,
        fuente: 'url',
        fuente_tipo: extracted.fuente_tipo_override ?? fuenteTipo,
        url_origen: url,
        autor_original: extracted.autor_original ?? null,
        estado: 'en_revision',
        raw_scrape: {
          html: html.substring(0, 50000),
          scraped_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single()

    if (insertError || !receta) {
      console.error('Error inserting receta:', insertError)
      return NextResponse.json({ error: 'Error al procesar la receta' }, { status: 500 })
    }

    // ── Insert receta_ingredientes ──
    if (capitalizedIngredients.length > 0) {
      const ingredientsToInsert = capitalizedIngredients.map((ing: ParsedIngredient) => ({
        receta_id: receta.id,
        alimento_id: ing.alimento_id,
        nombre_libre: ing.nombre,
        cantidad_gramos: ing.cantidad_gramos,
        cantidad_original: ing.cantidad_original,
        unidad_display: ing.unidad_display,
        orden: ing.orden,
        es_opcional: ing.es_opcional,
      }))

      const { error: ingError } = await supabaseService
        .from('receta_ingredientes')
        .insert(ingredientsToInsert)

      if (ingError) {
        console.error('Error inserting receta_ingredientes:', ingError)
      }
    }

    // ── Recalcular macros de la receta desde ingredientes vinculados ──
    if (matchedIngredients.length > 0) {
      try {
        // Obtener macros de los alimentos vinculados
        const idsAlimentos = [...new Set(matchedIngredients.map(i => i.alimento_id).filter(Boolean))] as string[]
        if (idsAlimentos.length > 0) {
          const { data: alimentosData } = await supabaseService
            .from('alimentos')
            .select('id, calorias, proteinas, carbohidratos, grasas, fibra')
            .in('id', idsAlimentos)

          if (alimentosData?.length) {
            const alimentoMap = Object.fromEntries(alimentosData.map(a => [a.id, a]))
            const porciones = extracted.porciones ?? 1

            let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0, totalFibra = 0

            for (const ing of matchedIngredients) {
              if (!ing.alimento_id || !alimentoMap[ing.alimento_id]) continue
              const a = alimentoMap[ing.alimento_id]
              const factor = (ing.cantidad_gramos || 0) / 100
              totalKcal += (a.calorias || 0) * factor
              totalProt += (a.proteinas || 0) * factor
              totalCarbs += (a.carbohidratos || 0) * factor
              totalGrasas += (a.grasas || 0) * factor
              totalFibra += (a.fibra || 0) * factor
            }

            await supabaseService
              .from('recetas')
              .update({
                kcal: Math.round((totalKcal / porciones) * 100) / 100,
                proteinas: Math.round((totalProt / porciones) * 100) / 100,
                carbohidratos: Math.round((totalCarbs / porciones) * 100) / 100,
                grasas: Math.round((totalGrasas / porciones) * 100) / 100,
                fibra: Math.round((totalFibra / porciones) * 100) / 100,
              })
              .eq('id', receta.id)
          }
        }
      } catch (macroErr) {
        console.error('Error calculando macros para receta:', macroErr)
      }
    }

    // ── Captura de imagen en background si no hay imagen_url ──
    if (!imagenFinal) {
      // Fire and forget — no bloqueamos la respuesta
      fetch(req.nextUrl.origin + '/api/capturar-imagen-receta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cookie': req.headers.get('cookie') ?? '' },
        body: JSON.stringify({
          receta_id: receta.id,
          url_origen: url,
          nombre: extracted.nombre,
          ingredientes: (extracted.ingredientes ?? []).slice(0, 6).map((i: any) => typeof i === 'string' ? i : i.nombre),
          categoria: extracted.categoria ?? null,
        }),
      }).catch(() => { /* background task, ignorar errores */ })
    }

    // ── Return ──
    return NextResponse.json({ url: `/recetas/${receta.id}` })
  } catch (err: any) {
    console.error('Unexpected error in scrape-receta:', err)
    return NextResponse.json({ error: 'Error al procesar la receta' }, { status: 500 })
  }
}

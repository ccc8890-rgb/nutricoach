import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { completarAlimentoConIA } from '@/lib/deepseek'

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
    // Ingredientes líquidos (aceite, vinagre, salsa) → 15g (una cucharada)
    if (/aceite|vinagre|salsa|sirope/i.test(nombre)) return 15
    // Frutas / verduras enteras → 100g (media pieza pequeña)
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
// Helper: call Gemini Flash API
// ──────────────────────────────────────────────
async function callGeminiExtraction(html: string): Promise<any> {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const prompt = `Extrae la receta de este HTML y devuelve SOLO un JSON con esta estructura exacta. IMPORTANTE: Traduce TODO a español aunque el HTML esté en otro idioma.
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
  instrucciones: string | null (EN ESPAÑOL, cada paso en una línea separada empezando por "1. ", "2. ", etc. Ej: "1. Mezcla la harina con los huevos.\n2. Añade la leche y remueve.\n3. Hornea 20 minutos."),
  consejos: string | null,
  imagen_url: string | null,
  autor_original: string | null
}
El campo descripcion_porcion describe qué es físicamente 1 porción. Ejemplos: "1 galleta", "2 tacos", "1 rebanada", "1 bol", "1 donut", "1 porción de tarta". Infierelo del nombre de la receta, el yield y las instrucciones. Si no está claro, pon null.
HTML: ${html.substring(0, 15000)}`

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

  const prompt = `Extrae la receta de este HTML y devuelve SOLO un JSON con esta estructura exacta. IMPORTANTE: Traduce TODO a español aunque el HTML esté en otro idioma.
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
  instrucciones: string | null (EN ESPAÑOL, cada paso en una línea separada empezando por "1. ", "2. ", etc. Ej: "1. Mezcla la harina con los huevos.\n2. Añade la leche y remueve.\n3. Hornea 20 minutos."),
  consejos: string | null,
  imagen_url: string | null,
  autor_original: string | null
}
El campo descripcion_porcion describe qué es físicamente 1 porción. Ejemplos: "1 galleta", "2 tacos", "1 rebanada", "1 bol", "1 donut", "1 porción de tarta". Infierelo del nombre de la receta, el yield y las instrucciones. Si no está claro, pon null.
HTML: ${html.substring(0, 15000)}`

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
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
    .select('id, nombre')
    .ilike('nombre', '%' + token + '%')
  if (direct && direct.length > 0) return direct

  const variantes = generarVariantesAcento(token).filter(v => v !== token)
  if (variantes.length === 0) return []

  const conditions = variantes.map(v => `nombre.ilike.%${v}%`)
  const { data: conAcentos } = await supabaseService
    .from('alimentos')
    .select('id, nombre')
    .or(conditions.join(','))

  return conAcentos || []
}

// ──────────────────────────────────────────────
// Sistema de puntuación (todo normalizado por acentos)
// ──────────────────────────────────────────────

function puntuarCandidato(
  candidato: string,
  tokensBuscar: string[],
  consultaOriginal: string
): { total: number; palabrasRestrictivas: number; tokensMatchCount: number } {
  const aNorm = norm(candidato)
  const queryNorm = norm(consultaOriginal)
  const queryLower = consultaOriginal.toLowerCase().trim()
  const palabrasConsulta = queryLower.split(/\s+/).filter(p => p.length > 0 && !CONNECTORS.has(p))

  const tokensNorm = tokensBuscar.map(t => norm(t))

  let baseScore = 0
  let penalizacionFaltantes = 0
  let tokensMatchCount = 0

  for (let i = 0; i < tokensBuscar.length; i++) {
    const tNorm = tokensNorm[i]
    const tOrig = tokensBuscar[i]
    if (aNorm.includes(tNorm)) {
      baseScore += 10
      tokensMatchCount++
    } else {
      if (PREP_WORDS.has(tOrig)) {
        penalizacionFaltantes += 2
      } else {
        penalizacionFaltantes += 8
      }
    }
  }

  const palabrasCandidato = aNorm.split(/[\s()]+/).filter(p => p.length > 0 && !CONNECTORS.has(p))
  let penalizacionExtra = 0
  let sustantivasExtra = 0
  let palabrasRestrictivas = 0

  for (const pc of palabrasCandidato) {
    if (pc.length <= 2) continue
    if (palabraEnConsulta(pc, palabrasConsulta.map(norm))) continue

    if (DISH_WORDS.has(pc)) {
      penalizacionExtra += 12
      sustantivasExtra++
    } else if (PREP_WORDS.has(pc)) {
      penalizacionExtra += 2
      if (RESTRICTIVE_WORDS.has(pc)) {
        penalizacionExtra += 5
        palabrasRestrictivas++
      }
    } else if (esSustantiva(pc)) {
      penalizacionExtra += 10
      sustantivasExtra++
    } else {
      penalizacionExtra += 3
    }
  }

  if (aNorm.includes('(') && !queryNorm.includes('(')) {
    penalizacionExtra += 2
  }

  const queryRoot = singularizar(queryNorm)
  if (queryRoot.length > 3 && aNorm.includes(queryRoot)) {
    baseScore += 3
    if (palabrasCandidato.length > 0) {
      const mainWord = palabrasCandidato[0]
      if (mainWord === queryRoot || queryRoot.includes(mainWord) || mainWord.includes(queryRoot)) {
        baseScore += 5
      }
    }
  }

  if (sustantivasExtra > 1) {
    penalizacionExtra += sustantivasExtra * 5
  }

  return {
    total: baseScore - penalizacionFaltantes - penalizacionExtra,
    palabrasRestrictivas,
    tokensMatchCount
  }
}

// ──────────────────────────────────────────────
// Helper: match ingredient name to alimentos table
// ──────────────────────────────────────────────
async function matchIngredient(
  supabaseService: any,
  nombre: string
): Promise<{ id: string; nombre: string } | null> {
  const q = nombre.toLowerCase().trim()

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
    const tokensNorm = tokensBuscar.map(t => norm(t))
    const tokensMatchCount = tokensNorm.filter(t => aMejorNorm.includes(t)).length
    const extra = contarExtraSustantivas(mejor.nombre)

    const palabrasSustantivasConsulta = q.split(/\s+/)
      .filter(p => p.length > 0 && !CONNECTORS.has(p) && !PREP_WORDS.has(p))
    const toleranciaExtra = palabrasSustantivasConsulta.length <= 1 ? 0 : 1

    if (mejor.total > 0 && extra <= toleranciaExtra) {
      return mejor
    }

    if (extra === 0 && tokensMatchCount >= 1) {
      return mejor
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

    if (fuenteTipo !== 'web') {
      return NextResponse.json(
        {
          error:
            'Por ahora solo se pueden importar recetas desde webs. El soporte para Instagram y TikTok estará disponible próximamente.',
        },
        { status: 422 }
      )
    }

    // ── Fetch HTML ──
    const fetchResponse = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NutriCoachBot/1.0)' },
    })
    const html = await fetchResponse.text()

    // ── Strategy A: JSON-LD ──
    let extracted: any = null
    const jsonLdRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    let match: RegExpExecArray | null
    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1])
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item['@type'] === 'Recipe' && item.name) {
            // Build extracted object
            const instructions: string[] = []
            if (Array.isArray(item.recipeInstructions)) {
              for (const step of item.recipeInstructions) {
                if (typeof step === 'string') {
                  instructions.push(step)
                } else if (step?.text) {
                  instructions.push(step.text)
                } else if (step?.name) {
                  instructions.push(step.name)
                }
              }
            }

            extracted = {
              nombre: item.name,
              descripcion: item.description || null,
              categoria: mapCategory(item.recipeCategory),
              tipo_coccion: mapCookingMethod(item.cookingMethod),
              dificultad: null, // not in schema.org
              porciones: extractYieldNumber(item.recipeYield),
              descripcion_porcion: inferDescripcionPorcion(typeof item.recipeYield === 'string' ? item.recipeYield : null),
              tiempo_prep_min: parseISODurationToMinutes(item.prepTime),
              tiempo_coccion_min: parseISODurationToMinutes(item.cookTime),
              // fallback to totalTime if both missing
              ...(!item.prepTime && !item.cookTime && item.totalTime
                ? { tiempo_prep_min: parseISODurationToMinutes(item.totalTime) }
                : {}),
              ingredientes: (item.recipeIngredient || []).map((ing: string) => ({
                nombre: ing,
                cantidad: null,
                unidad: null,
              })),
              instrucciones: instructions.length > 0
                ? instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')
                : null,
              consejos: null,
              imagen_url: extractImageUrl(item.image),
              autor_original: item.author?.name || null,
            }
            break
          }
        }
        if (extracted) break
      } catch {
        // ignore invalid JSON-LD blocks
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
    // Capitalizar ingredientes
    const capitalizedIngredients = parsedIngredients.map((ing: ParsedIngredient) => ({
      ...ing,
      nombre: ing.nombre.charAt(0).toUpperCase() + ing.nombre.slice(1),
    }))

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
        fuente_tipo: 'web',
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
        // We still return success with the receta URL, but log the error
      }
    }

    // ── Return ──
    return NextResponse.json({ url: `/recetas/${receta.id}` })
  } catch (err: any) {
    console.error('Unexpected error in scrape-receta:', err)
    return NextResponse.json({ error: 'Error al procesar la receta' }, { status: 500 })
  }
}

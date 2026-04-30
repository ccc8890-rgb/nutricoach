import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

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
function parseCantidadAGramos(
  nombre: string,
  cantidad: number | null,
  unidad: string | null
): number {
  if (cantidad === null || cantidad === undefined) return 100 // default estimate
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

  for (const [aliases, multiplier] of unitMap) {
    if (aliases.includes(u)) {
      return cantidad * multiplier
    }
  }

  // default: assume grams if no unit match
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

  const prompt = `Extrae la receta de este HTML y devuelve SOLO un JSON con esta estructura exacta:
{
  nombre: string,
  descripcion: string | null,
  categoria: 'Desayuno'|'Comida'|'Cena'|'Merienda'|'Snack'|'Postre' | null,
  tipo_coccion: 'No Bake'|'Sartén/Wok'|'Horno'|'Microondas'|'Freidora de Aire'|'Vapor'|'Olla/Cazuela'|'Plancha' | null,
  dificultad: 'Fácil'|'Medio'|'Difícil' | null,
  porciones: number | null,
  tiempo_prep_min: number | null,
  tiempo_coccion_min: number | null,
  ingredientes: Array<{ nombre: string, cantidad: number | null, unidad: string | null }>,
  instrucciones: string | null,
  consejos: string | null,
  imagen_url: string | null,
  autor_original: string | null
}
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

// ──────────────────────────────────────────────
// Helper: match ingredient name to alimentos table
// ──────────────────────────────────────────────
async function matchIngredient(
  supabaseService: any,
  nombre: string
): Promise<{ id: string; nombre: string } | null> {
  // 1. exact ilike
  const { data: exact } = await supabaseService
    .from('alimentos')
    .select('id, nombre')
    .ilike('nombre', `%${nombre}%`)
    .limit(1)
  if (exact && exact.length > 0) return exact[0]

  // 2. first long word (>3 chars)
  const words = nombre.split(/\s+/).filter((w: string) => w.length > 3)
  for (const word of words) {
    const { data: byWord } = await supabaseService
      .from('alimentos')
      .select('id, nombre')
      .ilike('nombre', `%${word}%`)
      .limit(1)
    if (byWord && byWord.length > 0) return byWord[0]
  }

  return null
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

    // ── Strategy B: Gemini Flash ──
    if (!extracted || !extracted.nombre) {
      try {
        extracted = await callGeminiExtraction(html)
      } catch (err) {
        console.error('Gemini extraction failed:', err)
        return NextResponse.json(
          { error: 'No se pudo extraer la receta de esta URL' },
          { status: 422 }
        )
      }
    }

    // ── Parse ingredients to grams ──
    const parsedIngredients = (extracted.ingredientes || []).map((ing: any, idx: number) => {
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
      const match = await matchIngredient(supabaseService, ing.nombre)
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

    // ── Insert receta ──
    const { data: receta, error: insertError } = await supabaseService
      .from('recetas')
      .insert({
        coach_id: user.id,
        nombre: extracted.nombre,
        descripcion: extracted.descripcion ?? null,
        instrucciones: extracted.instrucciones ?? null,
        consejos: extracted.consejos ?? null,
        categoria: extracted.categoria ?? null,
        tipo_coccion: extracted.tipo_coccion ?? null,
        dificultad: extracted.dificultad ?? null,
        porciones: extracted.porciones ?? 1,
        tiempo_prep_min: extracted.tiempo_prep_min ?? null,
        tiempo_coccion_min: extracted.tiempo_coccion_min ?? null,
        imagen_url: extracted.imagen_url ?? null,
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
    if (matchedIngredients.length > 0) {
      const ingredientsToInsert = matchedIngredients.map((ing) => ({
        receta_id: receta.id,
        alimento_id: ing.alimento_id,
        nombre_libre: ing.nombre_libre,
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

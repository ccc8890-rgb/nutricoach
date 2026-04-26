import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
    })
    if (!res.ok) return NextResponse.json({ error: `No se pudo acceder a la URL (${res.status})` }, { status: 400 })

    const html = await res.text()

    // --- Extraer JSON-LD (comillas simples y dobles) ---
    const jsonLdBlocks = [...html.matchAll(/<script[^>]+type=['"]application\/ld\+json['"][^>]*>([\s\S]*?)<\/script>/gi)]
    let recipe: any = null

    for (const block of jsonLdBlocks) {
      try {
        const parsed = JSON.parse(block[1].trim())
        const candidates = Array.isArray(parsed) ? parsed : [parsed]
        for (const c of candidates) {
          const type = Array.isArray(c['@type']) ? c['@type'] : [c['@type']]
          if (type.some((t: string) => t === 'Recipe' || t?.endsWith('/Recipe'))) {
            recipe = c; break
          }
          if (c['@graph']) {
            const found = c['@graph'].find((g: any) => {
              const gt = Array.isArray(g['@type']) ? g['@type'] : [g['@type']]
              return gt.some((t: string) => t === 'Recipe' || t?.endsWith('/Recipe'))
            })
            if (found) { recipe = found; break }
          }
        }
        if (recipe) break
      } catch { continue }
    }

    // --- Fallback: microdata itemtype schema.org/Recipe ---
    if (!recipe) {
      recipe = extractMicrodata(html)
    }

    if (!recipe) {
      return NextResponse.json(
        { error: 'No se encontraron datos de receta en esta URL. Prueba con directoalpaladar.com, recetasderechupete.com u otro sitio con recetas estructuradas.' },
        { status: 404 }
      )
    }

    // --- Imagen ---
    let imagen_url: string | undefined
    if (recipe.image) {
      if (typeof recipe.image === 'string') imagen_url = recipe.image
      else if (Array.isArray(recipe.image)) imagen_url = typeof recipe.image[0] === 'string' ? recipe.image[0] : recipe.image[0]?.url
      else if (recipe.image.url) imagen_url = recipe.image.url
    }

    // --- Tiempos ISO 8601 ---
    function parseDuration(iso?: string): number | undefined {
      if (!iso) return undefined
      const hours = iso.match(/(\d+)H/)?.[1]
      const mins = iso.match(/(\d+)M/)?.[1]
      const total = (parseInt(hours ?? '0') * 60) + parseInt(mins ?? '0')
      return total > 0 ? total : undefined
    }

    // --- Ingredientes ---
    const rawIngredients: any[] = recipe.recipeIngredient ?? recipe.ingredients ?? []
    const ingredientes_texto: string[] = rawIngredients
      .map((i: any) => {
        if (typeof i === 'string') return i.trim()
        if (i.name && i.amount) return `${i.amount} ${i.name}`.trim()
        if (i.name) return i.name.trim()
        if (i.text) return i.text.trim()
        return ''
      })
      .filter(Boolean)

    // --- Instrucciones ---
    let instrucciones = ''
    const raw = recipe.recipeInstructions ?? recipe.instructions
    if (raw) {
      if (typeof raw === 'string') {
        instrucciones = raw.replace(/<[^>]+>/g, '').trim()
      } else if (Array.isArray(raw)) {
        instrucciones = raw
          .map((step: any, i: number) => {
            const texto = typeof step === 'string' ? step : (step.text ?? step.name ?? '')
            return `${i + 1}. ${texto.replace(/<[^>]+>/g, '').trim()}`
          })
          .filter(s => s.length > 3)
          .join('\n')
      }
    }

    // --- Porciones ---
    let porciones: number | undefined
    const rawYield = recipe.recipeYield ?? recipe.yield
    if (rawYield) {
      const raw = Array.isArray(rawYield) ? rawYield[0] : rawYield
      const num = parseInt(String(raw))
      if (!isNaN(num) && num > 0) porciones = num
    }

    return NextResponse.json({
      nombre: recipe.name ?? 'Receta importada',
      descripcion: recipe.description ? recipe.description.replace(/<[^>]+>/g, '').trim() : undefined,
      instrucciones: instrucciones || undefined,
      imagen_url,
      porciones,
      tiempo_prep_min: parseDuration(recipe.prepTime),
      tiempo_coccion_min: parseDuration(recipe.cookTime ?? recipe.totalTime),
      ingredientes_texto,
      url_origen: url,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error al importar' }, { status: 500 })
  }
}

// Extrae datos de receta desde microdata (itemtype schema.org/Recipe)
function extractMicrodata(html: string): any | null {
  try {
    const recipeBlock = html.match(/itemtype=["']https?:\/\/schema\.org\/Recipe["'][^>]*>([\s\S]*?)(?=<[^>]+itemtype=|<\/body>)/i)
    if (!recipeBlock) return null

    const block = recipeBlock[0]

    function getProp(name: string): string {
      const m = block.match(new RegExp(`itemprop=["']${name}["'][^>]*(?:content=["']([^"']+)["']|>([^<]+)<)`, 'i'))
      return (m?.[1] ?? m?.[2] ?? '').trim()
    }

    function getAllProps(name: string): string[] {
      const re = new RegExp(`itemprop=["']${name}["'][^>]*(?:content=["']([^"']+)["']|>([^<]+)<)`, 'gi')
      const results: string[] = []
      let m
      while ((m = re.exec(block)) !== null) {
        const val = (m[1] ?? m[2] ?? '').trim()
        if (val) results.push(val)
      }
      return results
    }

    const nombre = getProp('name')
    if (!nombre) return null

    return {
      name: nombre,
      description: getProp('description'),
      recipeIngredient: getAllProps('recipeIngredient'),
      prepTime: getProp('prepTime'),
      cookTime: getProp('cookTime'),
      recipeYield: getProp('recipeYield'),
      image: getProp('image'),
    }
  } catch {
    return null
  }
}

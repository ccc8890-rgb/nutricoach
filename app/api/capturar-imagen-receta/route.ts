import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { uploadToCloudinary } from '@/lib/cloudinary'

// ──────────────────────────────────────────────
// Estilos por categoría — variedad de entornos caseros
// ──────────────────────────────────────────────
const HOME_STYLES: Record<string, string[]> = {
  Desayuno: [
    'morning light through kitchen window, wooden table, coffee cup nearby',
    'bright morning Mediterranean kitchen, white countertop, casual breakfast setup',
    'early morning soft light, rustic wood surface, simple home kitchen',
  ],
  Comida: [
    'afternoon natural light, home dining table, casual Spanish kitchen setting',
    'warm midday light through window, simple ceramic plate, home cooked meal',
    'Mediterranean kitchen lunch, terracotta tiles, natural window light',
  ],
  Cena: [
    'warm evening kitchen light, dim cozy home setting, casual dinner plate',
    'low natural light, dark wood table, intimate home dinner atmosphere',
    'evening warm tones, simple home plating, Spanish kitchen ambiance',
  ],
  Postre: [
    'afternoon light, white kitchen counter, homemade dessert casual style',
    'soft window light, marble surface, simple home baking setup',
    'natural light, wooden cutting board, casual homemade sweet',
  ],
  Snack: [
    'quick grab shot, kitchen counter, casual home snack moment',
    'natural light, simple plate, casual afternoon at home',
  ],
  Merienda: [
    'afternoon warm light, home kitchen table, casual snack time',
    'soft afternoon light, simple ceramic plate, Mediterranean home kitchen',
  ],
}

function getHomeStyle(categoria: string | null): string {
  const options = HOME_STYLES[categoria ?? ''] ?? HOME_STYLES['Comida']
  return options[Math.floor(Math.random() * options.length)]
}

// Anti-plagiarism prompt: personal home style, NOT studio/professional
function buildAntiPlagiarismPrompt(nombre: string, categoria: string | null): string {
  const style = getHomeStyle(categoria)
  return [
    `casual home food photo of "${nombre}",`,
    `${style},`,
    `shot on Sony mirrorless camera, personal food blog aesthetic,`,
    `authentic home-cooked presentation, honest natural food photography,`,
    `slightly imperfect composition, no studio lighting, no flash,`,
    `warm color grade, real kitchen feel, not overly styled.`,
    `Preserve the food composition but change background and lighting mood.`,
    `Photorealistic, no AI artifacts, no watermarks.`,
  ].join(' ')
}

// ──────────────────────────────────────────────
// Capturar imagen real con agent-browser
// ──────────────────────────────────────────────
function captureImageWithAgentBrowser(sourceUrl: string): Buffer | null {
  try {
    const env = { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}` }

    const result = execSync(
      `agent-browser open ${JSON.stringify(sourceUrl)} && agent-browser eval "JSON.stringify(Array.from(document.querySelectorAll('img')).filter(img=>img.naturalWidth>100).sort((a,b)=>(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight)).slice(0,10).map(img=>img.src))"`,
      { timeout: 35000, encoding: 'utf8', env }
    )

    // Extract image URLs from eval result
    let urls: string[] = []
    try {
      const match = result.match(/\[[\s\S]*?\]/)
      if (match) urls = (JSON.parse(match[0]) as string[]).filter(u => typeof u === 'string' && u.startsWith('http'))
    } catch { /* fallback regex */ }

    if (urls.length === 0) {
      const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
      urls = [...new Set([...(result.matchAll(imgRegex) as any)].map((m: any) => m[0]))]
    }

    // Download the largest image
    for (const imgUrl of urls.slice(0, 10)) {
      try {
        const response = execSync(
          `curl -sL --max-time 10 --max-filesize 5000000 "${imgUrl}" -o -`,
          { timeout: 12000, maxBuffer: 10 * 1024 * 1024 }
        )
        if (Buffer.isBuffer(response) && response.length > 15000) {
          return response
        }
      } catch {
        continue
      }
    }
  } catch {
    // agent-browser not available or URL inaccessible
  }
  return null
}

// ──────────────────────────────────────────────
// OpenAI GPT-image-1.5 edit — limpieza + homogeneización
// ──────────────────────────────────────────────
async function applyOpenAIImageEdit(
  imageBuffer: Buffer,
  nombre: string,
  categoria: string | null
): Promise<Buffer | null> {
  const OPENAI_KEY = process.env.OPENAI_API_KEY
  if (!OPENAI_KEY) return null

  try {
    const style = getHomeStyle(categoria)
    const prompt = [
      `Clean up this food photo of "${nombre}":`,
      '1. Remove all overlaid text, calorie labels, hashtags, TikTok/Instagram watermarks.',
      '2. Remove any hands or people visible. Keep only the dish.',
      '3. Keep the exact same food composition and plating.',
      `4. Adjust to: ${style}.`,
      'Result: same food, clean home kitchen look, no text, no watermarks. Photorealistic.',
    ].join(' ')

    const form = new FormData()
    form.append('image', new Blob([imageBuffer.buffer as ArrayBuffer], { type: 'image/jpeg' }), 'image.jpg')
    form.append('model', 'gpt-image-1.5')
    form.append('prompt', prompt)
    form.append('n', '1')
    form.append('size', '1024x1024')
    form.append('quality', 'medium')

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('OpenAI image edit error:', res.status, err.slice(0, 200))
      return null
    }

    const data = await res.json() as { data?: { b64_json?: string; url?: string }[] }
    const b64 = data.data?.[0]?.b64_json
    if (b64) return Buffer.from(b64, 'base64')

    const url = data.data?.[0]?.url
    if (url) {
      const imgRes = await fetch(url, { signal: AbortSignal.timeout(30000) })
      return Buffer.from(await imgRes.arrayBuffer())
    }
  } catch (err) {
    console.error('OpenAI image edit exception:', err)
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
    const body = await req.json()
    const { receta_id, url_origen, nombre, categoria } = body

    if (!receta_id || !nombre) {
      return NextResponse.json({ error: 'receta_id y nombre son obligatorios' }, { status: 400 })
    }

    // ── 1. Capturar imagen real de la fuente con agent-browser ──
    let imageBuffer: Buffer | null = url_origen ? captureImageWithAgentBrowser(url_origen) : null

    // ── 2. OpenAI GPT-image-1.5 edit — limpieza + homogeneización ──
    let finalImageUrl: string | null = null
    if (imageBuffer) {
      const refined = await applyOpenAIImageEdit(imageBuffer, nombre, categoria ?? null)
      if (refined) imageBuffer = refined
    }

    // ── 3. Subir a Cloudinary ──
    if (imageBuffer) {
      finalImageUrl = await uploadToCloudinary(imageBuffer, {
        folder: 'nutricoach/recetas',
        public_id: receta_id,
      })
    }

    if (!finalImageUrl) {
      return NextResponse.json({ error: 'No se pudo obtener imagen' }, { status: 422 })
    }

    // ── 4. Actualizar receta en BD ──
    const { error: updateError } = await supabaseService
      .from('recetas')
      .update({ imagen_url: finalImageUrl })
      .eq('id', receta_id)
      .eq('coach_id', user.id)

    if (updateError) {
      console.error('Error actualizando imagen de receta:', updateError)
      return NextResponse.json({ error: 'Error al actualizar receta' }, { status: 500 })
    }

    return NextResponse.json({ imagen_url: finalImageUrl })
  } catch (err) {
    console.error('capturar-imagen-receta error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

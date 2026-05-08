import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

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
    const tree = execSync(
      `agent-browser accessibility ${JSON.stringify(sourceUrl)}`,
      {
        timeout: 30000,
        encoding: 'utf8',
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}` },
      }
    )

    // Extract image URLs from accessibility tree
    const imgRegex = /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
    const urls = [...new Set([...(tree.matchAll(imgRegex) as any)].map((m: any) => m[0]))]

    // Download the largest image (most likely the recipe photo)
    for (const imgUrl of urls.slice(0, 15)) {
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
// Flux img2img — transformación suave (anti-plagio)
// ──────────────────────────────────────────────
async function applyFluxImgToImg(
  imageBuffer: Buffer,
  prompt: string,
  strength = 0.2
): Promise<string | null> {
  const API_KEY = process.env.REPLICATE_API_KEY
  if (!API_KEY) return null

  try {
    const dataUri = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-pro',
        input: {
          image: dataUri,
          prompt,
          strength,          // 0.2 = cambio sutil, mantiene composición original
          aspect_ratio: '1:1',
          output_format: 'webp',
          safety_tolerance: 2,
          seed: Math.floor(Math.random() * 999999), // variedad entre imágenes
        },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!createRes.ok) return null
    const prediction = await createRes.json()
    const pollUrl: string = prediction.urls?.get
    if (!pollUrl) return null

    // Poll hasta succeeded (máx 60s)
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2500))
      const poll = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!poll.ok) break
      const status = await poll.json()
      if (status.status === 'succeeded') {
        const output = status.output
        return Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : null)
      }
      if (status.status === 'failed') break
    }
  } catch {
    // Replicate error — fallback to direct image
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

    // ── 1. Capturar imagen real de la fuente ──
    let imageBuffer: Buffer | null = url_origen ? captureImageWithAgentBrowser(url_origen) : null

    // ── 2. Flux img2img suave (anti-plagio + estilo personal) ──
    let finalImageUrl: string | null = null
    if (imageBuffer) {
      const prompt = buildAntiPlagiarismPrompt(nombre, categoria ?? null)
      const fluxUrl = await applyFluxImgToImg(imageBuffer, prompt, 0.2)

      if (fluxUrl) {
        // Descargar resultado de Flux y usar ese buffer para Storage
        const fluxRes = await fetch(fluxUrl, { signal: AbortSignal.timeout(15000) })
        if (fluxRes.ok) {
          imageBuffer = Buffer.from(await fluxRes.arrayBuffer())
        }
        finalImageUrl = fluxUrl // fallback si falla el upload
      }
    }

    // ── 3. Subir a Supabase Storage ──
    if (imageBuffer) {
      const path = `${receta_id}/auto_${Date.now()}.webp`
      const { error: uploadError } = await supabaseService.storage
        .from('recetas-imagenes')
        .upload(path, imageBuffer, { contentType: 'image/webp', upsert: true })

      if (!uploadError) {
        const { data: { publicUrl } } = supabaseService.storage
          .from('recetas-imagenes')
          .getPublicUrl(path)
        finalImageUrl = publicUrl
      }
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

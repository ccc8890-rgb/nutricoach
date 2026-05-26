import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const URL_FIELDS = new Set(['foto_url', 'video_url'])
const VIDEO_TIPOS = new Set(['youtube', 'vimeo', 'instagram', 'tiktok', 'externo'])

function normalizeNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function inferVideoTipo(videoUrl: string | null) {
  if (!videoUrl) return null
  try {
    const host = new URL(videoUrl).hostname.replace(/^www\./, '')
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube'
    if (host.includes('vimeo.com')) return 'vimeo'
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('tiktok.com')) return 'tiktok'
  } catch {
    return null
  }
  return 'externo'
}

/**
 * PATCH /api/ejercicios/[id]/media
 * Actualiza los campos de media de un ejercicio:
 * foto_url, video_url, video_tipo, dificultad_nivel, equipamiento, musculos_secundarios
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth check
  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const allowed = ['foto_url', 'video_url', 'video_tipo', 'dificultad_nivel', 'equipamiento', 'musculos_secundarios']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      const value = body[key]

      if (URL_FIELDS.has(key)) {
        const normalized = normalizeNullableString(value)
        if (normalized === undefined) {
          return NextResponse.json({ error: `${key} debe ser texto o null` }, { status: 400 })
        }
        if (normalized && !isHttpUrl(normalized)) {
          return NextResponse.json({ error: `${key} debe ser una URL http/https válida` }, { status: 400 })
        }
        updates[key] = normalized
        continue
      }

      if (key === 'video_tipo') {
        const normalized = normalizeNullableString(value)
        if (normalized === undefined) {
          return NextResponse.json({ error: 'video_tipo debe ser texto o null' }, { status: 400 })
        }
        if (normalized && !VIDEO_TIPOS.has(normalized)) {
          return NextResponse.json({ error: 'video_tipo no válido' }, { status: 400 })
        }
        updates[key] = normalized
        continue
      }

      if (key === 'dificultad_nivel') {
        const difficulty = Number(value)
        if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
          return NextResponse.json({ error: 'dificultad_nivel debe estar entre 1 y 5' }, { status: 400 })
        }
        updates[key] = difficulty
        continue
      }

      if (key === 'equipamiento' || key === 'musculos_secundarios') {
        if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
          return NextResponse.json({ error: `${key} debe ser un array de texto` }, { status: 400 })
        }
        updates[key] = value.map(item => item.trim()).filter(Boolean)
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
  }

  if ('video_url' in updates && !('video_tipo' in updates)) {
    updates.video_tipo = inferVideoTipo(updates.video_url as string | null)
  }

  const db = createServiceSupabase()
  const { data, error } = await db
    .from('ejercicios')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[PATCH /api/ejercicios/[id]/media]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * GET /api/ejercicios/[id]/media
 * Devuelve los campos de media de un ejercicio.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const db = createServiceSupabase()
  const { data, error } = await db
    .from('ejercicios')
    .select('id, nombre, foto_url, video_url, video_tipo, dificultad_nivel, equipamiento, musculos_secundarios')
    .eq('id', id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

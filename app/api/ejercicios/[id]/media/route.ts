import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

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

  // Only allow updating media fields
  const allowed = ['foto_url', 'video_url', 'video_tipo', 'dificultad_nivel', 'equipamiento', 'musculos_secundarios']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
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

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const ESTADOS = ['pendiente', 'revisar', 'aprobada', 'rechazada', 'sin_imagen'] as const
const ORIGENES = ['missing', 'scraped', 'uploaded', 'ai', 'desconocida'] as const

function clampScore(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const db = createServiceSupabase()

  const { data: receta, error: findError } = await db
    .from('recetas')
    .select('id, coach_id')
    .eq('id', id)
    .or(`coach_id.eq.${user.id},coach_id.is.null`)
    .single()

  if (findError || !receta) {
    return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
  }

  const imagen_estado = ESTADOS.includes(body.imagen_estado) ? body.imagen_estado : undefined
  const imagen_origen = ORIGENES.includes(body.imagen_origen) ? body.imagen_origen : undefined

  const patch: Record<string, unknown> = {
    imagen_updated_at: new Date().toISOString(),
  }

  if (imagen_estado) {
    patch.imagen_estado = imagen_estado
    patch.imagen_needs_review = imagen_estado !== 'aprobada'
    if (imagen_estado === 'aprobada' || imagen_estado === 'rechazada') {
      patch.imagen_reviewed_at = new Date().toISOString()
      patch.imagen_reviewed_by = user.id
    }
  }
  if (imagen_origen) patch.imagen_origen = imagen_origen
  if ('imagen_review_notes' in body) patch.imagen_review_notes = String(body.imagen_review_notes ?? '').slice(0, 1200)
  if ('imagen_quality_score' in body) patch.imagen_quality_score = clampScore(body.imagen_quality_score)
  if ('imagen_realismo_score' in body) patch.imagen_realismo_score = clampScore(body.imagen_realismo_score)
  if ('imagen_match_receta_score' in body) patch.imagen_match_receta_score = clampScore(body.imagen_match_receta_score)
  if ('imagen_estilo_preset' in body) patch.imagen_estilo_preset = String(body.imagen_estilo_preset ?? '').slice(0, 120)
  if ('imagen_prompt_base' in body) patch.imagen_prompt_base = String(body.imagen_prompt_base ?? '').slice(0, 4000)
  if ('imagen_needs_review' in body && typeof body.imagen_needs_review === 'boolean') patch.imagen_needs_review = body.imagen_needs_review

  const { data, error } = await db
    .from('recetas')
    .update(patch)
    .eq('id', id)
    .select('id, imagen_estado, imagen_origen, imagen_quality_score, imagen_realismo_score, imagen_match_receta_score, imagen_needs_review, imagen_review_notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

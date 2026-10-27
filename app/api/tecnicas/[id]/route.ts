import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { validarTecnica } from '@/lib/tecnicas'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Una técnica con las recetas que la usan («se usa en»). Solo coach.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Técnica no válida' }, { status: 400 })
  const { data: tecnica } = await auth.admin.from('tecnicas').select('*').eq('id', id).maybeSingle()
  if (!tecnica) return NextResponse.json({ error: 'Técnica no encontrada' }, { status: 404 })
  const { data: enlaces } = await auth.admin.from('receta_tecnicas').select('receta_id').eq('tecnica_id', id)
  const ids = (enlaces ?? []).map(e => e.receta_id as string)
  const { data: recetas } = ids.length ? await auth.admin.from('recetas').select('id, nombre, tipo_contenido, estado').in('id', ids).neq('estado', 'descartada').order('nombre') : { data: [] }
  return NextResponse.json({ tecnica, usada_en: recetas ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Técnica no válida' }, { status: 400 })
  const v = validarTecnica(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  const { error } = await auth.admin.from('tecnicas').update({ ...v.tecnica, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar la técnica' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Técnica no válida' }, { status: 400 })
  const { error } = await auth.admin.from('tecnicas').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo borrar la técnica' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

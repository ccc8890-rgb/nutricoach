import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { ASPECTOS_IDS, TAG_CORREGIR } from '@/lib/recetas/correcciones'

export const dynamic = 'force-dynamic'

async function autorizar(req: NextRequest, id: string) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const srv = createServiceSupabase()
  const { data: perfil } = await srv.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (perfil?.role !== 'coach') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  const { data: receta } = await srv.from('recetas').select('id, tags, notas_coach, imagen_estado').eq('id', id).eq('coach_id', user.id).maybeSingle()
  if (!receta) return { error: NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 }) }
  return { srv, receta }
}

/** Marca la receta «para corregir»: qué aspectos fallan y una nota. Queda fuera de «Pendientes» hasta que se corrija. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizar(req, id)
  if ('error' in a) return a.error
  const body = await req.json().catch(() => ({}))
  const aspectos: string[] = Array.isArray(body.aspectos) ? body.aspectos.filter((x: unknown): x is string => typeof x === 'string' && ASPECTOS_IDS.includes(x)) : []
  const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 600) : ''
  if (aspectos.length === 0 && !nota) return NextResponse.json({ error: 'Indica qué está mal (o escribe una nota)' }, { status: 400 })

  const tags = [...new Set([...(a.receta.tags ?? []), TAG_CORREGIR])]
  const fecha = new Date().toLocaleDateString('es-ES')
  const linea = `[${fecha}] A corregir: ${aspectos.join(', ') || 'otro'}${nota ? ` — ${nota}` : ''}`
  const update: Record<string, unknown> = { tags, notas_coach: [a.receta.notas_coach, linea].filter(Boolean).join('\n') }
  if (aspectos.includes('foto')) { update.imagen_estado = 'revisar'; update.imagen_needs_review = true }
  const { error } = await a.srv.from('recetas').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo marcar' }, { status: 500 })
  await a.srv.from('recetas_auditoria').insert({ receta_id: id, evento: 'correccion_solicitada', issues: { aspectos, nota }, origen: 'coach_revision' })
  return NextResponse.json({ ok: true })
}

/** Quita la marca (la receta vuelve a «Pendientes»). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizar(req, id)
  if ('error' in a) return a.error
  const tags = (a.receta.tags ?? []).filter((t: string) => t !== TAG_CORREGIR)
  const { error } = await a.srv.from('recetas').update({ tags }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo quitar la marca' }, { status: 500 })
  await a.srv.from('recetas_auditoria').insert({ receta_id: id, evento: 'correccion_resuelta', issues: {}, origen: 'coach_revision' })
  return NextResponse.json({ ok: true })
}

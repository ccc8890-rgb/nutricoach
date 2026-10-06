import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { limpiarCambios } from '@/lib/contenido/validacion'
import { estadoTrasPlanos, planosTrasEstado } from '@/lib/contenido/escaleta'
import type { EstadoPieza } from '@/lib/contenido/estados'
import { SELECT_PIEZA, sincronizarIconoReceta } from '@/lib/contenido/piezas'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { id } = await params
  const v = limpiarCambios(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: actual } = await r.admin.from('piezas_contenido').select('estado, planos_hechos, receta_id')
    .eq('id', id).eq('coach_id', r.userId).maybeSingle()
  if (!actual) return NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 })

  const cambios: Record<string, unknown> = { ...v.cambios, updated_at: new Date().toISOString() }
  const c = v.cambios
  if (c.estado && c.planos_hechos === undefined) cambios.planos_hechos = planosTrasEstado(c.estado, actual.planos_hechos ?? [])
  if (c.planos_hechos && !c.estado) cambios.estado = estadoTrasPlanos(actual.estado as EstadoPieza, c.planos_hechos)

  const { data, error } = await r.admin.from('piezas_contenido').update(cambios)
    .eq('id', id).eq('coach_id', r.userId).select(SELECT_PIEZA).single()
  if (error) return NextResponse.json({ error: 'No se pudo actualizar la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, actual.receta_id)
  if (c.receta_id !== undefined && c.receta_id !== actual.receta_id) await sincronizarIconoReceta(r.admin, r.userId, c.receta_id)
  return NextResponse.json({ pieza: data })
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { id } = await params
  const { data: actual } = await r.admin.from('piezas_contenido').select('receta_id').eq('id', id).eq('coach_id', r.userId).maybeSingle()
  if (!actual) return NextResponse.json({ error: 'Pieza no encontrada' }, { status: 404 })
  const { error } = await r.admin.from('piezas_contenido').delete().eq('id', id).eq('coach_id', r.userId)
  if (error) return NextResponse.json({ error: 'No se pudo borrar la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, actual.receta_id)
  return NextResponse.json({ ok: true })
}

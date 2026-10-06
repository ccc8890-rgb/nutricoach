import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { limpiarCambios } from '@/lib/contenido/validacion'
import { planosTrasEstado } from '@/lib/contenido/escaleta'
import { buscarRecetaPorEnlace, SELECT_PIEZA, sincronizarIconoReceta } from '@/lib/contenido/piezas'

export async function GET(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const { data, error } = await r.admin.from('piezas_contenido').select(SELECT_PIEZA)
    .eq('coach_id', r.userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las piezas' }, { status: 500 })
  return NextResponse.json({ piezas: data ?? [] })
}

export async function POST(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const v = limpiarCambios(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const c = v.cambios
  if (!c.titulo) return NextResponse.json({ error: 'Falta el título' }, { status: 400 })

  const recetaId = c.receta_id ?? (c.enlace_referencia ? (await buscarRecetaPorEnlace(r.admin, c.enlace_referencia))?.id ?? null : null)
  const estado = c.estado ?? 'idea'
  const { data, error } = await r.admin.from('piezas_contenido').insert({
    coach_id: r.userId, titulo: c.titulo, enlace_referencia: c.enlace_referencia ?? null, notas: c.notas ?? null, gancho: c.gancho ?? null,
    estado, receta_id: recetaId, plan_id: c.plan_id ?? null,
    fecha_grabacion: c.fecha_grabacion ?? null, fecha_publicacion: c.fecha_publicacion ?? null,
    planos_hechos: planosTrasEstado(estado, c.planos_hechos ?? []),
  }).select(SELECT_PIEZA).single()
  if (error) return NextResponse.json({ error: 'No se pudo crear la pieza' }, { status: 500 })
  await sincronizarIconoReceta(r.admin, r.userId, recetaId)
  return NextResponse.json({ pieza: data }, { status: 201 })
}

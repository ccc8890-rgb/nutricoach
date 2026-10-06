import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { estadoIconoReceta, planificarIcono, type EstadoPieza, type IconoReceta } from '@/lib/contenido/estados'
import { planosTrasEstado } from '@/lib/contenido/escaleta'
import { sincronizarIconoReceta } from '@/lib/contenido/piezas'

const DESTINOS: IconoReceta[] = ['para_grabar', 'grabada', null]

// El icono del planificador escribe en las piezas de contenido; recetas.contenido_estado es solo su caché derivado.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error

  const { id } = await params
  const body = await request.json().catch(() => null) as { contenido_estado?: string | null } | null
  const destino = (body?.contenido_estado ?? null) as IconoReceta
  if (!DESTINOS.includes(destino)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })

  const { data: receta } = await r.admin.from('recetas').select('id, nombre').eq('id', id).maybeSingle()
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
  const { data: piezas } = await r.admin.from('piezas_contenido').select('id, estado').eq('coach_id', r.userId).eq('receta_id', id)
  const accion = planificarIcono((piezas ?? []) as { id: string; estado: EstadoPieza }[], destino)

  const ahora = new Date().toISOString()
  if (accion.crear) {
    await r.admin.from('piezas_contenido').insert({
      coach_id: r.userId, receta_id: id, titulo: receta.nombre, estado: accion.crear,
      planos_hechos: planosTrasEstado(accion.crear, []),
    })
  }
  for (const a of accion.actualizar) {
    await r.admin.from('piezas_contenido')
      .update({ estado: a.estado, planos_hechos: planosTrasEstado(a.estado, []), updated_at: ahora }).eq('id', a.id).eq('coach_id', r.userId)
  }
  if (accion.borrar.length > 0) await r.admin.from('piezas_contenido').delete().in('id', accion.borrar).eq('coach_id', r.userId)

  await sincronizarIconoReceta(r.admin, r.userId, id)
  const { data: despues } = await r.admin.from('piezas_contenido').select('estado').eq('coach_id', r.userId).eq('receta_id', id)
  return NextResponse.json({ ok: true, contenido_estado: estadoIconoReceta((despues ?? []).map(p => p.estado as EstadoPieza)) })
}

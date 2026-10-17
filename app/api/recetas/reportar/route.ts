import { NextRequest, NextResponse } from 'next/server'
import { aplicarReporte, validarReporte } from '@/lib/recetas/reportes'
import { autorizarCoachRecetas, idsValidos } from '@/lib/recetas/autorizar-coach'

export const dynamic = 'force-dynamic'

/** Reporta recetas (una o varias): las aprobadas salen del recetario (en_revision) con la marca «Corregir». */
export async function POST(req: NextRequest) {
  const a = await autorizarCoachRecetas(req)
  if ('error' in a) return a.error
  const body = await req.json().catch(() => ({}))
  const ids = idsValidos(body.ids)
  if (!ids) return NextResponse.json({ error: 'Indica entre 1 y 100 recetas' }, { status: 400 })
  const v = validarReporte({ aspectos: body.aspectos, nota: body.nota, origen: body.origen })
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })

  const { data: filas } = await a.srv.from('recetas').select('id, estado, tags, notas_coach').in('id', ids).eq('coach_id', a.coachId)
  const porId = new Map((filas ?? []).map(f => [f.id as string, f]))
  const reportadas: string[] = []
  const omitidas: { id: string; motivo: 'no_encontrada' | 'descartada' | 'error' }[] = []
  for (const id of ids) {
    const receta = porId.get(id)
    if (!receta) { omitidas.push({ id, motivo: 'no_encontrada' }); continue }
    const cambio = aplicarReporte(receta, v.reporte, new Date())
    if (!cambio) { omitidas.push({ id, motivo: 'descartada' }); continue }
    const update: Record<string, unknown> = { estado: cambio.estado, tags: cambio.tags, notas_coach: cambio.notas_coach }
    if (v.reporte.aspectos.includes('foto')) { update.imagen_estado = 'revisar'; update.imagen_needs_review = true }
    const { error } = await a.srv.from('recetas').update(update).eq('id', id)
    if (error) { omitidas.push({ id, motivo: 'error' }); continue }
    await a.srv.from('recetas_auditoria').insert({ receta_id: id, evento: 'correccion_solicitada', issues: v.reporte, origen: 'coach_revision' })
    reportadas.push(id)
  }
  return NextResponse.json({ reportadas, omitidas })
}

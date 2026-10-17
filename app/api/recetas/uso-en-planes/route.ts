import { NextRequest, NextResponse } from 'next/server'
import { contarPlanesActivos } from '@/lib/recetas/uso-en-planes'
import { autorizarCoachRecetas, idsValidos } from '@/lib/recetas/autorizar-coach'

export const dynamic = 'force-dynamic'

/** Cuántos planes activos usan cada receta (solo las del coach). */
export async function POST(req: NextRequest) {
  const a = await autorizarCoachRecetas(req)
  if ('error' in a) return a.error
  const body = await req.json().catch(() => ({}))
  const ids = idsValidos(body.ids, 200)
  if (!ids) return NextResponse.json({ error: 'Indica entre 1 y 200 recetas' }, { status: 400 })
  const { data: propias } = await a.srv.from('recetas').select('id').in('id', ids).eq('coach_id', a.coachId)
  return NextResponse.json(await contarPlanesActivos(a.srv, (propias ?? []).map(r => r.id as string)))
}

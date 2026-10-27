import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { transicionPermitida, type FaseCircuito } from '@/lib/recetas/revisor/esquema'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FASES: FaseCircuito[] = ['nueva', 'en_agente', 'segunda']

// Mueve una ficha por el circuito de revisión: pasar al agente, devolverla con una nota o volver a nuevas. Solo coach.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const hacia = body?.fase as FaseCircuito
  if (!FASES.includes(hacia)) return NextResponse.json({ error: 'Fase no válida' }, { status: 400 })

  const { data: receta } = await auth.admin.from('recetas').select('estado, fase_revision').eq('id', id).maybeSingle()
  if (!receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
  if (receta.estado !== 'en_revision') return NextResponse.json({ error: 'Solo las fichas en revisión pasan por este circuito' }, { status: 409 })

  const desde: FaseCircuito = receta.fase_revision ?? 'nueva'
  const t = transicionPermitida(desde, hacia)
  if (!t.ok || !t.evento) return NextResponse.json({ error: `No se puede pasar de «${desde}» a «${hacia}»` }, { status: 409 })
  const nota = typeof body?.nota === 'string' ? body.nota.trim().slice(0, 500) : ''
  if (t.evento === 'devuelta' && !nota) return NextResponse.json({ error: 'Al devolver una ficha al agente hay que escribir una nota' }, { status: 400 })

  const { error } = await auth.admin.from('recetas').update({ fase_revision: hacia === 'nueva' ? null : hacia }).eq('id', id)
  if (error) return NextResponse.json({ error: 'No se pudo cambiar la fase' }, { status: 500 })
  await auth.admin.from('recetas_revision_eventos').insert({ receta_id: id, tipo: t.evento, actor: 'carlos', nota: nota || null })
  return NextResponse.json({ ok: true, fase: hacia })
}

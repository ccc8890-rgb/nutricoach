import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TECNICAS = 12

// Técnicas que usa una receta o elaboración («usa»). Solo coach.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const { data: enlaces } = await auth.admin.from('receta_tecnicas').select('tecnica_id, orden').eq('receta_id', id).order('orden')
  const ids = (enlaces ?? []).map(e => e.tecnica_id as string)
  const { data } = ids.length ? await auth.admin.from('tecnicas').select('id, nombre, familia, estado').in('id', ids).neq('estado', 'descartada') : { data: [] }
  const porId = new Map((data ?? []).map(t => [t.id, t]))
  return NextResponse.json({ tecnicas: ids.map(i => porId.get(i)).filter(Boolean) })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.tecnica_ids) ? [...new Set<string>(body.tecnica_ids.filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)))] : []
  if (ids.length > MAX_TECNICAS) return NextResponse.json({ error: `Máximo ${MAX_TECNICAS} técnicas por receta` }, { status: 400 })
  if (ids.length > 0) {
    const { data: validas } = await auth.admin.from('tecnicas').select('id').in('id', ids).neq('estado', 'descartada')
    if ((validas ?? []).length !== ids.length) return NextResponse.json({ error: 'Alguna técnica no existe' }, { status: 400 })
  }
  const { error: delError } = await auth.admin.from('receta_tecnicas').delete().eq('receta_id', id)
  if (delError) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  if (ids.length > 0) {
    const { error } = await auth.admin.from('receta_tecnicas').insert(ids.map((tecnica_id, orden) => ({ receta_id: id, tecnica_id, orden })))
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

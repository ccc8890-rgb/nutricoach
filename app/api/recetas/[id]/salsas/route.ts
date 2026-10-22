import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'

const MAX_SALSAS = 4
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Salsas que combinan con una receta («Va bien con…»). Solo coach.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })

  const [{ data: enlaces }, { data: disponibles }] = await Promise.all([
    auth.admin.from('receta_salsas').select('salsa_id, orden').eq('receta_id', id).order('orden'),
    auth.admin.from('recetas').select('id, nombre, kcal').eq('estado', 'aprobada').eq('tipo_receta', 'salsa_base').neq('id', id).order('nombre'),
  ])
  const porId = new Map((disponibles ?? []).map(s => [s.id, s]))
  const vinculadas = (enlaces ?? []).map(e => porId.get(e.salsa_id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
  return NextResponse.json({ vinculadas, disponibles: disponibles ?? [] })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.salsa_ids) ? [...new Set<string>(body.salsa_ids.filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)))] : []
  if (ids.length > MAX_SALSAS) return NextResponse.json({ error: `Máximo ${MAX_SALSAS} salsas por receta` }, { status: 400 })
  if (ids.includes(id)) return NextResponse.json({ error: 'Una receta no puede ser su propia salsa' }, { status: 400 })

  if (ids.length > 0) {
    const { data: validas } = await auth.admin.from('recetas').select('id').in('id', ids).eq('estado', 'aprobada').eq('tipo_receta', 'salsa_base')
    if ((validas ?? []).length !== ids.length) return NextResponse.json({ error: 'Solo se pueden enlazar salsas aprobadas' }, { status: 400 })
  }

  const { error: delError } = await auth.admin.from('receta_salsas').delete().eq('receta_id', id)
  if (delError) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  if (ids.length > 0) {
    const { error } = await auth.admin.from('receta_salsas').insert(ids.map((salsa_id, orden) => ({ receta_id: id, salsa_id, orden })))
    if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { enlaceCreaCiclo } from '@/lib/recetas/elaboraciones-db'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validación previa al guardado: ¿se pueden enlazar estas elaboraciones dentro de la receta? Solo coach.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const body = await request.json().catch(() => null)
  const ids: string[] = Array.isArray(body?.elaboracion_ids) ? [...new Set<string>(body.elaboracion_ids.filter((x: unknown): x is string => typeof x === 'string' && UUID.test(x)))] : []
  if (ids.length === 0) return NextResponse.json({ ok: true })

  const { data: validas } = await auth.admin.from('recetas').select('id').in('id', ids).eq('tipo_receta', 'salsa_base').eq('estado', 'aprobada')
  if ((validas ?? []).length !== ids.length) return NextResponse.json({ error: 'Solo se pueden enlazar elaboraciones aprobadas' }, { status: 400 })
  if (await enlaceCreaCiclo(auth.admin, id, ids)) return NextResponse.json({ error: 'Esa elaboración ya contiene a esta receta' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

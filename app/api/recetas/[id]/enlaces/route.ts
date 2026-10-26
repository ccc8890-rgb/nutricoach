import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { enlaceCreaCiclo, nivelesAlEnlazar } from '@/lib/recetas/elaboraciones-db'

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

  // Las elaboraciones NUEVAS deben estar aprobadas; las que la receta ya llevaba pueden estar en revisión (si no, no se podría ni guardar)
  const { data: yaEnlazadas } = await auth.admin.from('receta_ingredientes').select('elaboracion_id').eq('receta_id', id).not('elaboracion_id', 'is', null)
  const previas = new Set((yaEnlazadas ?? []).map(r => r.elaboracion_id as string))
  const { data: validas } = await auth.admin.from('recetas').select('id, estado').in('id', ids).eq('tipo_receta', 'salsa_base').neq('estado', 'descartada')
  const okIds = new Set((validas ?? []).filter(v => v.estado === 'aprobada' || previas.has(v.id)).map(v => v.id))
  if (ids.some(x => !okIds.has(x))) return NextResponse.json({ error: 'Solo se pueden enlazar elaboraciones aprobadas' }, { status: 400 })
  if (await enlaceCreaCiclo(auth.admin, id, ids)) return NextResponse.json({ error: 'Esa elaboración ya contiene a esta receta' }, { status: 409 })
  if (await nivelesAlEnlazar(auth.admin, ids) > 2) return NextResponse.json({ error: 'Demasiados niveles: una elaboración dentro de otra dentro de otra no se puede calcular' }, { status: 409 })
  return NextResponse.json({ ok: true })
}

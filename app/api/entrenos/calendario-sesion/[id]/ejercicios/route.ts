import { NextRequest, NextResponse } from 'next/server'
import { autorizarSesionCoach } from '@/lib/entrenos/autorizar-sesion-coach'

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : null)
const entero = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)

/** Añade un ejercicio a la sesión. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarSesionCoach(request, id)
  if ('error' in a) return a.error
  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  if (typeof b?.ejercicio_id !== 'string') return NextResponse.json({ error: 'ejercicio_id obligatorio' }, { status: 400 })
  const { data: ej } = await a.ctx.admin.from('ejercicios').select('id').eq('id', b.ejercicio_id).maybeSingle()
  if (!ej) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 })
  const { data: ultimo } = await a.ctx.admin.from('sesion_ejercicios').select('orden').eq('sesion_id', id).order('orden', { ascending: false }).limit(1).maybeSingle()
  const { data, error } = await a.ctx.admin.from('sesion_ejercicios')
    .insert({ sesion_id: id, ejercicio_id: b.ejercicio_id, series: entero(b.series, 1, 20) ?? 3, repeticiones: texto(b.repeticiones, 20) ?? '10', orden: ((ultimo?.orden as number | null) ?? 0) + 1 })
    .select('id').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo añadir' }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

/** Edita series, repeticiones, descanso, carga, RPE o notas de un ejercicio de la sesión. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarSesionCoach(request, id)
  if ('error' in a) return a.error
  const b = await request.json().catch(() => null) as Record<string, unknown> | null
  if (typeof b?.fila_id !== 'string') return NextResponse.json({ error: 'fila_id obligatorio' }, { status: 400 })
  const cambios: Record<string, unknown> = {}
  if ('series' in b) { const v = entero(b.series, 1, 20); if (v === null) return NextResponse.json({ error: 'Series inválidas' }, { status: 400 }); cambios.series = v }
  if ('repeticiones' in b) { const v = texto(b.repeticiones, 20); if (v === null) return NextResponse.json({ error: 'Repeticiones inválidas' }, { status: 400 }); cambios.repeticiones = v }
  if ('descanso_segundos' in b) { const v = b.descanso_segundos === null ? null : entero(b.descanso_segundos, 0, 900); if (v === null && b.descanso_segundos !== null) return NextResponse.json({ error: 'Descanso inválido' }, { status: 400 }); cambios.descanso_segundos = v }
  if ('peso_sugerido' in b) { const v = b.peso_sugerido === null ? null : texto(b.peso_sugerido, 30); if (v === null && b.peso_sugerido !== null) return NextResponse.json({ error: 'Carga inválida' }, { status: 400 }); cambios.peso_sugerido = v }
  if ('rpe' in b) { const v = b.rpe === null ? null : texto(b.rpe, 20); if (v === null && b.rpe !== null) return NextResponse.json({ error: 'RPE inválido' }, { status: 400 }); cambios.rpe = v }
  if ('notas' in b) { const v = b.notas === null ? null : texto(b.notas, 500); if (v === null && b.notas !== null) return NextResponse.json({ error: 'Notas inválidas' }, { status: 400 }); cambios.notas = v }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ error: 'Nada que cambiar' }, { status: 400 })
  const { error } = await a.ctx.admin.from('sesion_ejercicios').update(cambios).eq('id', b.fila_id).eq('sesion_id', id)
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

/** Quita un ejercicio de la sesión. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarSesionCoach(request, id)
  if ('error' in a) return a.error
  const b = await request.json().catch(() => null) as { fila_id?: unknown } | null
  if (typeof b?.fila_id !== 'string') return NextResponse.json({ error: 'fila_id obligatorio' }, { status: 400 })
  const { error } = await a.ctx.admin.from('sesion_ejercicios').delete().eq('id', b.fila_id).eq('sesion_id', id)
  if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

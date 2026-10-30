import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { registrarCambioCliente } from '@/lib/entrenos/cambios-cliente'

/** Coloca una sesión en la posición de otra del mismo día; la que estaba ahí se desplaza. */
export async function POST(request: NextRequest) {
  const authDb = createApiSupabase(request)
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sesionId: string = body.sesion_id
  const destinoId: string = body.destino_id
  if (!sesionId || !destinoId || sesionId === destinoId) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin.from('clientes').select('id').eq('profile_id', user.id).single()
  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: sesion } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, plan_id, dia_semana, plan:planes_entrenamiento!inner(cliente_id)')
    .eq('id', sesionId)
    .single()

  const plan = sesion?.plan as unknown as { cliente_id: string } | null
  if (!sesion || !plan || plan.cliente_id !== clienteData.id) {
    return NextResponse.json({ error: 'Sesión no encontrada en tu plan' }, { status: 404 })
  }

  const { data: delDia } = await admin
    .from('sesiones_entrenamiento')
    .select('id, nombre, orden')
    .eq('plan_id', sesion.plan_id)
    .eq('dia_semana', sesion.dia_semana)
    .order('orden')
    .order('id')

  const lista = delDia ?? []
  const pos = lista.findIndex(x => x.id === sesionId)
  const destino = lista.findIndex(x => x.id === destinoId)
  if (pos < 0) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  if (destino < 0) {
    // Una sesión movida de fecha se ve en otro día pero en la plantilla sigue en el suyo: intercambia posiciones con la otra del mismo plan.
    const { data: otra } = await admin.from('sesiones_entrenamiento').select('id, nombre, orden').eq('id', destinoId).eq('plan_id', sesion.plan_id).maybeSingle()
    if (!otra) return NextResponse.json({ error: 'La otra sesión no es de tu plan' }, { status: 400 })
    const ordenA = (lista[pos].orden as number | null) ?? 0
    const ordenB = (otra.orden as number | null) ?? 0
    const [nuevoA, nuevoB] = ordenA === ordenB ? [ordenB + 1, ordenB] : [ordenB, ordenA]
    const [ra, rb] = await Promise.all([
      admin.from('sesiones_entrenamiento').update({ orden: nuevoA }).eq('id', sesionId),
      admin.from('sesiones_entrenamiento').update({ orden: nuevoB }).eq('id', destinoId),
    ])
    if (ra.error || rb.error) return NextResponse.json({ error: 'No se pudo cambiar el orden' }, { status: 500 })
    await registrarCambioCliente(admin, {
      clienteId: clienteData.id, planId: sesion.plan_id, tipo: 'sesion_reordenada',
      resumen: `Cambió el orden de «${lista[pos].nombre}» y «${otra.nombre}»`,
      detalle: { sesion_id: sesionId, destino_id: destinoId },
    })
    return NextResponse.json({ ok: true })
  }

  const nuevo = [...lista]
  const [movida] = nuevo.splice(pos, 1)
  nuevo.splice(destino, 0, movida)

  // Reparte las posiciones existentes; si hay empates o nulos, las separa para que el orden sea estable.
  const valores = lista.map(s => s.orden as number | null)
  const distintos = valores.every(v => v !== null) && new Set(valores).size === valores.length
  const base = Math.min(...valores.map(v => v ?? 0))
  const asignados = distintos ? [...(valores as number[])].sort((a, b) => a - b) : nuevo.map((_, i) => base + i)

  const resultados = await Promise.all(
    nuevo.map((s, i) => admin.from('sesiones_entrenamiento').update({ orden: asignados[i] }).eq('id', s.id))
  )
  if (resultados.some(r => r.error)) return NextResponse.json({ error: 'No se pudo cambiar el orden' }, { status: 500 })

  // El orden dentro del día es de la semana tipo del coach: si lo cambia el atleta, queda constancia.
  await registrarCambioCliente(admin, {
    clienteId: clienteData.id, planId: sesion.plan_id, tipo: 'sesion_reordenada',
    resumen: `Cambió el orden del ${String(sesion.dia_semana ?? '').toLowerCase()}: «${lista[pos].nombre}» ahora va ${pos < destino ? 'después' : 'antes'} de «${lista[destino].nombre}»`,
    detalle: { sesion_id: sesionId, destino_id: destinoId, dia: sesion.dia_semana },
  })
  return NextResponse.json({ ok: true })
}

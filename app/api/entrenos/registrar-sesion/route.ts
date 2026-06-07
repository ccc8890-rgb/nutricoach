import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

interface SetEjecutado {
  set_num: number
  reps?: number
  peso_kg?: number
  rpe?: number
  tiempo_s?: number
  distancia_m?: number
}

interface EjercicioRegistro {
  sesion_ejercicio_id: string
  ejercicio_id: string
  sets_ejecutados: SetEjecutado[]
}

export async function POST(request: NextRequest) {
  let body: {
    sesion_id: string
    ejercicios: EjercicioRegistro[]
    duracion_sesion_s?: number
    esfuerzo_percibido?: number
    notas?: string
    codigo?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { sesion_id, ejercicios, duracion_sesion_s, esfuerzo_percibido, notas, codigo } = body
  if (!sesion_id || !ejercicios?.length) {
    return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  let cliente_id: string | null = null

  if (codigo) {
    const { data: planPublico } = await admin
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()
    cliente_id = planPublico?.cliente_id ?? null
  } else {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { data: clienteData } = await admin
      .from('clientes')
      .select('id')
      .eq('profile_id', user.id)
      .single()
    cliente_id = clienteData?.id ?? null
  }

  if (!cliente_id) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  // Verify session belongs to this client
  const { data: sesionData } = await admin
    .from('sesiones_entrenamiento')
    .select('id, plan:planes_entrenamiento!inner(cliente_id)')
    .eq('id', sesion_id)
    .single()

  if (!sesionData) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  const sesionPlan = sesionData.plan as unknown as { cliente_id: string } | null
  if (!sesionPlan || sesionPlan.cliente_id !== cliente_id) {
    return NextResponse.json({ error: 'Sin acceso a esta sesión' }, { status: 403 })
  }

  const fecha = new Date().toISOString().split('T')[0]

  // Insert one row per exercise
  const rows = ejercicios.map(ej => ({
    cliente_id,
    sesion_ejercicio_id: ej.sesion_ejercicio_id || null,
    ejercicio_id: ej.ejercicio_id,
    fecha,
    sets_ejecutados: ej.sets_ejecutados,
    duracion_sesion_s: duracion_sesion_s ?? null,
    esfuerzo_percibido: esfuerzo_percibido ?? null,
    notas: notas ?? null,
  }))

  const { data: insertedRows, error } = await admin
    .from('registros_sets')
    .insert(rows)
    .select('id')

  if (error) {
    console.error('[registrar-sesion]', error)
    return NextResponse.json({ error: 'Error al guardar los registros' }, { status: 500 })
  }

  // Detectar PRs: comparar peso máximo de esta sesión con prs_por_ejercicio
  const ejercicioIds = ejercicios.map(e => e.ejercicio_id).filter(Boolean)
  const prs: Array<{ ejercicio_id: string; ejercicio_nombre: string; peso_anterior_kg: number | null; peso_nuevo_kg: number; reps: number }> = []

  if (ejercicioIds.length > 0) {
    const { data: prsPrevios } = await admin
      .from('prs_por_ejercicio')
      .select('ejercicio_id, peso_max_kg, reps_en_pr')
      .eq('cliente_id', cliente_id)
      .in('ejercicio_id', ejercicioIds)

    const prMap = new Map<string, { peso: number; reps: number }>(
      (prsPrevios ?? []).map(p => [p.ejercicio_id, { peso: p.peso_max_kg, reps: p.reps_en_pr }])
    )

    const { data: ejerciciosData } = await admin
      .from('ejercicios')
      .select('id, nombre')
      .in('id', ejercicioIds)

    const nombreMap = new Map<string, string>(
      (ejerciciosData ?? []).map(e => [e.id, e.nombre])
    )

    for (const ej of ejercicios) {
      if (!ej.ejercicio_id || !ej.sets_ejecutados?.length) continue

      const pesosEjercicio = ej.sets_ejecutados
        .map((s: { peso_kg?: number; reps?: number }) => ({ peso: s.peso_kg ?? 0, reps: s.reps ?? 0 }))
        .filter(s => s.peso > 0)

      if (!pesosEjercicio.length) continue

      const maxSet = pesosEjercicio.reduce((best, s) => s.peso > best.peso ? s : best, pesosEjercicio[0])
      const prPrevio = prMap.get(ej.ejercicio_id)

      if (!prPrevio || maxSet.peso > prPrevio.peso) {
        prs.push({
          ejercicio_id: ej.ejercicio_id,
          ejercicio_nombre: nombreMap.get(ej.ejercicio_id) ?? ej.ejercicio_id,
          peso_anterior_kg: prPrevio?.peso ?? null,
          peso_nuevo_kg: maxSet.peso,
          reps: maxSet.reps,
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    registros: insertedRows?.length ?? rows.length,
    fecha,
    prs,
  })
}

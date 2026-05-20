import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

type PlantillaEjercicioRow = {
  ejercicio_id: string
  series?: number | null
  repeticiones?: string | null
  descanso_segundos?: number | null
  peso_sugerido?: string | null
  carga_valor?: number | null
  notas?: string | null
  notas_tecnicas?: string | null
  orden?: number | null
}

type PlantillaSesionRow = {
  id: string
  nombre: string
  dia_semana?: string | null
  orden?: number | null
  notas?: string | null
  descripcion?: string | null
  duracion_estimada_min?: number | null
  ejercicios?: PlantillaEjercicioRow[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authSupabase = createApiSupabase(request)
    const { data: { user }, error: authError } = await authSupabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const clienteId = typeof body.cliente_id === 'string' ? body.cliente_id : ''
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : ''

    if (!clienteId || !nombre) {
      return NextResponse.json({ error: 'cliente_id y nombre son obligatorios' }, { status: 400 })
    }

    const admin = createServiceSupabase()

    const { data: plantilla, error: plantillaError } = await admin
      .from('plantillas_entrenamiento')
      .select('id, coach_id, descripcion, duracion_semanas')
      .eq('id', id)
      .single()

    if (plantillaError || !plantilla) {
      return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
    }

    if (plantilla.coach_id !== user.id) {
      return NextResponse.json({ error: 'No tienes permiso sobre esta plantilla' }, { status: 403 })
    }

    const { data: cliente } = await admin
      .from('clientes')
      .select('id, coach_id')
      .eq('id', clienteId)
      .single()

    if (!cliente || cliente.coach_id !== user.id) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    const { data: sesiones, error: sesionesError } = await admin
      .from('plantilla_sesiones')
      .select('*, ejercicios:plantilla_sesion_ejercicios(*)')
      .eq('plantilla_id', id)
      .order('orden')

    if (sesionesError) {
      return NextResponse.json({ error: 'Error al obtener sesiones de la plantilla' }, { status: 500 })
    }

    if (!sesiones?.length) {
      return NextResponse.json({ error: 'La plantilla no tiene sesiones' }, { status: 400 })
    }

    const { data: plan, error: planError } = await admin
      .from('planes_entrenamiento')
      .insert({
        coach_id: user.id,
        cliente_id: clienteId,
        nombre,
        descripcion: plantilla.descripcion ?? null,
        duracion_semanas: plantilla.duracion_semanas ?? null,
        activo: true,
      })
      .select('id')
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: planError?.message ?? 'Error al crear el plan' }, { status: 500 })
    }

    for (const sesion of sesiones as PlantillaSesionRow[]) {
      const { data: nuevaSesion, error: sesionError } = await admin
        .from('sesiones_entrenamiento')
        .insert({
          plan_id: plan.id,
          nombre: sesion.nombre,
          dia_semana: sesion.dia_semana ?? null,
          orden: sesion.orden ?? null,
          notas: sesion.notas ?? sesion.descripcion ?? null,
          duracion_estimada_min: sesion.duracion_estimada_min ?? null,
        })
        .select('id')
        .single()

      if (sesionError || !nuevaSesion) {
        await admin.from('planes_entrenamiento').delete().eq('id', plan.id)
        return NextResponse.json({ error: sesionError?.message ?? 'Error al insertar sesión' }, { status: 500 })
      }

      for (const ejercicio of sesion.ejercicios ?? []) {
        const { error: ejercicioError } = await admin
          .from('sesion_ejercicios')
          .insert({
            sesion_id: nuevaSesion.id,
            ejercicio_id: ejercicio.ejercicio_id,
            series: ejercicio.series ?? null,
            repeticiones: ejercicio.repeticiones ?? null,
            descanso_segundos: ejercicio.descanso_segundos ?? null,
            peso_sugerido: ejercicio.peso_sugerido ?? ejercicio.carga_valor?.toString() ?? null,
            notas: ejercicio.notas ?? ejercicio.notas_tecnicas ?? null,
            orden: ejercicio.orden ?? null,
          })

        if (ejercicioError) {
          await admin.from('planes_entrenamiento').delete().eq('id', plan.id)
          return NextResponse.json({ error: ejercicioError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ ok: true, plan_id: plan.id })
  } catch (error) {
    console.error('Error POST /api/plantillas-entreno/[id]/asignar:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

function todayISO() {
  return new Date().toLocaleDateString('en-CA')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params
    const body = await request.json().catch(() => ({}))
    const sesionId = typeof body.sesion_id === 'string' ? body.sesion_id : null

    if (!sesionId) {
      return NextResponse.json({ error: 'Falta sesion_id' }, { status: 400 })
    }

    const { data: planNutricion } = await supabase
      .from('planes_nutricion')
      .select('cliente_id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!planNutricion?.cliente_id) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const { data: sesion } = await supabase
      .from('sesiones_entrenamiento')
      .select('id, plan:planes_entrenamiento!inner(cliente_id)')
      .eq('id', sesionId)
      .single()

    const sesionPlan = sesion?.plan as unknown as { cliente_id: string } | null
    if (!sesionPlan || sesionPlan.cliente_id !== planNutricion.cliente_id) {
      return NextResponse.json({ error: 'Sin acceso a esta sesión' }, { status: 403 })
    }

    const { data: ejercicios } = await supabase
      .from('sesion_ejercicios')
      .select('id, ejercicio_id')
      .eq('sesion_id', sesionId)

    if (!ejercicios?.length) {
      return NextResponse.json({ error: 'La sesión no tiene ejercicios' }, { status: 400 })
    }

    const fecha = todayISO()
    const { data: existentes } = await supabase
      .from('registros_sets')
      .select('sesion_ejercicio_id')
      .eq('fecha', fecha)
      .eq('cliente_id', planNutricion.cliente_id)
      .in('sesion_ejercicio_id', ejercicios.map(e => e.id))
      .limit(1)

    if (existentes?.length) {
      return NextResponse.json({ ok: true, ya_completada: true })
    }

    const { error } = await supabase
      .from('registros_sets')
      .insert(ejercicios.map(ejercicio => ({
        cliente_id: planNutricion.cliente_id,
        sesion_ejercicio_id: ejercicio.id,
        ejercicio_id: ejercicio.ejercicio_id,
        fecha,
        sets_ejecutados: [],
      })))

    if (error) {
      console.error('[cliente completar-sesion]', error)
      return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ya_completada: false })
  } catch (error) {
    console.error('[cliente completar-sesion]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

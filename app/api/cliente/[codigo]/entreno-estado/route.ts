import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

function startOfWeek(date = new Date()) {
  const result = new Date(date)
  const day = result.getDay()
  const diff = day === 0 ? 6 : day - 1
  result.setDate(result.getDate() - diff)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function toISODate(date: Date) {
  return date.toLocaleDateString('en-CA')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const supabase = createServiceSupabase()
    const { codigo } = await params
    const { searchParams } = new URL(request.url)
    const planId = searchParams.get('plan_id')

    if (!planId) {
      return NextResponse.json({ error: 'Falta plan_id' }, { status: 400 })
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

    const { data: planEntreno } = await supabase
      .from('planes_entrenamiento')
      .select('id')
      .eq('id', planId)
      .eq('cliente_id', planNutricion.cliente_id)
      .eq('activo', true)
      .single()

    if (!planEntreno) {
      return NextResponse.json({ error: 'Plan de entrenamiento no encontrado' }, { status: 404 })
    }

    const { data: ejercicios } = await supabase
      .from('sesion_ejercicios')
      .select('id, sesion_id')
      .in('sesion_id', (
        await supabase
          .from('sesiones_entrenamiento')
          .select('id')
          .eq('plan_id', planId)
      ).data?.map(s => s.id) ?? [])
      .limit(500)

    if (!ejercicios?.length) {
      return NextResponse.json({ completadas: [] })
    }

    const weekStart = startOfWeek()
    const weekEnd = addDays(weekStart, 6)
    const { data: registros } = await supabase
      .from('registros_sets')
      .select('sesion_ejercicio_id')
      .eq('cliente_id', planNutricion.cliente_id)
      .gte('fecha', toISODate(weekStart))
      .lte('fecha', toISODate(weekEnd))
      .in('sesion_ejercicio_id', ejercicios.map(e => e.id))
      .limit(1000)

    const ejerciciosConRegistro = new Set(registros?.map(r => r.sesion_ejercicio_id) ?? [])
    const completadas = new Set<string>()
    for (const ejercicio of ejercicios) {
      if (ejerciciosConRegistro.has(ejercicio.id)) completadas.add(ejercicio.sesion_id)
    }

    return NextResponse.json({ completadas: Array.from(completadas) })
  } catch (error) {
    console.error('[cliente entreno-estado]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

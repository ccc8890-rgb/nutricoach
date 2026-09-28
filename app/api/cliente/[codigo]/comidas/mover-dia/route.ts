import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const DIAS_VALIDOS = new Set(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params
    const body = await request.json().catch(() => ({}))
    const comidaId: string = body.comida_id
    const diaSemana: string = body.dia_semana

    if (!comidaId || !DIAS_VALIDOS.has(diaSemana)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    const admin = createServiceSupabase()

    const { data: plan } = await admin
      .from('planes_nutricion')
      .select('id')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    const { data: comida } = await admin
      .from('comidas')
      .select('id, plan_id, dia_semana')
      .eq('id', comidaId)
      .single()

    if (!comida || comida.plan_id !== plan.id) {
      return NextResponse.json({ error: 'Comida no encontrada en este plan' }, { status: 404 })
    }

    if (comida.dia_semana == null) {
      return NextResponse.json({ error: 'Esta comida se repite todos los días. Actívala por día primero.' }, { status: 409 })
    }

    const { error } = await admin.from('comidas').update({ dia_semana: diaSemana }).eq('id', comidaId)
    if (error) return NextResponse.json({ error: 'No se pudo mover la comida' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[comidas/mover-dia] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

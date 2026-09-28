import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarEscrituraPlan } from '@/lib/cliente/autorizar-escritura-plan'

const DIAS_VALIDOS = new Set(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params

    const auth = await autorizarEscrituraPlan(request, codigo)
    if (auth instanceof NextResponse) return auth
    const planId = auth.planId

    const body = await request.json().catch(() => ({}))
    const comidaId: string = body.comida_id
    const diaSemana: string = body.dia_semana

    if (!comidaId || !DIAS_VALIDOS.has(diaSemana)) {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
    }

    const admin = createServiceSupabase()

    const { data: comida } = await admin
      .from('comidas')
      .select('id, plan_id, dia_semana')
      .eq('id', comidaId)
      .single()

    if (!comida || comida.plan_id !== planId) {
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

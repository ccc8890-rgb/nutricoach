import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ comidaId: string }> }
) {
  const { comidaId } = await params
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { receta_id?: string } | null
  if (!body?.receta_id) {
    return NextResponse.json({ error: 'receta_id requerido' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const { data: comida } = await db
    .from('comidas')
    .select('id, nombre, plan_id, kcal_target, plan:planes_nutricion(id, cliente_id, coach_id)')
    .eq('id', comidaId)
    .single()

  const plan = Array.isArray(comida?.plan) ? comida?.plan[0] : comida?.plan
  if (!comida || !plan) return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const resultado = await aplicarRecetaAComida(db, {
      comidaId,
      recetaId: body.receta_id,
      clienteId: plan.cliente_id,
      planId: plan.id,
      comidaSlot: comida.nombre,
      targetKcal: comida.kcal_target,
      tipoInteraccion: 'swap_elegida',
      reemplazar: true,
    })
    return NextResponse.json(resultado)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al aplicar receta' },
      { status: 500 }
    )
  }
}

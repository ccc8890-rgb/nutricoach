import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { inferirSlotComida, tipoPlatoCompatibleConSlot } from '@/lib/tipos-comida'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ comidaId: string }> }
) {
  const { comidaId } = await params
  const auth = createApiSupabase(request)
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json().catch(() => null) as { alternativa_ids?: string[] } | null
  const alternativaIds = [...new Set((body?.alternativa_ids ?? []).filter(Boolean))].slice(0, 3)

  const db = createServiceSupabase()
  const { data: comida } = await db
    .from('comidas')
    .select('id, nombre, receta_id, plan:planes_nutricion(id, coach_id)')
    .eq('id', comidaId)
    .single()

  const plan = Array.isArray(comida?.plan) ? comida?.plan[0] : comida?.plan
  if (!comida || !plan) return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })
  if (plan.coach_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const idsLimpios = alternativaIds.filter(id => id !== comida.receta_id)
  if (idsLimpios.length > 0) {
    const slot = inferirSlotComida(comida.nombre)
    const { data: recetas, error: recetasError } = await db
      .from('recetas')
      .select('id, tipo_plato')
      .eq('estado', 'aprobada')
      .in('id', idsLimpios)
    if (recetasError) return NextResponse.json({ error: recetasError.message }, { status: 400 })

    const aprobadas = new Set((recetas ?? []).map(r => r.id))
    const invalidas = idsLimpios.filter(id => !aprobadas.has(id))
    if (invalidas.length > 0) {
      return NextResponse.json({ error: 'Alguna alternativa no existe o no está aprobada' }, { status: 400 })
    }

    const incompatibles = (recetas ?? []).filter(r => !tipoPlatoCompatibleConSlot(slot, r.tipo_plato))
    if (incompatibles.length > 0) {
      return NextResponse.json({ error: 'Alguna alternativa no encaja con ese momento de comida' }, { status: 400 })
    }
  }

  const { data, error } = await db
    .from('comidas')
    .update({ alternativas_receta_ids: idsLimpios })
    .eq('id', comidaId)
    .select('id, alternativas_receta_ids')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ comida: data })
}

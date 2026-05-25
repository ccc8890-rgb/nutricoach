import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string; comidaId: string }> }
) {
  const { codigo, comidaId } = await params
  const body = await request.json().catch(() => null) as { receta_id?: string } | null
  if (!body?.receta_id) {
    return NextResponse.json({ error: 'receta_id requerido' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { data: comida } = await db
    .from('comidas')
    .select('id, nombre, kcal_target')
    .eq('id', comidaId)
    .eq('plan_id', plan.id)
    .single()

  if (!comida) return NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 })

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

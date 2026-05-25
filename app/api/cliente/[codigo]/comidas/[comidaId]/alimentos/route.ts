import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

type Params = Promise<{ codigo: string; comidaId: string }>

async function validarComida(codigo: string, comidaId: string) {
  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return { db, error: NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 }) }

  const { data: comida } = await db
    .from('comidas')
    .select('id')
    .eq('id', comidaId)
    .eq('plan_id', plan.id)
    .single()

  if (!comida) return { db, error: NextResponse.json({ error: 'Comida no encontrada' }, { status: 404 }) }
  return { db, plan, comida, error: null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { codigo, comidaId } = await params
  const body = await request.json().catch(() => null) as {
    alimento_id?: string
    cantidad_gramos?: number
  } | null

  if (!body?.alimento_id || !Number.isFinite(body.cantidad_gramos) || Number(body.cantidad_gramos) <= 0) {
    return NextResponse.json({ error: 'alimento_id y cantidad_gramos válidos son requeridos' }, { status: 400 })
  }

  const ctx = await validarComida(codigo, comidaId)
  if (ctx.error) return ctx.error

  const { data: alimento } = await ctx.db
    .from('alimentos')
    .select('id')
    .eq('id', body.alimento_id)
    .eq('es_comestible', true)
    .single()

  if (!alimento) return NextResponse.json({ error: 'Alimento no encontrado' }, { status: 404 })

  const { data, error } = await ctx.db
    .from('comida_alimentos')
    .insert({
      comida_id: comidaId,
      alimento_id: body.alimento_id,
      cantidad_gramos: Math.round(Number(body.cantidad_gramos)),
    })
    .select('id, alimento_id, cantidad_gramos, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, fibra)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await ctx.db
    .from('comidas')
    .update({ receta_id: null })
    .eq('id', comidaId)

  return NextResponse.json({ alimento: data })
}

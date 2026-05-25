import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

type Params = Promise<{ codigo: string; comidaId: string; itemId: string }>

async function validarItem(codigo: string, comidaId: string, itemId: string) {
  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return { db, error: NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 }) }

  const { data: item } = await db
    .from('comida_alimentos')
    .select('id, comida:comidas(id, plan_id)')
    .eq('id', itemId)
    .eq('comida_id', comidaId)
    .single()

  const comida = Array.isArray(item?.comida) ? item?.comida[0] : item?.comida
  if (!item || !comida || comida.plan_id !== plan.id) {
    return { db, error: NextResponse.json({ error: 'Ingrediente no encontrado' }, { status: 404 }) }
  }

  return { db, plan, item, error: null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Params }
) {
  const { codigo, comidaId, itemId } = await params
  const body = await request.json().catch(() => null) as {
    alimento_id?: string
    cantidad_gramos?: number
  } | null

  if (!body?.alimento_id || !Number.isFinite(body.cantidad_gramos) || Number(body.cantidad_gramos) <= 0) {
    return NextResponse.json({ error: 'alimento_id y cantidad_gramos válidos son requeridos' }, { status: 400 })
  }

  const ctx = await validarItem(codigo, comidaId, itemId)
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
    .update({
      alimento_id: body.alimento_id,
      cantidad_gramos: Math.round(Number(body.cantidad_gramos)),
    })
    .eq('id', itemId)
    .eq('comida_id', comidaId)
    .select('id, alimento_id, cantidad_gramos, alimento:alimentos(nombre, calorias, proteinas, carbohidratos, grasas, fibra)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await ctx.db
    .from('comidas')
    .update({ receta_id: null })
    .eq('id', comidaId)

  return NextResponse.json({ alimento: data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  const { codigo, comidaId, itemId } = await params
  const ctx = await validarItem(codigo, comidaId, itemId)
  if (ctx.error) return ctx.error

  const { error } = await ctx.db
    .from('comida_alimentos')
    .delete()
    .eq('id', itemId)
    .eq('comida_id', comidaId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await ctx.db
    .from('comidas')
    .update({ receta_id: null })
    .eq('id', comidaId)

  return NextResponse.json({ ok: true })
}

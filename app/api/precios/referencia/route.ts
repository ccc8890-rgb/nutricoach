import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { SUPERMERCADO_REFERENCIA } from '@/lib/precios-referencia'

async function ensureSupermercado(srv: ReturnType<typeof createServiceSupabase>) {
  const { data: existing, error: selectError } = await srv
    .from('supermercados')
    .select('id')
    .eq('slug', SUPERMERCADO_REFERENCIA.slug)
    .maybeSingle()
  if (selectError) throw selectError

  if (existing) {
    const { error } = await srv.from('supermercados').update(SUPERMERCADO_REFERENCIA).eq('id', existing.id)
    if (error) throw error
    return
  }

  const { error } = await srv.from('supermercados').insert(SUPERMERCADO_REFERENCIA)
  if (error) throw error
}

export async function POST(request: NextRequest) {
  try {
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json()
    const alimentoId = String(body.alimento_id || '')
    const precioPorKg = Number(body.precio_por_kg)
    if (!alimentoId || !Number.isFinite(precioPorKg) || precioPorKg <= 0) {
      return NextResponse.json({ error: 'alimento_id y precio_por_kg válido son obligatorios' }, { status: 400 })
    }

    const srv = createServiceSupabase()
    await ensureSupermercado(srv)

    const { data: alimento, error: alimentoError } = await srv
      .from('alimentos')
      .select('id, nombre')
      .eq('id', alimentoId)
      .single()
    if (alimentoError || !alimento) return NextResponse.json({ error: 'Alimento no encontrado' }, { status: 404 })

    const payload = {
      supermercado_id: SUPERMERCADO_REFERENCIA.id,
      alimento_id: alimentoId,
      precio_por_kg: Math.round(precioPorKg * 100) / 100,
      precio_unidad: null,
      unidad: 'kg',
      url_producto: `referencia://coach/${alimentoId}`,
      nombre_original: alimento.nombre,
      marca: 'Referencia coach',
      preferido: true,
      notas: `Precio referencia ajustado manualmente por coach. Fecha: ${new Date().toISOString().slice(0, 10)}.`,
      fecha_precio: new Date().toISOString().slice(0, 10),
    }

    const { data: existing, error: selectError } = await srv
      .from('productos_supermercado')
      .select('id')
      .eq('supermercado_id', SUPERMERCADO_REFERENCIA.id)
      .eq('url_producto', payload.url_producto)
      .maybeSingle()
    if (selectError) throw selectError

    const result = existing
      ? await srv.from('productos_supermercado').update(payload).eq('id', existing.id).select('id').single()
      : await srv.from('productos_supermercado').insert(payload).select('id').single()

    if (result.error) throw result.error
    return NextResponse.json({ ok: true, producto_id: result.data?.id, precio_por_kg: payload.precio_por_kg })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[API precios/referencia]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


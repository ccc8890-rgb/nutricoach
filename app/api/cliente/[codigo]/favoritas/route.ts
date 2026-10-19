import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Favoritas del cliente: lista con lo justo para pintar la tarjeta. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  const supabase = createServiceSupabase()
  const { data: favs, error } = await supabase
    .from('recetas_favoritas_cliente')
    .select('receta_id, created_at')
    .eq('cliente_id', auth.clienteId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'No se pudieron cargar las favoritas' }, { status: 500 })
  const ids = (favs ?? []).map(f => f.receta_id)
  if (ids.length === 0) return NextResponse.json({ ids: [], recetas: [] })
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, kcal, proteinas, categoria')
    .in('id', ids)
    .eq('estado', 'aprobada')
  const porId = new Map((recetas ?? []).map(r => [r.id, r]))
  // Orden: la última añadida primero
  const lista = ids.map(id => porId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r))
  return NextResponse.json({ ids: lista.map(r => r.id), recetas: lista })
}

async function leerId(request: NextRequest): Promise<string | null> {
  const body = await request.json().catch(() => null) as { receta_id?: unknown } | null
  return typeof body?.receta_id === 'string' && UUID.test(body.receta_id) ? body.receta_id : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  const recetaId = await leerId(request)
  if (!recetaId) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const supabase = createServiceSupabase()
  const { data: receta } = await supabase.from('recetas').select('id').eq('id', recetaId).eq('estado', 'aprobada').maybeSingle()
  if (!receta) return NextResponse.json({ error: 'Receta no disponible' }, { status: 404 })
  const { error } = await supabase
    .from('recetas_favoritas_cliente')
    .upsert({ cliente_id: auth.clienteId, receta_id: recetaId }, { onConflict: 'cliente_id,receta_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  const recetaId = await leerId(request)
  if (!recetaId) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  const { error } = await createServiceSupabase()
    .from('recetas_favoritas_cliente')
    .delete()
    .eq('cliente_id', auth.clienteId)
    .eq('receta_id', recetaId)
  if (error) return NextResponse.json({ error: 'No se pudo quitar' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const ESTADOS = ['pendiente', 'aprobado', 'devuelto']

/** Bandeja del coach: platos enviados por SUS clientes. Nunca incluye borradores. `?estado=` y `?cliente_id=` filtran. */
export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const db = createServiceSupabase()
  try {
    const { data: perfil } = await db.from('profiles').select('role').eq('id', user.id).single()
    if (perfil?.role !== 'coach') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const url = new URL(request.url)
    const estado = url.searchParams.get('estado')
    const clienteId = url.searchParams.get('cliente_id')
    const { data: clientes } = await db.from('clientes').select('id, nombre').eq('coach_id', user.id)
    const propios = new Map((clientes ?? []).map(c => [c.id as string, c.nombre as string]))
    const ids = clienteId ? [...propios.keys()].filter(id => id === clienteId) : [...propios.keys()]
    if (ids.length === 0) return NextResponse.json({ platos: [], contadores: { pendiente: 0 } })

    const { data } = await db.from('platos_cliente')
      .select('id, cliente_id, nombre, tipo_comida, estado, foto_original_url, foto_limpia_url, kcal, proteinas, carbohidratos, grasas, incompleto, estimado, nota_cliente, nota_coach, updated_at')
      .in('cliente_id', ids).in('estado', estado && ESTADOS.includes(estado) ? [estado] : ESTADOS).order('updated_at', { ascending: false }).limit(200)
    const { count } = await db.from('platos_cliente').select('id', { count: 'exact', head: true }).in('cliente_id', ids).eq('estado', 'pendiente')
    return NextResponse.json({
      platos: (data ?? []).map(p => ({ ...p, cliente_nombre: propios.get(p.cliente_id) ?? '' })),
      contadores: { pendiente: count ?? 0 },
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar la bandeja' }, { status: 500 })
  }
}

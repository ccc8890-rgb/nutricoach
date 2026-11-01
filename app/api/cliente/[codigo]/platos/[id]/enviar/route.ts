import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { transicionPermitida } from '@/lib/platos/estado'
import { cargarLineas, cargarPlatoDeCliente } from '@/lib/platos/guardar'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Envía el plato al coach (borrador/devuelto → pendiente). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ codigo: string; id: string }> }) {
  const { codigo, id } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!auth.esCliente) return NextResponse.json({ error: 'Solo el propio cliente puede enviar sus platos' }, { status: 403 })
  const db = createServiceSupabase()
  const plato = UUID.test(id) ? await cargarPlatoDeCliente(db, auth.clienteId, id) : null
  if (!plato) return NextResponse.json({ error: 'Plato no encontrado' }, { status: 404 })
  if (plato.estado === 'pendiente') return NextResponse.json({ plato })
  if (!transicionPermitida(plato.estado, 'pendiente', 'cliente')) return NextResponse.json({ error: 'Este plato no se puede enviar' }, { status: 409 })
  if (!plato.nombre.trim()) return NextResponse.json({ error: 'Ponle un nombre al plato' }, { status: 400 })
  if ((await cargarLineas(db, id)).length === 0) return NextResponse.json({ error: 'Añade al menos un ingrediente' }, { status: 400 })

  const { error } = await db.from('platos_cliente').update({ estado: 'pendiente', nota_coach: null, updated_at: new Date().toISOString() }).eq('id', id).eq('cliente_id', auth.clienteId)
  if (error) return NextResponse.json({ error: 'No se pudo enviar el plato' }, { status: 500 })
  return NextResponse.json({ plato: await cargarPlatoDeCliente(db, auth.clienteId, id) })
}

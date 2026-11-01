import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { construirVista, validarEdicion } from '@/lib/platos/entrada'
import { cargarLineas, cargarPlatoDeCliente, alimentosCache, guardarLineas } from '@/lib/platos/guardar'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NO_ENCONTRADO = () => NextResponse.json({ error: 'Plato no encontrado' }, { status: 404 })

type Ctx = { params: Promise<{ codigo: string; id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { codigo, id } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!UUID.test(id)) return NO_ENCONTRADO()
  const db = createServiceSupabase()
  const plato = await cargarPlatoDeCliente(db, auth.clienteId, id)
  // Un coach no ve borradores del cliente
  if (!plato || (!auth.esCliente && plato.estado === 'borrador')) return NO_ENCONTRADO()
  return NextResponse.json({ plato, lineas: await cargarLineas(db, id) })
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { codigo, id } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!auth.esCliente) return NextResponse.json({ error: 'Solo el propio cliente puede editar sus platos' }, { status: 403 })
  if (!UUID.test(id)) return NO_ENCONTRADO()
  const db = createServiceSupabase()
  const plato = await cargarPlatoDeCliente(db, auth.clienteId, id)
  if (!plato) return NO_ENCONTRADO()

  const v = validarEdicion(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  const e = v.valor

  try {
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (e.nombre !== undefined) cambios.nombre = e.nombre
    if (e.tipo_comida !== undefined) cambios.tipo_comida = e.tipo_comida
    if (e.porciones !== undefined) cambios.porciones = e.porciones
    if (e.pasos !== undefined) cambios.pasos = e.pasos
    if (e.nota_cliente !== undefined) cambios.nota_cliente = e.nota_cliente

    // Editar un plato aprobado lo devuelve a revisión, pero el recetario sigue enseñando lo aprobado (snapshot)
    if (plato.estado === 'aprobado') {
      const lineas = await cargarLineas(db, id)
      if (!plato.aprobado_snapshot) cambios.aprobado_snapshot = construirVista(plato, lineas)
      cambios.estado = 'pendiente'
      cambios.estimado = true
    }
    await db.from('platos_cliente').update(cambios).eq('id', id).eq('cliente_id', auth.clienteId)
    if (e.lineas) await guardarLineas(db, auth.clienteId, id, e.lineas, await alimentosCache(db))

    const actualizado = await cargarPlatoDeCliente(db, auth.clienteId, id)
    return NextResponse.json({ plato: actualizado, lineas: await cargarLineas(db, id) })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el plato' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { codigo, id } = await params
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  if (!auth.esCliente) return NextResponse.json({ error: 'Solo el propio cliente puede borrar sus platos' }, { status: 403 })
  if (!UUID.test(id)) return NO_ENCONTRADO()
  const db = createServiceSupabase()
  const plato = await cargarPlatoDeCliente(db, auth.clienteId, id)
  if (!plato) return NO_ENCONTRADO()
  if (plato.estado !== 'borrador' && plato.estado !== 'devuelto') return NextResponse.json({ error: 'Solo se pueden borrar borradores o platos devueltos' }, { status: 409 })
  if (plato.aprobado_snapshot) return NextResponse.json({ error: 'Este plato ya fue aprobado por tu coach y puede estar en tu dieta: corrígelo y vuelve a enviarlo en lugar de borrarlo' }, { status: 409 })
  await db.from('platos_cliente').delete().eq('id', id).eq('cliente_id', auth.clienteId)
  return NextResponse.json({ ok: true })
}

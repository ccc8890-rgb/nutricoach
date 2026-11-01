import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachPlato } from '@/lib/platos/autorizar-coach'
import { validarEdicion } from '@/lib/platos/entrada'
import { alimentosCache, cargarLineas, guardarLineas } from '@/lib/platos/guardar'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const a = await autorizarCoachPlato(request, id)
  if (a instanceof NextResponse) return a
  return NextResponse.json({ plato: a.plato, lineas: await cargarLineas(a.db, id) })
}

/** El coach corrige gramos, quita líneas o enlaza una línea a un alimento concreto (`alimento_id`). Solo platos pendientes. */
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const a = await autorizarCoachPlato(request, id)
  if (a instanceof NextResponse) return a
  if (a.plato.estado !== 'pendiente') return NextResponse.json({ error: 'Solo se pueden corregir platos pendientes de revisión' }, { status: 409 })
  const v = validarEdicion(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  try {
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (v.valor.nombre !== undefined) cambios.nombre = v.valor.nombre
    if (v.valor.porciones !== undefined) cambios.porciones = v.valor.porciones
    if (v.valor.pasos !== undefined) cambios.pasos = v.valor.pasos
    await a.db.from('platos_cliente').update(cambios).eq('id', id).eq('cliente_id', a.plato.cliente_id)
    if (v.valor.lineas) {
      // El coach puede elegir cualquier alimento del catálogo: se valida que existe antes de aceptarlo
      const ids = [...new Set(v.valor.lineas.map(l => l.alimento_id).filter((x): x is string => !!x))]
      if (ids.length) {
        const { data: existen } = await a.db.from('alimentos').select('id').in('id', ids)
        if ((existen ?? []).length !== ids.length) return NextResponse.json({ error: 'Alguno de los alimentos elegidos no existe' }, { status: 400 })
      }
      await guardarLineas(a.db, a.plato.cliente_id, id, v.valor.lineas, await alimentosCache(a.db), ids)
    }
    return NextResponse.json({ ok: true, lineas: await cargarLineas(a.db, id) })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la corrección' }, { status: 500 })
  }
}

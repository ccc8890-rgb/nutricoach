import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachPlato } from '@/lib/platos/autorizar-coach'
import { validarRevision } from '@/lib/platos/dieta'
import { construirVista } from '@/lib/platos/entrada'
import { puedeAprobar, transicionPermitida } from '@/lib/platos/estado'
import { cargarLineas } from '@/lib/platos/guardar'

/** Aprobar o devolver (con nota) un plato pendiente. Aprobar exige todas las líneas enlazadas y congela la versión aprobada (snapshot). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarCoachPlato(request, id)
  if (a instanceof NextResponse) return a
  const v = validarRevision(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })

  const destino = v.valor.accion === 'aprobar' ? 'aprobado' : 'devuelto'
  if (!transicionPermitida(a.plato.estado, destino, 'coach')) return NextResponse.json({ error: 'Este plato no está pendiente de revisión' }, { status: 409 })

  try {
    if (v.valor.accion === 'aprobar') {
      const lineas = await cargarLineas(a.db, id)
      const ok = puedeAprobar({ lineas })
      if (!ok.ok) return NextResponse.json({ error: ok.motivo }, { status: 409 })
      const vista = construirVista({ ...a.plato, estimado: false }, lineas)
      await a.db.from('platos_cliente')
        .update({ estado: 'aprobado', estimado: false, nota_coach: null, aprobado_snapshot: vista, aprobado_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', id).eq('cliente_id', a.plato.cliente_id)
    } else {
      await a.db.from('platos_cliente')
        .update({ estado: 'devuelto', nota_coach: v.valor.nota, updated_at: new Date().toISOString() })
        .eq('id', id).eq('cliente_id', a.plato.cliente_id)
    }
    return NextResponse.json({ ok: true, estado: destino })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la revisión' }, { status: 500 })
  }
}

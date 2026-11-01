import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachPlato } from '@/lib/platos/autorizar-coach'
import { validarEntradaDieta } from '@/lib/platos/dieta'
import { anadirPlatoADieta, ErrorPlatoDieta } from '@/lib/platos/anadir-a-dieta'

/** Añade un plato aprobado a la dieta activa del cliente (día, franja y raciones). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const a = await autorizarCoachPlato(request, id)
  if (a instanceof NextResponse) return a
  const v = validarEntradaDieta(await request.json().catch(() => null))
  if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 })
  try {
    const r = await anadirPlatoADieta(a.db, { platoId: id, ...v.valor })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    if (e instanceof ErrorPlatoDieta) return NextResponse.json({ error: e.message }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo añadir el plato a la dieta' }, { status: 500 })
  }
}

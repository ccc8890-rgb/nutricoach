import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { asignarFutura, obtenerFuturas, quitarFutura, vaciarFutura, MAX_SEMANAS } from '@/lib/nutricion/semanas-futuras'

type Params = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ semanas: [] })
  const n = Math.min(Math.max(Number(new URL(request.url).searchParams.get('semanas')) || 1, 1), MAX_SEMANAS)
  try {
    return NextResponse.json({ semanas: await obtenerFuturas(r.admin, r.plan, n) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { semana?: number; dia?: string; franja?: string; receta_id?: string } | null
  if (!b?.semana || !b.dia || !b.franja || !b.receta_id) return NextResponse.json({ error: 'Faltan semana, día, franja o receta' }, { status: 400 })
  try {
    await asignarFutura(r.admin, r.plan.id, { semana: b.semana, dia: b.dia, franja: b.franja, receta_id: b.receta_id })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 })
  }
}

// ?id=<fila> quita una comida; ?semana=<n> vacía la semana entera
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const q = new URL(request.url).searchParams
  try {
    if (q.get('id')) await quitarFutura(r.admin, r.plan.id, q.get('id')!)
    else if (Number(q.get('semana'))) await vaciarFutura(r.admin, r.plan.id, Number(q.get('semana')))
    else return NextResponse.json({ error: 'Falta id o semana' }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

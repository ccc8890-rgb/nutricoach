import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { anadirComplemento, moverComplemento, quitarComplemento } from '@/lib/nutricion/complementos'

export const maxDuration = 60

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { dia?: string; franja?: string; alimento_id?: string; gramos?: number; receta_id?: string; ajustar?: boolean } | null
  if (!b?.dia || !b.franja) return NextResponse.json({ error: 'Faltan día o franja' }, { status: 400 })
  try {
    await anadirComplemento(r.admin, r.plan, id, { dia: b.dia, franja: b.franja, alimento_id: b.alimento_id, gramos: b.gramos, receta_id: b.receta_id, ajustar: b.ajustar })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo añadir' }, { status: 400 })
  }
}

// ?comida_id=<id>&fila=<id de fila> quita un alimento; &receta=<id> quita un postre entero
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const q = new URL(request.url).searchParams
  if (!q.get('comida_id')) return NextResponse.json({ error: 'Falta la comida' }, { status: 400 })
  try {
    await quitarComplemento(r.admin, r.plan, id, { comida_id: q.get('comida_id')!, fila: q.get('fila') ?? undefined, receta: q.get('receta') ?? undefined })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo quitar' }, { status: 400 })
  }
}

// { comida_id, fila | receta, franja_destino }: mueve un complemento a otra comida del mismo día
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { comida_id?: string; fila?: string; receta?: string; franja_destino?: string; ajustar?: boolean } | null
  if (!b?.comida_id || !b.franja_destino) return NextResponse.json({ error: 'Faltan comida o franja de destino' }, { status: 400 })
  try {
    await moverComplemento(r.admin, r.plan, id, { comida_id: b.comida_id, fila: b.fila, receta: b.receta, franja_destino: b.franja_destino, ajustar: b.ajustar })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo mover' }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { copiarActualAFutura } from '@/lib/nutricion/semanas-futuras'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { semana?: number } | null
  if (!b?.semana) return NextResponse.json({ error: 'Falta la semana' }, { status: 400 })
  try {
    return NextResponse.json({ ok: true, ...(await copiarActualAFutura(r.admin, r.plan, b.semana)) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo copiar' }, { status: 400 })
  }
}

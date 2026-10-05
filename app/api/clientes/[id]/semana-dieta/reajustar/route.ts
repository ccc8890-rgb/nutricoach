import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { reajustarSemana } from '@/lib/nutricion/planificar-semana'

export const maxDuration = 120

// Recalcula las cantidades de la semana en curso con el objetivo de cada día según su entrenamiento
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const r = await autorizarSemanaDieta(request, clienteId)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  try {
    return NextResponse.json({ ok: true, ...(await reajustarSemana(r.admin, clienteId, r.plan)) })
  } catch (e) {
    console.error('[semana-dieta/reajustar]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo reajustar la semana' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta, FRANJAS } from '@/lib/nutricion/semana-dieta'
import { generarFutura } from '@/lib/nutricion/semanas-futuras'

export const maxDuration = 120

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { semana?: number; franjas?: string[]; reemplazar?: boolean } | null
  if (!b?.semana) return NextResponse.json({ error: 'Falta la semana' }, { status: 400 })
  try {
    const res = await generarFutura(r.admin, id, r.plan, { semana: b.semana, franjas: FRANJAS.filter(f => b.franjas?.includes(f)), reemplazar: b.reemplazar === true })
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar la semana' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { activarProximaSemana } from '@/lib/nutricion/semanas-futuras'

export const maxDuration = 120

// Convierte la próxima semana planificada en la semana en curso del cliente
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  try {
    return NextResponse.json(await activarProximaSemana(r.admin, id, r.plan))
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo activar la semana' }, { status: 400 })
  }
}

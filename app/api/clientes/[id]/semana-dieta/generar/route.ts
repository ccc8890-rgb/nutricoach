import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta, FRANJAS } from '@/lib/nutricion/semana-dieta'
import { generarSemana } from '@/lib/nutricion/planificar-semana'

export const maxDuration = 120

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const r = await autorizarSemanaDieta(request, clienteId)
  if ('error' in r) return r.error
  const { admin, plan } = r
  if (!plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })

  const body = await request.json().catch(() => null) as { reemplazar?: boolean; franjas?: string[] } | null
  try {
    return NextResponse.json(await generarSemana(admin, clienteId, plan, body?.reemplazar === true, FRANJAS.filter(f => body?.franjas?.includes(f))))
  } catch (e) {
    console.error('[semana-dieta/generar]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar la semana' }, { status: 500 })
  }
}

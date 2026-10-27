import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { revisarPendientes } from '@/lib/recetas/revisor/revisar'

export const maxDuration = 120

// «Revisar ahora»: el agente revisa un lote pequeño de fichas que están con él. Gasta saldo de IA. Solo coach.
export async function POST(request: NextRequest) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  try {
    const resumen = await revisarPendientes(auth.admin, { limite: 5, hastaMs: Date.now() + 90_000 })
    return NextResponse.json(resumen)
  } catch (e) {
    console.error('[revisor/ahora]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'No se pudo completar la revisión' }, { status: 500 })
  }
}

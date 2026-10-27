import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { registrarCron } from '@/lib/sistema/registrar-cron'
import { revisarPendientes } from '@/lib/recetas/revisor/revisar'

export const maxDuration = 300

function autorizado(req: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === secreto
  return req.headers.get('x-cron-secret') === secreto
}

/** Cada día: el agente revisa las fichas que Carlos ha pasado al agente (con tope de fichas y de tokens). */
export async function GET(req: NextRequest) {
  if (!autorizado(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const db = createServiceSupabase()
  try {
    const r = await revisarPendientes(db, { hastaMs: Date.now() + 240_000 })
    await registrarCron(db, 'revisor-recetas', r.invalidas, `${r.revisadas} revisadas, ${r.omitidas} sin cambios, ${r.invalidas} inválidas, ${r.tokens} tokens${r.paradoPorPresupuesto ? ' (tope diario)' : ''}`)
    return NextResponse.json(r)
  } catch (e) {
    console.error('[revisor-recetas]', e instanceof Error ? e.message : e)
    await registrarCron(db, 'revisor-recetas', 1, 'fallo al revisar')
    return NextResponse.json({ error: 'No se pudo completar la revisión' }, { status: 500 })
  }
}

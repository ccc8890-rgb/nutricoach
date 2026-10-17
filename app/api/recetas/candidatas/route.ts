import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoachRecetas } from '@/lib/recetas/autorizar-coach'
import { seleccionarCandidatas } from '@/lib/recetas/candidatas'

export const dynamic = 'force-dynamic'

/** Recetas aprobadas que el control de calidad sugiere revisar. Solo lectura: no reporta nada. */
export async function GET(req: NextRequest) {
  const a = await autorizarCoachRecetas(req)
  if ('error' in a) return a.error
  const { data, error } = await a.srv.from('recetas').select('id, nombre, estado, score_calidad, quality_issues').eq('coach_id', a.coachId).eq('estado', 'aprobada').limit(2000)
  if (error) return NextResponse.json({ error: 'No se pudieron leer las recetas' }, { status: 500 })
  return NextResponse.json({ data: seleccionarCandidatas((data ?? []) as Parameters<typeof seleccionarCandidatas>[0]) })
}

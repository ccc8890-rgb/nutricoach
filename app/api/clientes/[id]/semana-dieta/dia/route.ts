import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { DIAS_SEMANA } from '@/lib/nutricion/comidas-dia'
import { objetivosPorDia } from '@/lib/nutricion/objetivo-dia'
import { detalleDiaEnCurso, detalleDiaFutura, detalleSemanaEnCurso, detalleSemanaFutura } from '@/lib/nutricion/detalle-dia'

// ?dia=Lunes[&semana=N]  (sin semana = semana en curso). Sin `dia` devuelve los 7 días de la semana de una vez.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const q = new URL(request.url).searchParams
  const dia = q.get('dia') ?? ''
  if (!dia) {
    const n = Number(q.get('semana')) || 0
    try {
      const dias = n > 0 ? await detalleSemanaFutura(r.admin, r.plan, n, await objetivosPorDia(r.admin, id, r.plan)) : await detalleSemanaEnCurso(r.admin, r.plan.id)
      return NextResponse.json({ dias })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
    }
  }
  if (!DIAS_SEMANA.includes(dia as typeof DIAS_SEMANA[number])) return NextResponse.json({ error: 'Día no válido' }, { status: 400 })
  const semana = Number(q.get('semana')) || 0
  try {
    const detalle = semana > 0 ? await detalleDiaFutura(r.admin, r.plan, semana, dia, await objetivosPorDia(r.admin, id, r.plan)) : await detalleDiaEnCurso(r.admin, r.plan.id, dia)
    return NextResponse.json(detalle)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 })
  }
}

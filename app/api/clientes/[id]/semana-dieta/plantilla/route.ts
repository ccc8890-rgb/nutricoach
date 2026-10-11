import { NextRequest, NextResponse } from 'next/server'
import { autorizarSemanaDieta } from '@/lib/nutricion/semana-dieta'
import { aplicarPlantilla, comprobarPlantilla, type SemanaPlantilla } from '@/lib/nutricion/plantilla-semana'

export const maxDuration = 120

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { plantilla_id, desde: 0|1, comprobar?: true }
// comprobar: solo dice qué platos no valen para este cliente (restricciones, recetas descartadas); sin ella, aplica los válidos
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await autorizarSemanaDieta(request, id)
  if ('error' in r) return r.error
  if (!r.plan) return NextResponse.json({ error: 'El cliente no tiene plan de dieta activo' }, { status: 409 })
  const b = await request.json().catch(() => null) as { plantilla_id?: string; desde?: number; comprobar?: boolean } | null
  if (!b?.plantilla_id || !UUID.test(b.plantilla_id) || (b.desde !== 0 && b.desde !== 1)) return NextResponse.json({ error: 'Faltan plantilla o semana de inicio' }, { status: 400 })

  const { data: pl } = await r.admin.from('plantillas_semana_dieta').select('semanas').eq('id', b.plantilla_id).eq('coach_id', r.userId).maybeSingle()
  if (!pl) return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
  const semanas = pl.semanas as SemanaPlantilla[]
  try {
    if (b.comprobar) {
      const c = await comprobarPlantilla(r.admin, id, semanas, b.desde)
      return NextResponse.json({ total: c.total, validos: c.validos.length, incompatibles: c.incompatibles, noDisponibles: c.noDisponibles })
    }
    return NextResponse.json(await aplicarPlantilla(r.admin, id, r.plan, semanas, b.desde))
  } catch (e) {
    console.error('[semana-dieta/plantilla]', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo aplicar la plantilla' }, { status: 500 })
  }
}

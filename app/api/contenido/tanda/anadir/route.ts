import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { anadirRecetasATanda } from '@/lib/contenido/piezas'

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const r = await autorizarCoach(request)
  if ('error' in r) return r.error
  const b = await request.json().catch(() => null) as { fecha?: unknown; receta_ids?: unknown } | null
  if (typeof b?.fecha !== 'string' || !FECHA.test(b.fecha)) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 })
  if (!Array.isArray(b.receta_ids) || b.receta_ids.length === 0 || b.receta_ids.length > 50 || !b.receta_ids.every(x => typeof x === 'string' && UUID.test(x))) {
    return NextResponse.json({ error: 'Recetas no válidas' }, { status: 400 })
  }
  const anadidas = await anadirRecetasATanda(r.admin, r.userId, b.fecha, b.receta_ids as string[])
  return NextResponse.json({ anadidas })
}

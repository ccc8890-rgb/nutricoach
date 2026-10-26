import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { propagarCambioElaboracion } from '@/lib/recetas/elaboraciones-db'
import { CicloElaboracion } from '@/lib/recetas/elaboraciones'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recalcula los macros de la receta (contando sus elaboraciones) y, si es una elaboración, los de las recetas que la usan. Solo coach.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Receta no válida' }, { status: 400 })
  try {
    const recalculadas = await propagarCambioElaboracion(auth.admin, id)
    return NextResponse.json({ recalculadas })
  } catch (e) {
    if (e instanceof CicloElaboracion) return NextResponse.json({ error: e.message }, { status: 409 })
    return NextResponse.json({ error: 'No se pudo recalcular' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { ESTADOS_METODO, type EstadoMetodo } from '@/lib/metodos/constantes'
import { puedeAprobar, transicionMetodo } from '@/lib/metodos/esquema'
import { cargarMetodo, registrarEvento } from '@/lib/metodos/db'

// Cambia el estado de una ficha: aprobar, descartar o reabrir. Solo coach. Al salir de «aprobada» se apaga la marca de IA.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  const metodo = await cargarMetodo(auth.admin, id, auth.userId)
  if (!metodo) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const hacia = body?.estado as EstadoMetodo
  if (!ESTADOS_METODO.includes(hacia)) return NextResponse.json({ error: 'Estado no válido' }, { status: 400 })
  const t = transicionMetodo(metodo.estado, hacia)
  if (!t.ok || !t.evento) return NextResponse.json({ error: `No se puede pasar de «${metodo.estado}» a «${hacia}»` }, { status: 409 })
  if (hacia === 'aprobada') {
    const ok = puedeAprobar(metodo)
    if (!ok.ok) return NextResponse.json({ error: ok.motivo, motivo: ok.motivo }, { status: 409 })
  }

  const { data, error } = await auth.admin.from('metodos')
    .update({ estado: hacia, ...(hacia !== 'aprobada' ? { disponible_ia: false } : {}), updated_at: new Date().toISOString() })
    .eq('id', id).eq('coach_id', auth.userId).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo cambiar el estado' }, { status: 500 })
  const nota = typeof body?.nota === 'string' ? body.nota : undefined
  await registrarEvento(auth.admin, id, t.evento, nota)
  if (metodo.disponible_ia && hacia !== 'aprobada') await registrarEvento(auth.admin, id, 'ia_desactivada')
  return NextResponse.json({ metodo: data })
}

import { NextRequest, NextResponse } from 'next/server'
import { autorizarCoach } from '@/lib/contenido/auth'
import { disponibleIaPermitido, huellaMetodo, validarMetodo } from '@/lib/metodos/esquema'
import { cargarMetodo, registrarEvento } from '@/lib/metodos/db'

type Contexto = { params: Promise<{ id: string }> }

// Ficha completa con su historial. Solo coach, y solo si la ficha es suya.
export async function GET(request: NextRequest, { params }: Contexto) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  const metodo = await cargarMetodo(auth.admin, id, auth.userId)
  if (!metodo) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })
  const { data: eventos } = await auth.admin.from('metodos_eventos').select('tipo, nota, created_at').eq('metodo_id', id).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ metodo, eventos: eventos ?? [] })
}

// Edita campos de la ficha y/o la marca «disponible para la IA». El estado se cambia en /estado.
export async function PATCH(request: NextRequest, { params }: Contexto) {
  const auth = await autorizarCoach(request)
  if ('error' in auth) return auth.error
  const { id } = await params
  const metodo = await cargarMetodo(auth.admin, id, auth.userId)
  if (!metodo) return NextResponse.json({ error: 'Ficha no encontrada' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const pideIa = body && typeof body === 'object' && 'disponible_ia' in body
  const { disponible_ia: iaPedida, ...resto } = (body ?? {}) as Record<string, unknown>
  const hayCampos = Object.keys(resto).length > 0
  if (!hayCampos && !pideIa) return NextResponse.json({ error: 'No hay nada que cambiar' }, { status: 400 })

  const cambios: Record<string, unknown> = {}
  if (hayCampos) {
    const v = validarMetodo(resto, 'editar')
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    Object.assign(cambios, v.valor)
    if ('autor' in v.valor || 'url_origen' in v.valor || 'titulo' in v.valor) {
      const huella = huellaMetodo({ autor: v.valor.autor ?? metodo.autor, url_origen: v.valor.url_origen ?? metodo.url_origen, titulo: v.valor.titulo ?? metodo.titulo })
      if (huella !== metodo.huella) {
        const { data: otra } = await auth.admin.from('metodos').select('id').eq('coach_id', auth.userId).eq('huella', huella).neq('id', id).maybeSingle()
        if (otra) return NextResponse.json({ error: 'Ya existe otra ficha con este enlace y autor', existente_id: otra.id }, { status: 409 })
        cambios.huella = huella
      }
    }
  }
  let eventoIa: 'ia_activada' | 'ia_desactivada' | null = null
  if (pideIa) {
    if (typeof iaPedida !== 'boolean') return NextResponse.json({ error: '«disponible_ia» debe ser verdadero o falso' }, { status: 400 })
    if (iaPedida && !disponibleIaPermitido(metodo.estado, true)) return NextResponse.json({ error: 'Solo las fichas aprobadas pueden estar disponibles para la IA' }, { status: 409 })
    if (iaPedida !== metodo.disponible_ia) { cambios.disponible_ia = iaPedida; eventoIa = iaPedida ? 'ia_activada' : 'ia_desactivada' }
  }
  if (Object.keys(cambios).length === 0) return NextResponse.json({ metodo })

  const { data, error } = await auth.admin.from('metodos').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).eq('coach_id', auth.userId).select('*').single()
  if (error || !data) return NextResponse.json({ error: 'No se pudo guardar la ficha' }, { status: 500 })
  if (hayCampos) await registrarEvento(auth.admin, id, 'editada')
  if (eventoIa) await registrarEvento(auth.admin, id, eventoIa)
  return NextResponse.json({ metodo: data })
}

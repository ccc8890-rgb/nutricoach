import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { auditarRecetaProfesional } from '@/lib/recetas/auditoria'
import { NIVELES_FIT, TIPOS_USO, CONTEXTOS_USO, APTAS_CLIENTE } from '@/lib/recetas/profesional'

// Edita a mano la clasificación profesional de una receta (solo coach). Con { auto: true } vuelve a la clasificación automática.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const auth = createApiSupabase(request)
    const { data: { user } } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const srv = createServiceSupabase()
    const { data: perfil } = await srv.from('profiles').select('role').eq('id', user.id).single()
    if (perfil?.role !== 'coach') return NextResponse.json({ error: 'Solo el coach puede editar la clasificación' }, { status: 403 })

    const body = await request.json()
    const update: Record<string, unknown> = {}

    if (body.auto === true) {
      update.clasificacion_manual = false
    } else {
      const enums: [string, readonly string[]][] = [
        ['nivel_fit', NIVELES_FIT], ['tipo_uso', TIPOS_USO], ['contexto_uso', CONTEXTOS_USO], ['apta_cliente', APTAS_CLIENTE],
      ]
      for (const [campo, validos] of enums) {
        if (body[campo] === undefined) continue
        if (!validos.includes(body[campo])) return NextResponse.json({ error: `Valor no válido para ${campo}` }, { status: 400 })
        update[campo] = body[campo]
      }
      if (body.alcohol_culinario !== undefined) {
        if (typeof body.alcohol_culinario !== 'boolean') return NextResponse.json({ error: 'alcohol_culinario debe ser true o false' }, { status: 400 })
        update.alcohol_culinario = body.alcohol_culinario
      }
      if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
      update.clasificacion_manual = true
    }

    const { error } = await srv.from('recetas').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Deja el evento 'clasificada' y, con auto, recalcula la clasificación automática.
    const audit = await auditarRecetaProfesional(srv, id, 'clasificada', body.auto === true ? 'coach_clasificacion_auto' : 'coach_clasificacion_manual')
    return NextResponse.json({ ok: true, clasificacion: audit.clasificacion, manual: body.auto !== true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 })
  }
}

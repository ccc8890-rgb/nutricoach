import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { auditarRecetaProfesional } from '@/lib/recetas/auditoria'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()
    const { estado } = body

    const estadosValidos = ['aprobada', 'descartada', 'en_revision', 'borrador']
    if (!estado || !estadosValidos.includes(estado)) {
      return NextResponse.json(
        { error: 'Estado no válido. Debe ser uno de: ' + estadosValidos.join(', ') },
        { status: 400 }
      )
    }

    // Verificar que la receta existe y pertenece al coach
    const { data: receta, error: findError } = await supabase
      .from('recetas')
      .select('id')
      .eq('id', id)
      .eq('coach_id', user.id)
      .single()

    if (findError || !receta) {
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
    }

    // Quality gate for approval
    if (estado === 'aprobada') {
      const audit = await auditarRecetaProfesional(
        createServiceSupabase(),
        id,
        'quality_check_previo',
        'api_receta_estado'
      )
      if (!audit.resumen.aprobable || audit.score.bloqueantes.length > 0) {
        return NextResponse.json({
          error: 'La receta no pasa el quality gate',
          bloqueantes: audit.score.bloqueantes,
          avisos: audit.score.avisos,
        }, { status: 409 })
      }
    }

    const { error: updateError } = await supabase
      .from('recetas')
      .update({ estado })
      .eq('id', id)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
    }

    await auditarRecetaProfesional(
      createServiceSupabase(),
      id,
      estado === 'aprobada' ? 'aprobada_manual' : `estado_${estado}`,
      'api_receta_estado'
    )

    return NextResponse.json({ data: { id, estado } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

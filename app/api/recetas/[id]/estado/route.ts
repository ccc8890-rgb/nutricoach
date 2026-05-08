import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

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

    const { error: updateError } = await supabase
      .from('recetas')
      .update({ estado, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (updateError) {
      console.error(updateError)
      return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
    }

    return NextResponse.json({ data: { id, estado } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

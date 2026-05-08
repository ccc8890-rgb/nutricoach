import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/plantillas/[id] — Obtener una plantilla
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('plantillas_dietas')
            .select('*')
            .eq('id', id)
            .eq('coach_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/plantillas/[id]:', error)
        return NextResponse.json({ error: 'Error al obtener plantilla' }, { status: 500 })
    }
}

// PUT /api/plantillas/[id] — Actualizar plantilla
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, activo } = body

        const updates: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        }

        if (nombre !== undefined) updates.nombre = nombre.trim()
        if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null
        if (tipo !== undefined) updates.tipo = tipo
        if (kcal_objetivo !== undefined) updates.kcal_objetivo = Number(kcal_objetivo)
        if (proteinas_objetivo !== undefined) updates.proteinas_objetivo = Number(proteinas_objetivo)
        if (carbohidratos_objetivo !== undefined) updates.carbohidratos_objetivo = Number(carbohidratos_objetivo)
        if (grasas_objetivo !== undefined) updates.grasas_objetivo = Number(grasas_objetivo)
        if (activo !== undefined) updates.activo = activo

        const { data, error } = await supabase
            .from('plantillas_dietas')
            .update(updates)
            .eq('id', id)
            .eq('coach_id', user.id)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error PUT /api/plantillas/[id]:', error)
        return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 })
    }
}

// DELETE /api/plantillas/[id] — Eliminar plantilla
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { error } = await supabase
            .from('plantillas_dietas')
            .delete()
            .eq('id', id)
            .eq('coach_id', user.id)

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error DELETE /api/plantillas/[id]:', error)
        return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 })
    }
}

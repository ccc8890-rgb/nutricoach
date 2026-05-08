import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/cuestionarios/[id] — Obtener un cuestionario por ID
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('cuestionarios')
            .select('*')
            .eq('id', id)
            .eq('coach_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/cuestionarios/[id]:', error)
        return NextResponse.json({ error: 'Error al obtener cuestionario' }, { status: 500 })
    }
}

// PUT /api/cuestionarios/[id] — Actualizar un cuestionario
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { titulo, descripcion, preguntas, activo } = body

        const updates: Record<string, unknown> = {}
        if (titulo !== undefined) updates.titulo = titulo.trim()
        if (descripcion !== undefined) updates.descripcion = descripcion?.trim() || null
        if (preguntas !== undefined) updates.preguntas = preguntas
        if (activo !== undefined) updates.activo = activo
        updates.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('cuestionarios')
            .update(updates)
            .eq('id', id)
            .eq('coach_id', user.id)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error PUT /api/cuestionarios/[id]:', error)
        return NextResponse.json({ error: 'Error al actualizar cuestionario' }, { status: 500 })
    }
}

// DELETE /api/cuestionarios/[id] — Eliminar un cuestionario
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { error } = await supabase
            .from('cuestionarios')
            .delete()
            .eq('id', id)
            .eq('coach_id', user.id)

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error DELETE /api/cuestionarios/[id]:', error)
        return NextResponse.json({ error: 'Error al eliminar cuestionario' }, { status: 500 })
    }
}

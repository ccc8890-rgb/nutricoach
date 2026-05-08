import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// PUT /api/respuestas/[id]/leer — Marcar respuesta como leída
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

        const { data, error } = await supabase
            .from('respuestas_clientes')
            .update({ leida: true, updated_at: new Date().toISOString() })
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
        console.error('Error PUT /api/respuestas/[id]/leer:', error)
        return NextResponse.json({ error: 'Error al marcar como leída' }, { status: 500 })
    }
}

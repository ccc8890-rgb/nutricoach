import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const { id } = await params
        const serviceSupabase = createServiceSupabase()

        const { data: acciones, error } = await serviceSupabase
            .from('periodizacion_acciones')
            .select('*')
            .eq('cliente_id', id)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            console.error('Error al obtener periodización:', error)
            return NextResponse.json({ error: 'Error al cargar' }, { status: 500 })
        }

        return NextResponse.json({ acciones: acciones ?? [] })
    } catch (err) {
        console.error('Error en GET /api/clientes/[id]/periodizacion:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

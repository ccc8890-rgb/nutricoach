import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
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

        const body = await request.json().catch(() => ({}))
        const { accion_id, coach_nota, aprobar } = body

        if (!accion_id) {
            return NextResponse.json({ error: 'accion_id requerido' }, { status: 400 })
        }

        const serviceSupabase = createServiceSupabase()

        const { data, error } = await serviceSupabase
            .from('periodizacion_acciones')
            .update({
                aprobado_por_coach: aprobar !== false, // true por defecto, false si se rechaza
                coach_nota: coach_nota ?? null,
                aplicado: aprobar !== false,
            })
            .eq('id', accion_id)
            .select()
            .single()

        if (error) {
            console.error('Error al aprobar acción:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        return NextResponse.json({ success: true, accion: data })
    } catch (err) {
        console.error('Error en POST /api/periodizacion/refeed/aprobar:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

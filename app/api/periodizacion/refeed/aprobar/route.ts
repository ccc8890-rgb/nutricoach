import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { aplicarAjusteAlPlan } from '@/app/api/cliente/[codigo]/checkin/route'

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
                aprobado_por_coach: aprobar !== false,
                coach_nota: coach_nota ?? null,
                aplicado: false, // se marca true solo tras aplicar efectivamente
            })
            .eq('id', accion_id)
            .select('id, ajuste_macros, cliente_id, aplicado')
            .single()

        if (error) {
            console.error('Error al aprobar acción:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        // Aplicar ajuste al plan activo si fue aprobado y hay macros calculados
        if (aprobar !== false && data?.ajuste_macros && data?.cliente_id) {
            const { data: planActivo } = await serviceSupabase
                .from('planes_nutricion')
                .select('id')
                .eq('cliente_id', data.cliente_id)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (planActivo?.id) {
                await aplicarAjusteAlPlan(serviceSupabase, planActivo.id, data.ajuste_macros, data.id)
            }
        }

        return NextResponse.json({ success: true, accion: data, ajuste_aplicado: aprobar !== false && !!data?.ajuste_macros })
    } catch (err) {
        console.error('Error en POST /api/periodizacion/refeed/aprobar:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const { data, error } = await supabase
            .rpc('get_tls_dashboard', { p_cliente_id: id })

        if (error) {
            console.error('Error RPC get_tls_dashboard:', error)
            return NextResponse.json({ error: 'Error al obtener TLS' }, { status: 500 })
        }

        // Historial semanal (últimas 8 semanas para gráfico)
        const { data: historico } = await supabase
            .from('tls_por_cliente')
            .select('semana_inicio, tls_semanal, num_sesiones')
            .eq('cliente_id', id)
            .order('semana_inicio', { ascending: false })
            .limit(8)

        return NextResponse.json({ ...data, historico: historico ?? [] })
    } catch (err) {
        console.error('Error en GET /api/clientes/[id]/tls:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = createApiSupabase(request)
        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const { tls_umbral_carga_alta } = body

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const umbral = Number(tls_umbral_carga_alta)
        if (!umbral || umbral < 10 || umbral > 500) {
            return NextResponse.json({ error: 'Umbral debe estar entre 10 y 500' }, { status: 400 })
        }

        const { error } = await supabase
            .from('clientes')
            .update({ tls_umbral_carga_alta: umbral })
            .eq('id', id)

        if (error) {
            console.error('Error al actualizar umbral TLS:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Error en PATCH /api/clientes/[id]/tls:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

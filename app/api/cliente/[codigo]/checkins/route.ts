import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Cliente admin para endpoints públicos (sin autenticación)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const { codigo } = await params
        const url = new URL(_request.url)
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = parseInt(url.searchParams.get('limit') || '20')
        const offset = (page - 1) * limit

        // 1. Buscar plan por código público
        const { data: plan } = await supabaseAdmin
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        const clienteId = plan.cliente_id

        // 2. Obtener total de check-ins
        const { count: total } = await supabaseAdmin
            .from('checkins')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', clienteId)

        // 3. Obtener check-ins paginados
        const { data: checkins } = await supabaseAdmin
            .from('checkins')
            .select('*')
            .eq('cliente_id', clienteId)
            .order('fecha', { ascending: false })
            .range(offset, offset + limit - 1)

        return NextResponse.json({
            checkins: checkins ?? [],
            total: total ?? 0,
            page,
            limit,
            totalPages: Math.ceil((total ?? 0) / limit),
        })
    } catch (err) {
        console.error('Error en historial checkins:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

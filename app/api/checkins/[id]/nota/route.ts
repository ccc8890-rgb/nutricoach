import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { id } = await params
    const { nota } = await request.json()

    if (typeof nota !== 'string') {
        return NextResponse.json({ error: 'Campo nota requerido' }, { status: 400 })
    }

    const db = createServiceSupabase()

    // Verificar que el checkin pertenece a un cliente del coach
    const { data: checkin } = await db
        .from('checkins')
        .select('id, cliente_id, clientes!inner(coach_id)')
        .eq('id', id)
        .single()

    if (!checkin) return NextResponse.json({ error: 'Check-in no encontrado' }, { status: 404 })

    const coach_id = (checkin.clientes as unknown as { coach_id: string }).coach_id
    if (coach_id !== user.id) {
        return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const { error } = await db
        .from('checkins')
        .update({ nota_coach: nota.trim() || null })
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}

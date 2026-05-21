import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<unknown> }
) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { id } = await params as { id: string }
    const db = createServiceSupabase()
    const { data: plan, error } = await db
        .from('planes_nutricion')
        .select('id, coach_id, codigo_publico')
        .eq('id', id)
        .single()

    if (error || !plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    if (plan.coach_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    if (!plan.codigo_publico) return NextResponse.json({ error: 'Plan sin código público' }, { status: 400 })

    const url = new URL(`/api/cliente/${plan.codigo_publico}/plan-pdf`, request.url)
    return NextResponse.redirect(url)
}

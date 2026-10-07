import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { informeMicronutrientesPlan } from '@/lib/micronutrientes/plan'

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params
    const auth = await autorizarAccesoPlan(_request, codigo)
    if (auth instanceof NextResponse) return auth
    const db = createServiceSupabase()

    const { data: plan } = await db
        .from('planes_nutricion')
        .select('id, nombre, cliente_id')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    return NextResponse.json(await informeMicronutrientesPlan(db, plan))
}

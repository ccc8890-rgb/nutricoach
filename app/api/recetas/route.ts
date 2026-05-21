import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = createServiceSupabase()
    const { data, error } = await db
        .from('recetas')
        .select('id, nombre, porciones, kcal')
        .eq('estado', 'aprobada')
        .order('nombre', { ascending: true })
        .limit(1000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ recetas: data ?? [] })
}

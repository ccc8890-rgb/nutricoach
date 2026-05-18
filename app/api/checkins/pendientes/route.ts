import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const db = createServiceSupabase()
    const hace7Dias = new Date()
    hace7Dias.setDate(hace7Dias.getDate() - 7)

    const { data, error } = await db
        .from('checkins')
        .select('id, fecha, peso, adherencia, energia, notas, clientes!inner(id, coach_id, profile:profiles!profile_id(nombre))')
        .is('nota_coach', null)
        .gte('fecha', hace7Dias.toISOString().split('T')[0])
        .order('fecha', { ascending: false })
        .limit(20)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filtrar por coach + aplanar
    const checkins = (data ?? [])
        .filter((c: any) => c.clientes?.coach_id === user.id)
        .map((c: any) => ({
            id: c.id,
            fecha: c.fecha,
            peso: c.peso,
            adherencia: c.adherencia,
            energia: c.energia,
            notas: c.notas,
            cliente_id: c.clientes.id,
            cliente_nombre: c.clientes.profile?.nombre ?? 'Cliente',
        }))

    return NextResponse.json({ checkins })
}

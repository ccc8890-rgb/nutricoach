import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

/**
 * GET /api/clientes/buscar?q=término
 *
 * Busca clientes del coach por nombre o email (text search en profiles).
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')?.trim()
        if (!q || q.length < 2) {
            return NextResponse.json({ clientes: [] })
        }

        // Buscar profiles por nombre (ILIKE)
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, nombre, apellidos, email')
            .or(`nombre.ilike.%${q}%,apellidos.ilike.%${q}%,email.ilike.%${q}%`)
            .eq('role', 'cliente')
            .limit(20)

        if (profilesError) {
            console.error('[API Buscar Clientes] Error profiles:', profilesError)
            return NextResponse.json({ clientes: [] })
        }

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({ clientes: [] })
        }

        const profileIds = profiles.map(p => p.id)

        // Obtener clientes asociados a estos profiles
        const { data: clientes } = await supabase
            .from('clientes')
            .select('id, profile_id')
            .in('profile_id', profileIds)
            .eq('coach_id', user.id)

        if (!clientes || clientes.length === 0) {
            return NextResponse.json({ clientes: [] })
        }

        const profileMap = new Map(profiles.map(p => [p.id, p]))

        const resultados = clientes.map(c => {
            const profile = profileMap.get(c.profile_id)
            const nombre = [profile?.nombre, profile?.apellidos].filter(Boolean).join(' ')
            return {
                id: c.id,
                nombre: nombre || 'Sin nombre',
                email: profile?.email || '',
            }
        })

        return NextResponse.json({ clientes: resultados })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Buscar Clientes] Error:', msg)
        return NextResponse.json({ clientes: [] })
    }
}

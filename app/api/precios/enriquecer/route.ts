import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import {
    ejecutarEnriquecimientoCompleto,
    obtenerPendientesEnriquecer,
    obtenerStatsEnriquecimiento,
} from '@/lib/enriquecimiento-nutricional'

/**
 * POST /api/precios/enriquecer
 * Inicia el enriquecimiento nutricional por IA de los alimentos pendientes.
 * Body opcional: { limite?: number }
 */
export async function POST(request: NextRequest) {
    try {
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data: profile } = await authSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Solo el coach puede ejecutar enriquecimiento' }, { status: 403 })
        }

        const body = await request.json().catch(() => ({}))
        const limite = body.limite ?? 100

        const serviceSupabase = createServiceSupabase()
        const resultado = await ejecutarEnriquecimientoCompleto(serviceSupabase, limite)

        return NextResponse.json(resultado)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Enriquecer] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

/**
 * GET /api/precios/enriquecer
 * Obtiene estadísticas y lista de pendientes de enriquecimiento.
 */
export async function GET(request: NextRequest) {
    try {
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const serviceSupabase = createServiceSupabase()

        const url = new URL(request.url)
        const accion = url.searchParams.get('accion') || 'stats'

        if (accion === 'pendientes') {
            const limite = parseInt(url.searchParams.get('limite') || '50')
            const pendientes = await obtenerPendientesEnriquecer(serviceSupabase, limite)
            return NextResponse.json(pendientes)
        }

        const stats = await obtenerStatsEnriquecimiento(serviceSupabase)
        return NextResponse.json(stats)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Enriquecer Stats] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

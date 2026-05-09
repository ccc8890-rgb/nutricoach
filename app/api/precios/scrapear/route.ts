import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { scrapearSupermercado, scrapearTodosLosSupermercados } from '@/lib/scraping'

/**
 * POST /api/precios/scrapear
 * Inicia scraping de un supermercado específico.
 * Body: { supermercado_id: string }
 */
export async function POST(request: NextRequest) {
    try {
        // 1. Verificar autenticación con cliente de sesión
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 2. Verificar que es coach
        const { data: profile } = await authSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Solo el coach puede ejecutar scraping' }, { status: 403 })
        }

        // 3. Obtener supermercado_id del body
        const { supermercado_id } = await request.json()
        if (!supermercado_id) {
            return NextResponse.json({ error: 'supermercado_id es requerido' }, { status: 400 })
        }

        // 4. Obtener slug del supermercado (con authSupabase, ya que solo lectura)
        const { data: sm } = await authSupabase
            .from('supermercados')
            .select('slug, nombre')
            .eq('id', supermercado_id)
            .single()

        if (!sm) {
            return NextResponse.json({ error: 'Supermercado no encontrado' }, { status: 404 })
        }

        // 5. Ejecutar scraping con service_role (bypass RLS para inserts en productos_supermercado + precios_historico)
        const serviceSupabase = createServiceSupabase()
        const resultado = await scrapearSupermercado(supermercado_id, sm.slug, serviceSupabase)

        return NextResponse.json(resultado)
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Scrapear] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

/**
 * GET /api/precios/scrapear
 * Scrapea todos los supermercados disponibles secuencialmente.
 */
export async function GET(request: NextRequest) {
    try {
        // 1. Verificar autenticación
        const authSupabase = createApiSupabase(request)
        const { data: { user } } = await authSupabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 2. Ejecutar scraping con service_role
        const serviceSupabase = createServiceSupabase()
        const resultados = await scrapearTodosLosSupermercados(serviceSupabase)

        return NextResponse.json({
            total_supermercados: resultados.length,
            resultados,
            timestamp: new Date().toISOString(),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[API Scrapear Todos] Error:', msg)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

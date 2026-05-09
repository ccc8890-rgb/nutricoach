import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

/**
 * GET /api/precios/historico?alimento_id=xxx&supermercado_id=xxx&limite=30
 * Obtiene el histórico de precios de un alimento en un supermercado.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const alimentoId = searchParams.get('alimento_id')
        const supermercadoId = searchParams.get('supermercado_id')
        const limite = parseInt(searchParams.get('limite') || '30', 10)

        if (!alimentoId) {
            return NextResponse.json({ error: 'alimento_id es requerido' }, { status: 400 })
        }

        let query = supabase
            .from('precios_historico')
            .select('*')
            .eq('alimento_id', alimentoId)
            .order('fecha_precio', { ascending: false })
            .limit(limite)

        if (supermercadoId) {
            query = query.eq('supermercado_id', supermercadoId)
        }

        const { data, error } = await query

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json(data ?? [])
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params

        // Buscar plan por código
        const { data: plan } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan || !plan.cliente_id) {
            return NextResponse.json({ notas: [] })
        }

        const { data: notas, error } = await supabase
            .from('notas_coach')
            .select('*')
            .eq('cliente_id', plan.cliente_id)
            .order('created_at', { ascending: false })
            .limit(30)

        if (error) {
            console.error('Error al obtener notas:', error)
            return NextResponse.json({ error: 'Error al cargar' }, { status: 500 })
        }

        return NextResponse.json({ notas: notas ?? [] })
    } catch (err) {
        console.error('Error en notas:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

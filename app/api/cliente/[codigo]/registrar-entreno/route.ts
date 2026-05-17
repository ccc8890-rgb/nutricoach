import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params
        const body = await request.json().catch(() => ({}))
        const { tipo_actividad, duracion_min, rpe, notas, fecha } = body

        if (!tipo_actividad || !duracion_min || !rpe) {
            return NextResponse.json(
                { error: 'tipo_actividad, duracion_min y rpe son obligatorios' },
                { status: 400 }
            )
        }

        const { data: plan } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan?.cliente_id) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        const { data, error } = await supabase
            .from('registros_entreno')
            .insert({
                cliente_id: plan.cliente_id,
                tipo_actividad,
                duracion_min: Number(duracion_min),
                rpe: Number(rpe),
                notas: notas || null,
                fecha: fecha || new Date().toLocaleDateString('en-CA'),
            })
            .select()
            .single()

        if (error) {
            console.error('Error al registrar entreno:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        return NextResponse.json({ success: true, registro: data })
    } catch (err) {
        console.error('Error en registrar-entreno:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params

        const { data: plan } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan?.cliente_id) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        const { data, error } = await supabase
            .rpc('get_tls_dashboard', { p_cliente_id: plan.cliente_id })

        if (error) {
            console.error('Error al obtener TLS:', error)
            return NextResponse.json({ error: 'Error al cargar datos' }, { status: 500 })
        }

        return NextResponse.json(data)
    } catch (err) {
        console.error('Error en GET registrar-entreno:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

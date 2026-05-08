import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// GET /api/respuestas — Listar respuestas del coach (protegido)
export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('respuestas_clientes')
            .select('*, cuestionario:cuestionarios(titulo, codigo_publico)')
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/respuestas:', error)
        return NextResponse.json({ error: 'Error al obtener respuestas' }, { status: 500 })
    }
}

// POST /api/respuestas — Cliente envía respuestas (público, sin auth)
export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabase()
        const body = await request.json()
        const { codigo_publico, respuestas, nombre_cliente, email_cliente } = body

        if (!codigo_publico) {
            return NextResponse.json({ error: 'código_publico es obligatorio' }, { status: 400 })
        }

        if (!respuestas || typeof respuestas !== 'object') {
            return NextResponse.json({ error: 'respuestas debe ser un objeto' }, { status: 400 })
        }

        // Buscar el cuestionario por código público
        const { data: cuestionario, error: qError } = await supabase
            .from('cuestionarios')
            .select('id, coach_id, activo')
            .eq('codigo_publico', codigo_publico)
            .single()

        if (qError || !cuestionario) {
            return NextResponse.json({ error: 'Cuestionario no encontrado' }, { status: 404 })
        }

        if (!cuestionario.activo) {
            return NextResponse.json({ error: 'Este cuestionario no está disponible' }, { status: 410 })
        }

        const { data, error } = await supabase
            .from('respuestas_clientes')
            .insert({
                cuestionario_id: cuestionario.id,
                coach_id: cuestionario.coach_id,
                respuestas,
                nombre_cliente: nombre_cliente?.trim() || null,
                email_cliente: email_cliente?.trim() || null,
                estado: 'nueva',
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, id: data.id }, { status: 201 })
    } catch (error) {
        console.error('Error POST /api/respuestas:', error)
        return NextResponse.json({ error: 'Error al guardar respuestas' }, { status: 500 })
    }
}

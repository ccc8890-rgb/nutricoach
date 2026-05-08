import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// Generar código público único de 8 caracteres
function generarCodigoPublico(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let codigo = ''
    for (let i = 0; i < 8; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return codigo
}

// GET /api/cuestionarios — Listar cuestionarios del coach
export async function GET() {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('cuestionarios')
            .select('*')
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/cuestionarios:', error)
        return NextResponse.json({ error: 'Error al obtener cuestionarios' }, { status: 500 })
    }
}

// POST /api/cuestionarios — Crear nuevo cuestionario
export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { titulo, descripcion, preguntas } = body

        if (!titulo || !titulo.trim()) {
            return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
        }

        // Generar código único (con reintento si hay colisión)
        let codigo_publico = generarCodigoPublico()
        let intentos = 0
        while (intentos < 5) {
            const { data: existente } = await supabase
                .from('cuestionarios')
                .select('id')
                .eq('codigo_publico', codigo_publico)
                .single()
            if (!existente) break
            codigo_publico = generarCodigoPublico()
            intentos++
        }

        const { data, error } = await supabase
            .from('cuestionarios')
            .insert({
                coach_id: user.id,
                titulo: titulo.trim(),
                descripcion: descripcion?.trim() || null,
                preguntas: preguntas || [],
                codigo_publico,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error('Error POST /api/cuestionarios:', error)
        return NextResponse.json({ error: 'Error al crear cuestionario' }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/plantillas — Listar plantillas de dieta del coach
export async function GET() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('plantillas_dietas')
            .select('*')
            .eq('coach_id', user.id)
            .order('nombre', { ascending: true })

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/plantillas:', error)
        return NextResponse.json({ error: 'Error al obtener plantillas' }, { status: 500 })
    }
}

// POST /api/plantillas — Crear nueva plantilla
export async function POST(request: Request) {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { nombre, descripcion, tipo, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo } = body

        if (!nombre || !nombre.trim()) {
            return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
        }

        if (!kcal_objetivo || !proteinas_objetivo || !carbohidratos_objetivo || !grasas_objetivo) {
            return NextResponse.json({ error: 'Todos los macros son obligatorios' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('plantillas_dietas')
            .insert({
                coach_id: user.id,
                nombre: nombre.trim(),
                descripcion: descripcion?.trim() || null,
                tipo: tipo || 'normal',
                kcal_objetivo: Number(kcal_objetivo),
                proteinas_objetivo: Number(proteinas_objetivo),
                carbohidratos_objetivo: Number(carbohidratos_objetivo),
                grasas_objetivo: Number(grasas_objetivo),
                activo: true,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json(data, { status: 201 })
    } catch (error) {
        console.error('Error POST /api/plantillas:', error)
        return NextResponse.json({ error: 'Error al crear plantilla' }, { status: 500 })
    }
}

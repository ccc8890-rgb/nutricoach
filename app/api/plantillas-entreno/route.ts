import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/plantillas-entreno — Listar plantillas de entrenamiento del coach
export async function GET() {
    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { data, error } = await supabase
            .from('plantillas_entrenamiento')
            .select('*, sesiones:plantilla_sesiones(*, ejercicios:plantilla_sesion_ejercicios(*, ejercicio:ejercicios(*)))')
            .eq('coach_id', user.id)
            .eq('activo', true)
            .order('tipo', { ascending: true })
            .order('dias_por_semana', { ascending: true })

        if (error) throw error

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error GET /api/plantillas-entreno:', error)
        return NextResponse.json({ error: 'Error al obtener plantillas de entrenamiento' }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params
        const body = await request.json()

        // Verificar que el cliente existe
        const { data: cliente, error: findError } = await supabase
            .from('clientes')
            .select('id')
            .eq('id', id)
            .single()

        if (findError || !cliente) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }

        // Filtrar solo campos permitidos para actualizar
        const camposPermitidos = [
            'objetivo', 'nivel', 'peso_inicial', 'altura', 'edad', 'sexo',
            'restricciones_alimentarias', 'notas', 'activo', 'fecha_proxima_revision'
        ]

        const actualizacion: Record<string, any> = {}
        for (const campo of camposPermitidos) {
            if (campo in body) {
                actualizacion[campo] = body[campo]
            }
        }

        if (Object.keys(actualizacion).length === 0) {
            return NextResponse.json({ error: 'No hay campos válidos para actualizar' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('clientes')
            .update(actualizacion)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Error actualizando cliente:', error)
            return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error en PUT /api/clientes/[id]:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data, error } = await supabase
            .from('clientes')
            .select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error en GET /api/clientes/[id]:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

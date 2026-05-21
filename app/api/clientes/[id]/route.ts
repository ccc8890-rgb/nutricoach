import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

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

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // Verify coach session
        const supabaseAuth = await createServerSupabase()
        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const supabase = createServiceSupabase()

        // Verify coach owns this client
        const { data: cliente } = await supabase
            .from('clientes')
            .select('id, coach_id, profile_id')
            .eq('id', id)
            .single()

        if (!cliente) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        if (cliente.coach_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

        // Delete dependent records first (in case FK cascades are not set)
        await supabase.from('onboarding_responses').delete().eq('cliente_id', id)
        await supabase.from('onboarding_perfil_profundo').delete().eq('cliente_id', id)
        await supabase.from('intercambios_historial').delete().eq('cliente_id', id)
        await supabase.from('perfil_alimentario_cliente').delete().eq('cliente_id', id)
        await supabase.from('perfil_entreno_cliente').delete().eq('cliente_id', id)
        await supabase.from('notas_coach').delete().eq('cliente_id', id)
        await supabase.from('checkins').delete().eq('cliente_id', id)
        await supabase.from('seguimiento_peso').delete().eq('cliente_id', id)
        await supabase.from('invitaciones').delete().eq('coach_id', user.id).eq('email', cliente.profile_id)

        // Delete plans (comidas cascade from planes_nutricion if FK set, otherwise manual)
        const { data: planes } = await supabase.from('planes_nutricion').select('id').eq('cliente_id', id)
        for (const plan of planes ?? []) {
            const { data: comidas } = await supabase.from('comidas').select('id').eq('plan_id', plan.id)
            for (const comida of comidas ?? []) {
                await supabase.from('comida_alimentos').delete().eq('comida_id', comida.id)
            }
            await supabase.from('comidas').delete().eq('plan_id', plan.id)
        }
        await supabase.from('planes_nutricion').delete().eq('cliente_id', id)

        // Delete training plans
        const { data: entrenosPlanes } = await supabase.from('planes_entrenamiento').select('id').eq('cliente_id', id)
        for (const ep of entrenosPlanes ?? []) {
            const { data: sesiones } = await supabase.from('sesiones_entrenamiento').select('id').eq('plan_id', ep.id)
            for (const s of sesiones ?? []) {
                await supabase.from('sesion_ejercicios').delete().eq('sesion_id', s.id)
            }
            await supabase.from('sesiones_entrenamiento').delete().eq('plan_id', ep.id)
        }
        await supabase.from('planes_entrenamiento').delete().eq('cliente_id', id)

        // Finally delete the client record
        const { error: deleteError } = await supabase.from('clientes').delete().eq('id', id)
        if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

        return NextResponse.json({ ok: true })
    } catch (error) {
        console.error('Error en DELETE /api/clientes/[id]:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

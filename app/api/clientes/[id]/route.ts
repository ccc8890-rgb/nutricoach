import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        // Verificar que el cliente existe y pertenece a este coach
        const srv = createServiceSupabase()
        const { data: cliente, error: findError } = await srv
            .from('clientes')
            .select('id, coach_id')
            .eq('id', id)
            .single()

        if (findError || !cliente) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }
        if (cliente.coach_id !== user.id) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
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

        const { data, error } = await srv
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
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params
        const srv = createServiceSupabase()

        const { data, error } = await srv
            .from('clientes')
            .select('*, profile:profiles!profile_id(nombre, apellidos, email, telefono)')
            .eq('id', id)
            .eq('coach_id', user.id)
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

        // Obtener email del profile para limpiar invitaciones (la tabla invitaciones no tiene cliente_id)
        const { data: profile } = await supabase
            .from('profiles')
            .select('email')
            .eq('id', cliente.profile_id)
            .maybeSingle()

        // Helper: delete con verificación de error, retorna mensaje de error o null
        async function borrar(tabla: string, columna: string, valor: string): Promise<string | null> {
            const { error } = await supabase.from(tabla).delete().eq(columna, valor)
            return error ? `Error al borrar ${tabla}: ${error.message}` : null
        }

        const errores: string[] = []

        // Delete dependent records first (in case FK cascades are not set)
        for (const [tabla, col] of [
            ['onboarding_responses', 'cliente_id'],
            ['onboarding_perfil_profundo', 'cliente_id'],
            ['intercambios_historial', 'cliente_id'],
            ['perfil_alimentario_cliente', 'cliente_id'],
            ['perfil_entreno_cliente', 'cliente_id'],
            ['notas_coach', 'cliente_id'],
            ['checkins', 'cliente_id'],
            ['seguimiento_peso', 'cliente_id'],
        ] as const) {
            const err = await borrar(tabla, col, id)
            if (err) errores.push(err)
        }

        // Invitaciones: filtrar por coach_id + email (si se pudo obtener)
        if (profile?.email) {
            const { error: errInv } = await supabase
                .from('invitaciones')
                .delete()
                .eq('coach_id', user.id)
                .eq('email', profile.email)
            if (errInv) errores.push(`Error al borrar invitaciones: ${errInv.message}`)
        }

        // Delete nutrition plans (comidas cascade from planes_nutricion)
        const { data: planes } = await supabase.from('planes_nutricion').select('id').eq('cliente_id', id)
        for (const plan of planes ?? []) {
            const { data: comidas } = await supabase.from('comidas').select('id').eq('plan_id', plan.id)
            for (const comida of comidas ?? []) {
                const err = await borrar('comida_alimentos', 'comida_id', comida.id)
                if (err) errores.push(err)
            }
            const err = await borrar('comidas', 'plan_id', plan.id)
            if (err) errores.push(err)
        }
        const errPlan = await borrar('planes_nutricion', 'cliente_id', id)
        if (errPlan) errores.push(errPlan)

        // Delete training plans
        const { data: entrenosPlanes } = await supabase.from('planes_entrenamiento').select('id').eq('cliente_id', id)
        for (const ep of entrenosPlanes ?? []) {
            const { data: sesiones } = await supabase.from('sesiones_entrenamiento').select('id').eq('plan_id', ep.id)
            for (const s of sesiones ?? []) {
                const err = await borrar('sesion_ejercicios', 'sesion_id', s.id)
                if (err) errores.push(err)
            }
            const err = await borrar('sesiones_entrenamiento', 'plan_id', ep.id)
            if (err) errores.push(err)
        }
        const errEntreno = await borrar('planes_entrenamiento', 'cliente_id', id)
        if (errEntreno) errores.push(errEntreno)

        // Finally delete the client record
        const { error: deleteError } = await supabase.from('clientes').delete().eq('id', id)
        if (deleteError) {
            errores.push(`Error al eliminar cliente: ${deleteError.message}`)
            return NextResponse.json({ ok: false, errores }, { status: 500 })
        }

        return NextResponse.json({ ok: true, errores: errores.length > 0 ? errores : undefined })
    } catch (error) {
        console.error('Error en DELETE /api/clientes/[id]:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Auth
        const authSupabase = createApiSupabase(request)
        const { data: { user }, error: authError } = await authSupabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const { id } = await params

        // 2. Body
        const body = await request.json()
        const { cliente_id, nombre } = body
        if (!cliente_id || !nombre) {
            return NextResponse.json({ error: 'cliente_id y nombre son obligatorios' }, { status: 400 })
        }

        const admin = createServiceSupabase()

        // 3. Verificar que la plantilla pertenece al coach
        const { data: plantilla, error: plantillaError } = await admin
            .from('plantillas_entrenamiento')
            .select('id, coach_id')
            .eq('id', id)
            .single()

        if (plantillaError || !plantilla) {
            return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 })
        }
        if (plantilla.coach_id !== user.id) {
            return NextResponse.json({ error: 'No tienes permiso sobre esta plantilla' }, { status: 403 })
        }

        // 4. Obtener sesiones y ejercicios de la plantilla
        const { data: sesiones, error: sesionesError } = await admin
            .from('plantilla_sesiones')
            .select('*, ejercicios:plantilla_sesion_ejercicios(*)')
            .eq('plantilla_id', id)
            .order('orden')

        if (sesionesError) {
            return NextResponse.json({ error: 'Error al obtener sesiones de la plantilla' }, { status: 500 })
        }

        // 5. Crear el plan de entrenamiento
        const { data: plan, error: planError } = await admin
            .from('planes_entrenamiento')
            .insert({
                coach_id: user.id,
                cliente_id,
                nombre,
                activo: true,
            })
            .select('id')
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: 'Error al crear el plan de entrenamiento' }, { status: 500 })
        }

        // 6. Insertar sesiones y ejercicios
        for (const sesion of sesiones ?? []) {
            const { data: sesionInsertada, error: sesionInsertError } = await admin
                .from('sesiones_entrenamiento')
                .insert({
                    plan_id: plan.id,
                    nombre: sesion.nombre,
                    dia_semana: sesion.dia_semana,
                    orden: sesion.orden,
                    notas: sesion.descripcion ?? null,
                })
                .select('id')
                .single()

            if (sesionInsertError || !sesionInsertada) {
                // Si falla una sesión, eliminamos el plan creado para evitar datos huérfanos
                await admin.from('planes_entrenamiento').delete().eq('id', plan.id)
                return NextResponse.json({ error: 'Error al insertar sesión de entrenamiento' }, { status: 500 })
            }

            const ejercicios = (sesion.ejercicios ?? []) as any[]
            for (const ej of ejercicios) {
                const { error: ejInsertError } = await admin
                    .from('sesion_ejercicios')
                    .insert({
                        sesion_id: sesionInsertada.id,
                        ejercicio_id: ej.ejercicio_id,
                        series: ej.series,
                        repeticiones: ej.repeticiones ?? '8-12',
                        descanso_segundos: ej.descanso_segundos ?? 90,
                        peso_sugerido: ej.carga_valor?.toString() ?? '',
                        notas: ej.notas_tecnicas ?? '',
                        orden: ej.orden,
                    })

                if (ejInsertError) {
                    await admin.from('planes_entrenamiento').delete().eq('id', plan.id)
                    return NextResponse.json({ error: 'Error al insertar ejercicio' }, { status: 500 })
                }
            }
        }

        return NextResponse.json({ ok: true, plan_id: plan.id })
    } catch (error) {
        console.error('Error POST /api/plantillas-entreno/[id]/asignar:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

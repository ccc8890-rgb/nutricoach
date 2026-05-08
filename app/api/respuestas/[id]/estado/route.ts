import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

// Estados válidos según el nuevo schema extendido
const ESTADOS_VALIDOS = ['nueva', 'procesando', 'dieta_lista', 'dieta_aprobada', 'dieta_rechazada']

// PUT /api/respuestas/[id]/estado — Cambiar estado de una respuesta
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const body = await request.json()
        const { estado } = body

        if (!estado || !ESTADOS_VALIDOS.includes(estado)) {
            return NextResponse.json({
                error: `Estado inválido. Valores: ${ESTADOS_VALIDOS.join(', ')}`,
            }, { status: 400 })
        }

        const updates: Record<string, unknown> = {
            estado,
            updated_at: new Date().toISOString(),
        }

        // Si se aprueba la dieta, generar código público automáticamente
        if (estado === 'dieta_aprobada') {
            // Obtener la respuesta para saber el plan_id
            const { data: respuesta } = await supabase
                .from('respuestas_clientes')
                .select('plan_id')
                .eq('id', id)
                .single()

            if (respuesta?.plan_id) {
                // Generar código público único
                const codigo = generarCodigoPublico()
                updates.codigo_publico = codigo

                // Actualizar el plan con el código público
                await supabase
                    .from('planes_nutricion')
                    .update({ codigo_publico: codigo, updated_at: new Date().toISOString() })
                    .eq('id', respuesta.plan_id)
            }
        }

        const { data, error } = await supabase
            .from('respuestas_clientes')
            .update(updates)
            .eq('id', id)
            .eq('coach_id', user.id)
            .select()
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
            }
            throw error
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error PUT /api/respuestas/[id]/estado:', error)
        return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 })
    }
}

function generarCodigoPublico(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let codigo = ''
    for (let i = 0; i < 12; i++) {
        codigo += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return codigo
}

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { construirPromptAjusteMacros, recalcularMacrosIA } from '@/lib/deepseek'
import { registrarInteraccionIA } from '@/lib/ia-logger'

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id } = await params

        // 0. Verificar autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 1. Obtener datos del cliente
        const { data: cliente, error: errCliente } = await supabase
            .from('clientes')
            .select('*, profile:profiles!profile_id(nombre, apellidos)')
            .eq('id', id)
            .single()

        if (errCliente || !cliente) {
            return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
        }

        // 2. Obtener el plan activo del cliente
        const { data: plan, error: errPlan } = await supabase
            .from('planes_nutricion')
            .select('*')
            .eq('cliente_id', id)
            .eq('activo', true)
            .single()

        if (errPlan || !plan) {
            return NextResponse.json({ error: 'El cliente no tiene un plan activo' }, { status: 400 })
        }

        // 3. Obtener histórico de peso (últimos 10 registros)
        const { data: pesoData } = await supabase
            .from('seguimiento_peso')
            .select('fecha, peso')
            .eq('cliente_id', id)
            .order('fecha', { ascending: false })
            .limit(10)

        // 4. Obtener check-ins (últimos 5)
        const { data: checkinsData } = await supabase
            .from('checkins')
            .select('adherencia, energia')
            .eq('cliente_id', id)
            .order('fecha', { ascending: false })
            .limit(5)

        // 5. Construir prompt y llamar a DeepSeek
        const prompt = construirPromptAjusteMacros(
            {
                nombre: cliente.profile?.nombre || '',
                peso_inicial: cliente.peso_inicial,
                altura: cliente.altura,
                edad: cliente.edad,
                sexo: cliente.sexo,
                objetivo: cliente.objetivo,
            },
            {
                nombre: plan.nombre,
                kcal_objetivo: plan.kcal_objetivo,
                proteinas_objetivo: plan.proteinas_objetivo,
                carbohidratos_objetivo: plan.carbohidratos_objetivo,
                grasas_objetivo: plan.grasas_objetivo,
            },
            (pesoData ?? []).reverse(), // orden cronológico
            checkinsData ?? []
        )

        const { data: sugerencia, total_tokens: totalTokens } = await recalcularMacrosIA(prompt)

        // 6. Loguear interacción IA (con tokens)
        registrarInteraccionIA({
            coachId: user.id,
            clienteId: id,
            tipo: 'ajuste_macros',
            prompt,
            respuestaJson: sugerencia as unknown as Record<string, unknown>,
            planId: plan.id,
            tokensUsados: totalTokens,
        }).catch(err => console.error('[ia-logger] Error al registrar ajuste macros:', err))

        return NextResponse.json({
            sugerencia,
            planActual: {
                kcal: plan.kcal_objetivo,
                proteinas: plan.proteinas_objetivo,
                carbohidratos: plan.carbohidratos_objetivo,
                grasas: plan.grasas_objetivo,
            },
        })
    } catch (error) {
        console.error('Error recalcular macros:', error)
        const message = error instanceof Error ? error.message : 'Error interno'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

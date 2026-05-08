import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id: clienteId } = await params
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 1. Obtener todos los planes de nutrición de este cliente
        const { data: planes, error: planesError } = await supabase
            .from('planes_nutricion')
            .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, activo, codigo_publico, generado_por_ia, created_at')
            .eq('cliente_id', clienteId)
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })

        if (planesError) {
            console.error('Error obteniendo planes:', planesError)
            return NextResponse.json({ error: 'Error al obtener planes' }, { status: 500 })
        }

        if (!planes || planes.length === 0) {
            return NextResponse.json({ data: [] })
        }

        const planIds = planes.map(p => p.id)

        // 2. Obtener respuestas que tengan esos plan_ids
        const { data: respuestas, error: respError } = await supabase
            .from('respuestas_clientes')
            .select('id, estado, nombre_cliente, email_cliente, plan_id, codigo_publico, created_at, updated_at')
            .eq('coach_id', user.id)
            .in('plan_id', planIds)
            .order('created_at', { ascending: false })

        if (respError) {
            console.error('Error obteniendo respuestas:', respError)
            return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 })
        }

        // 3. Obtener comidas por plan para enriquecer
        const { data: comidasData } = await supabase
            .from('comidas')
            .select('plan_id, id, nombre')
            .in('plan_id', planIds)

        const comidasPorPlan: Record<string, any[]> = {}
        for (const c of comidasData ?? []) {
            if (!comidasPorPlan[c.plan_id]) comidasPorPlan[c.plan_id] = []
            comidasPorPlan[c.plan_id].push(c)
        }

        // 4. Combinar datos: cada plan lleva su info de macros + la respuesta asociada
        const historial = planes.map(plan => {
            const respuesta = respuestas?.find(r => r.plan_id === plan.id) ?? null
            return {
                plan,
                respuesta,
                num_comidas: comidasPorPlan[plan.id]?.length ?? 0,
                es_generado_ia: plan.generado_por_ia ?? false, // Usa el campo directo de BD
            }
        })

        return NextResponse.json({ data: historial })
    } catch (error) {
        console.error('Error en GET /api/clientes/[id]/historial-ia:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { id: clienteId } = await params
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        const coachId = user.id

        // 1. Obtener registros_ia de la BD
        const { data: registros } = await supabase
            .from('registros_ia')
            .select('*')
            .eq('cliente_id', clienteId)
            .eq('coach_id', coachId)
            .order('created_at', { ascending: false })

        // 2. Obtener planes de nutrición (para enriquecer)
        const { data: planes } = await supabase
            .from('planes_nutricion')
            .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo, activo, codigo_publico, created_at')
            .eq('cliente_id', clienteId)
            .order('created_at', { ascending: false })

        const planesMap = new Map((planes ?? []).map(p => [p.id, p]))

        // 3. Enriquecer cada registro con info del plan asociado
        const conversaciones = (registros ?? []).map(r => {
            const plan = r.plan_id ? planesMap.get(r.plan_id) : null

            let resumen = ''
            const tipo = r.tipo
            const resp = r.respuesta_json

            if (tipo === 'dieta' && resp) {
                const r2 = resp as any
                resumen = `Dieta "${r2.nombre || plan?.nombre || 'Sin nombre'}" — ${r2.macros_totales?.kcal ?? plan?.kcal_objetivo ?? '?'} kcal`
            } else if (tipo === 'informe_semanal' && resp) {
                const r2 = resp as any
                resumen = r2.resumen
                    ? r2.resumen.slice(0, 150)
                    : `Informe semanal — ${r2.estado || 'sin estado'}`
            } else if (tipo === 'ajuste_macros' && resp) {
                const r2 = resp as any
                if (r2.sugerencia) {
                    resumen = `Ajuste macros: ${r2.sugerencia.kcal} kcal (P:${r2.sugerencia.proteinas} C:${r2.sugerencia.carbohidratos} G:${r2.sugerencia.grasas})`
                } else if (r2.kcal) {
                    resumen = `Ajuste macros: ${r2.kcal} kcal`
                } else {
                    resumen = 'Ajuste de macros'
                }
            } else {
                resumen = `Interacción de tipo ${tipo}`
            }

            return {
                id: r.id,
                tipo: r.tipo,
                prompt: r.prompt,
                respuesta: r.respuesta_json,
                resumen,
                modelo: r.modelo,
                tokens_usados: r.tokens_usados,
                created_at: r.created_at,
                plan: plan ? {
                    id: plan.id,
                    nombre: plan.nombre,
                    activo: plan.activo,
                } : null,
            }
        })

        // 4. Obtener info del cliente
        const { data: cliente } = await supabase
            .from('clientes')
            .select('id, nombre, objetivo')
            .eq('id', clienteId)
            .single()

        return NextResponse.json({
            data: conversaciones,
            meta: {
                cliente: cliente
                    ? { id: cliente.id, nombre: (cliente as any).nombre, objetivo: (cliente as any).objetivo }
                    : null,
                total: conversaciones.length,
                tipos: {
                    dieta: conversaciones.filter(c => c.tipo === 'dieta').length,
                    informe_semanal: conversaciones.filter(c => c.tipo === 'informe_semanal').length,
                    ajuste_macros: conversaciones.filter(c => c.tipo === 'ajuste_macros').length,
                    recomendacion: conversaciones.filter(c => c.tipo === 'recomendacion').length,
                },
            },
        })
    } catch (error) {
        console.error('Error en GET /api/clientes/[id]/conversaciones-ia:', error)
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
    }
}

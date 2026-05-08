import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params

        // 1. Buscar plan por código público
        const { data: plan, error: planError } = await supabase
            .from('planes_nutricion')
            .select('*, comidas(*, alimentos:comida_alimentos(*, alimento:alimentos(*)))')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (planError || !plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        const clienteId = plan.cliente_id

        // 2. Obtener datos del cliente (si tiene cliente asignado)
        let cliente = null
        if (clienteId) {
            const { data: c } = await supabase
                .from('clientes')
                .select('id, nombre, objetivo, peso_inicial, fecha_proxima_revision')
                .eq('id', clienteId)
                .single()
            cliente = c
        }

        // 3. Plan de entrenamiento activo (si tiene cliente)
        let entreno = null
        if (clienteId) {
            const { data: e } = await supabase
                .from('planes_entrenamiento')
                .select('*, sesiones:sesiones_entrenamiento(*, ejercicios:sesion_ejercicios(*, ejercicio:ejercicios(*)))')
                .eq('cliente_id', clienteId)
                .eq('activo', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            entreno = e || null
        }

        // 4. Check-ins (últimos 10) — buscar por plan_id si no hay cliente
        let checkins: any[] = []
        if (clienteId) {
            const { data: c } = await supabase
                .from('checkins')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('fecha', { ascending: false })
                .limit(10)
            checkins = c ?? []
        }

        // 5. Historial de peso (últimos 20)
        let peso: any[] = []
        if (clienteId) {
            const { data: p } = await supabase
                .from('seguimiento_peso')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('fecha', { ascending: false })
                .limit(20)
            peso = p ?? []
        }

        // 6. Notas del coach
        let notas: any[] = []
        if (clienteId) {
            const { data: n } = await supabase
                .from('notas_coach')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('created_at', { ascending: false })
                .limit(20)
            notas = n ?? []
        }

        return NextResponse.json({
            plan: {
                ...plan,
                comidas: (plan.comidas ?? []).sort((a: any, b: any) => a.orden - b.orden),
            },
            cliente,
            entreno,
            checkins,
            peso,
            notas,
        })
    } catch (err) {
        console.error('Error en dashboard:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

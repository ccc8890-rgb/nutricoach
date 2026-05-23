import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

interface ComidaOrdenable {
    orden: number
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = createServiceSupabase()
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
                .select('id, objetivo, peso_inicial, fecha_proxima_revision, onboarding_completado, profiles(nombre, apellidos)')
                .eq('id', clienteId)
                .single()
            if (c) {
                const p = c.profiles as { nombre?: string; apellidos?: string } | null
                cliente = {
                    ...c,
                    nombre: p?.nombre ?? null,
                    apellidos: p?.apellidos ?? null,
                }
            }
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
        let checkins: unknown[] = []
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
        let peso: unknown[] = []
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
        let notas: unknown[] = []
        if (clienteId) {
            const { data: n } = await supabase
                .from('notas_coach')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('created_at', { ascending: false })
                .limit(20)
            notas = n ?? []
        }

        // 7. Registros de comidas de hoy (S3)
        let registros_comidas: unknown[] = []
        if (clienteId) {
            const hoy = new Date().toLocaleDateString('en-CA')
            const { data: r } = await supabase
                .from('registro_comidas_dia')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('fecha', hoy)
            registros_comidas = r ?? []
        }

        return NextResponse.json({
            plan: {
                ...plan,
                comidas: ((plan.comidas ?? []) as ComidaOrdenable[]).sort((a, b) => a.orden - b.orden),
            },
            cliente,
            entreno,
            checkins,
            peso,
            notas,
            registros_comidas,
        })
    } catch (err) {
        console.error('Error en dashboard:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

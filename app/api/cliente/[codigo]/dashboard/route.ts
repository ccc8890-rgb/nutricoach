import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { inferirSlotComida, tipoPlatoCompatibleConSlot } from '@/lib/tipos-comida'

interface ComidaOrdenable {
    orden: number
    nombre?: string | null
    receta_id?: string | null
    alternativas_receta_ids?: string[] | null
}

interface RecetaAlternativaCliente {
    id: string
    nombre: string
    imagen_url?: string | null
    kcal?: number | null
    proteinas?: number | null
    tiempo_prep_min?: number | null
    tipo_plato?: string | null
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
            .select(`
                *,
                comidas(
                    *,
                    receta:recetas(id, nombre, imagen_url, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min),
                    alimentos:comida_alimentos(*, alimento:alimentos(*))
                )
            `)
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
                .select('id, objetivo, peso_inicial, fecha_proxima_revision, onboarding_completado, profile_id')
                .eq('id', clienteId)
                .single()
            if (c) {
                let nombre = null
                let apellidos = null
                if (c.profile_id) {
                    const { data: p } = await supabase
                        .from('profiles')
                        .select('nombre, apellidos')
                        .eq('id', c.profile_id)
                        .single()
                    nombre = p?.nombre ?? null
                    apellidos = p?.apellidos ?? null
                }
                cliente = { ...c, nombre, apellidos }
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

        // 7. Registros de comidas de la semana actual (S3)
        let registros_comidas: unknown[] = []
        if (clienteId) {
            const hoy = new Date()
            const day = hoy.getDay()
            const monday = new Date(hoy)
            monday.setDate(hoy.getDate() - (day === 0 ? 6 : day - 1))
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            const desde = monday.toLocaleDateString('en-CA')
            const hasta = sunday.toLocaleDateString('en-CA')
            const { data: r } = await supabase
                .from('registro_comidas_dia')
                .select('*')
                .eq('cliente_id', clienteId)
                .gte('fecha', desde)
                .lte('fecha', hasta)
            registros_comidas = r ?? []
        }

        const comidas = ((plan.comidas ?? []) as ComidaOrdenable[]).sort((a, b) => a.orden - b.orden)
        const alternativaIds = Array.from(new Set(
            comidas.flatMap(comida => (comida.alternativas_receta_ids ?? []).filter(id => id && id !== comida.receta_id)).slice(0, 60)
        ))

        let recetasAlternativas = new Map<string, RecetaAlternativaCliente>()
        if (alternativaIds.length > 0) {
            const { data: recetasAlt } = await supabase
                .from('recetas')
                .select('id, nombre, imagen_url, kcal, proteinas, tiempo_prep_min, tipo_plato')
                .in('id', alternativaIds)
            recetasAlternativas = new Map((recetasAlt ?? []).map(receta => [receta.id, receta]))
        }

        const comidasConAlternativas = comidas.map(comida => {
            const slot = inferirSlotComida(comida.nombre)
            return {
                ...comida,
                alternativa_recetas: (comida.alternativas_receta_ids ?? [])
                .filter(id => id && id !== comida.receta_id)
                .map(id => recetasAlternativas.get(id))
                .filter((receta): receta is RecetaAlternativaCliente =>
                    Boolean(receta) && tipoPlatoCompatibleConSlot(slot, receta?.tipo_plato)
                )
                .slice(0, 3),
            }
        })

        return NextResponse.json({
            plan: {
                ...plan,
                comidas: comidasConAlternativas,
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

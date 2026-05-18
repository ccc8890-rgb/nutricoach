import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { evaluarCheckin } from '@/lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal } from '@/lib/periodizacion/motor-macros'
import { generarFeedbackCheckinIA } from '@/lib/feedback-checkin-ia'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    try {
        const supabase = await createServerSupabase()
        const { codigo } = await params
        const body = await request.json()
        const { peso, adherencia, energia, sueno, notas, foto_url } = body

        // Buscar cliente por código del plan
        const { data: plan } = await supabase
            .from('planes_nutricion')
            .select('cliente_id')
            .eq('codigo_publico', codigo)
            .eq('activo', true)
            .single()

        if (!plan) {
            return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
        }

        if (!plan.cliente_id) {
            return NextResponse.json({ error: 'Este plan no tiene un cliente asignado. Crea un cliente primero.' }, { status: 400 })
        }

        // Crear check-in
        const { data, error } = await supabase
            .from('checkins')
            .insert({
                cliente_id: plan.cliente_id,
                peso: peso || null,
                adherencia: adherencia || null,
                energia: energia || null,
                sueno: sueno || null,
                notas: notas || null,
                foto_url: foto_url || null,
            })
            .select()
            .single()

        if (error) {
            console.error('Error al crear check-in:', error)
            return NextResponse.json({ error: 'Error al guardar' }, { status: 500 })
        }

        // Si también envió peso, guardarlo en seguimiento_peso
        if (peso) {
            await supabase.from('seguimiento_peso').insert({
                cliente_id: plan.cliente_id,
                peso,
                // Usar fecha en zona horaria local (España UTC+2)
                fecha: new Date().toLocaleDateString('en-CA'),
                notas: 'Check-in semanal',
            })
        }

        // Disparar evaluación de periodización en background (no bloquea la respuesta)
        if (data?.id && plan.cliente_id) {
            dispararEvaluacionPeriodizacion(plan.cliente_id, data.id, {
                energia: energia ?? 3,
                sueno: sueno ?? 7,
                adherencia: adherencia ?? 80,
            }).catch(err => console.error('Error en evaluación periodización:', err))
        }

        // Generar feedback IA en background (no bloquea la respuesta)
        if (data?.id && plan.cliente_id) {
            const db = createServiceSupabase()
            const { data: clienteInfo } = await db
                .from('clientes')
                .select('objetivo, profile:profiles!profile_id(nombre)')
                .eq('id', plan.cliente_id)
                .single()

            const nombreCliente = (clienteInfo?.profile as { nombre?: string } | null)?.nombre ?? 'cliente'
            const objetivoCliente = (clienteInfo as { objetivo?: string | null } | null)?.objetivo ?? null

            generarFeedbackCheckinIA({
                nombre: nombreCliente,
                peso: peso ?? null,
                adherencia: adherencia ?? null,
                energia: energia ?? null,
                sueno: sueno ?? null,
                objetivo: objetivoCliente,
            }).then(async (mensaje) => {
                if (mensaje) {
                    const sdb = createServiceSupabase()
                    await sdb.from('checkins').update({ mensaje_coach_ia: mensaje }).eq('id', data.id)
                }
            }).catch(() => null) // nunca bloquea aunque falle
        }

        return NextResponse.json({ success: true, checkin: data })
    } catch (err) {
        console.error('Error en checkin:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

async function dispararEvaluacionPeriodizacion(
    cliente_id: string,
    checkin_id: string,
    checkinData: { energia: number; sueno: number; adherencia: number }
) {
    const serviceSupabase = createServiceSupabase()

    // TLS semanal
    const { data: tlsData } = await serviceSupabase
        .rpc('get_tls_dashboard', { p_cliente_id: cliente_id })
    const tls_semanal = (tlsData as { tls_semana_actual?: number } | null)?.tls_semana_actual ?? 0

    // Umbral del cliente
    const { data: cliente } = await serviceSupabase
        .from('clientes')
        .select('tls_umbral_carga_alta')
        .eq('id', cliente_id)
        .single()
    const umbral_carga_alta = cliente?.tls_umbral_carga_alta ?? 80

    // Semanas con check-in en los últimos 90 días
    const { data: checkins90 } = await serviceSupabase
        .from('checkins')
        .select('fecha')
        .eq('cliente_id', cliente_id)
        .gte('fecha', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const semanas = new Set(
        (checkins90 ?? []).map((c: { fecha: string }) => {
            const d = new Date(c.fecha)
            const startOfYear = new Date(d.getFullYear(), 0, 1)
            const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
            return `${d.getFullYear()}-W${week}`
        })
    )
    const semanas_en_deficit = semanas.size

    const { evaluarCheckin } = await import('@/lib/periodizacion/arbol-decision')
    const { calcularAjusteCaloricoSemanal } = await import('@/lib/periodizacion/motor-macros')

    const input = {
        energia: checkinData.energia,
        horas_sueno: checkinData.sueno,
        adherencia: checkinData.adherencia,
        tls_semanal,
        semanas_en_deficit,
        umbral_carga_alta,
    }
    const resultado = evaluarCheckin(input)

    let ajuste_macros = null
    if (resultado.accion === 'ajuste_calorico_10pct') {
        const { data: dieta } = await serviceSupabase
            .from('dietas')
            .select('kcal_objetivo, proteinas_objetivo, carbos_objetivo, grasas_objetivo')
            .eq('cliente_id', cliente_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        if (dieta) {
            ajuste_macros = calcularAjusteCaloricoSemanal({
                kcal: dieta.kcal_objetivo ?? 2000,
                proteinas: dieta.proteinas_objetivo ?? 150,
                carbohidratos: dieta.carbos_objetivo ?? 200,
                grasas: dieta.grasas_objetivo ?? 70,
            })
        }
    }

    await serviceSupabase.from('periodizacion_acciones').insert({
        cliente_id,
        checkin_id,
        accion: resultado.accion,
        input_snapshot: input,
        ajuste_macros,
        requiere_aprobacion: resultado.requiere_aprobacion_coach,
        aprobado_por_coach: resultado.requiere_aprobacion_coach ? null : true,
        aplicado: !resultado.requiere_aprobacion_coach,
    })

    // Webhook Make.com si requiere aprobación
    if (resultado.requiere_aprobacion_coach && process.env.MAKE_WEBHOOK_PERIODIZACION) {
        fetch(process.env.MAKE_WEBHOOK_PERIODIZACION, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accion: resultado.accion,
                label: resultado.label,
                cliente_id,
                descripcion: resultado.descripcion,
            }),
        }).catch(() => null)
    }
}

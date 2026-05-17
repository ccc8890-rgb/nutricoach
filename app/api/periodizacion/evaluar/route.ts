import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { evaluarCheckin } from '@/lib/periodizacion/arbol-decision'
import { calcularAjusteCaloricoSemanal } from '@/lib/periodizacion/motor-macros'

export async function POST(request: NextRequest) {
    try {
        const supabase = createApiSupabase(request)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'coach') {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
        }

        const body = await request.json().catch(() => ({}))
        const { cliente_id, checkin_id } = body

        if (!cliente_id) {
            return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
        }

        const serviceSupabase = createServiceSupabase()

        // 1. Obtener datos del cliente (umbral TLS)
        const { data: cliente } = await serviceSupabase
            .from('clientes')
            .select('tls_umbral_carga_alta')
            .eq('id', cliente_id)
            .single()

        const umbral_carga_alta = cliente?.tls_umbral_carga_alta ?? 80

        // 2. TLS de la semana actual via RPC
        const { data: tlsData } = await serviceSupabase
            .rpc('get_tls_dashboard', { p_cliente_id: cliente_id })

        const tls_semanal = (tlsData as { tls_semana_actual?: number } | null)?.tls_semana_actual ?? 0

        // 3. Último check-in del cliente
        let checkinData: { energia?: number; sueno?: number; adherencia?: number } | null = null
        if (checkin_id) {
            const { data } = await serviceSupabase
                .from('checkins')
                .select('energia, sueno, adherencia')
                .eq('id', checkin_id)
                .single()
            checkinData = data
        } else {
            const { data } = await serviceSupabase
                .from('checkins')
                .select('energia, sueno, adherencia')
                .eq('cliente_id', cliente_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            checkinData = data
        }

        if (!checkinData) {
            return NextResponse.json({ error: 'No hay check-ins para este cliente' }, { status: 404 })
        }

        // 4. Calcular semanas en déficit (número de semanas con check-in en últimos 90 días)
        const { data: checkins90 } = await serviceSupabase
            .from('checkins')
            .select('fecha')
            .eq('cliente_id', cliente_id)
            .gte('fecha', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

        // Contar semanas ISO distintas
        const semanas = new Set(
            (checkins90 ?? []).map((c: { fecha: string }) => {
                const d = new Date(c.fecha)
                const startOfYear = new Date(d.getFullYear(), 0, 1)
                const week = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7)
                return `${d.getFullYear()}-W${week}`
            })
        )
        const semanas_en_deficit = semanas.size

        // 5. Ejecutar árbol de decisión
        const input = {
            energia: checkinData.energia ?? 3,
            horas_sueno: checkinData.sueno ?? 7,
            adherencia: checkinData.adherencia ?? 80,
            tls_semanal,
            semanas_en_deficit,
            umbral_carga_alta,
        }
        const resultado = evaluarCheckin(input)

        // 6. Calcular ajuste de macros si aplica
        let ajuste_macros = null
        if (resultado.accion === 'ajuste_calorico_10pct') {
            // Obtener macros base del plan activo
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

        // 7. Guardar acción en BD
        const { data: accionGuardada, error: errGuardar } = await serviceSupabase
            .from('periodizacion_acciones')
            .insert({
                cliente_id,
                checkin_id: checkin_id ?? null,
                accion: resultado.accion,
                input_snapshot: input,
                ajuste_macros,
                requiere_aprobacion: resultado.requiere_aprobacion_coach,
                aprobado_por_coach: resultado.requiere_aprobacion_coach ? null : true,
                aplicado: !resultado.requiere_aprobacion_coach,
            })
            .select()
            .single()

        if (errGuardar) {
            console.error('Error al guardar periodizacion_accion:', errGuardar)
            return NextResponse.json({ error: 'Error al guardar acción' }, { status: 500 })
        }

        // 8. Webhook Make.com (opcional, no bloquea si falla)
        if (
            resultado.requiere_aprobacion_coach &&
            process.env.MAKE_WEBHOOK_PERIODIZACION
        ) {
            fetch(process.env.MAKE_WEBHOOK_PERIODIZACION, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    accion_id: accionGuardada?.id,
                    accion: resultado.accion,
                    label: resultado.label,
                    cliente_id,
                    descripcion: resultado.descripcion,
                }),
            }).catch(err => console.error('Webhook Make.com error:', err))
        }

        return NextResponse.json({
            accion_id: accionGuardada?.id,
            ...resultado,
            ajuste_macros,
            semanas_en_deficit,
            tls_semanal,
        })
    } catch (err) {
        console.error('Error en POST /api/periodizacion/evaluar:', err)
        return NextResponse.json({ error: 'Error interno' }, { status: 500 })
    }
}

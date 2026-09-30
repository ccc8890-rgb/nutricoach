import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { sendPlanListoEmail } from '@/lib/emails/plan-listo'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'

export async function POST(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => null) as { cliente_id?: unknown } | null
    const cliente_id = typeof body?.cliente_id === 'string' ? body.cliente_id.trim() : ''
    if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

    const db = createServiceSupabase()
    const autorizacion = await autorizarCoachCliente(db, { userId: user.id, clienteId: cliente_id })
    if (!autorizacion.ok) {
        return NextResponse.json({
            error: autorizacion.mensaje,
            codigo: autorizacion.codigo,
        }, { status: autorizacion.status })
    }

    const [planNutricion, planEntrenamiento] = await Promise.all([
        db
            .from('planes_nutricion')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', cliente_id)
            .eq('activo', true),
        db
            .from('planes_entrenamiento')
            .select('id', { count: 'exact', head: true })
            .eq('cliente_id', cliente_id)
            .eq('activo', true),
    ])

    if (planNutricion.error || planEntrenamiento.error) {
        console.error('[aprobar-cliente] Error comprobando planes activos:', {
            nutricion: planNutricion.error,
            entrenamiento: planEntrenamiento.error,
        })
        return NextResponse.json({
            error: 'No se pudieron comprobar los planes activos.',
            codigo: 'ACTIVE_PLANS_LOOKUP_FAILED',
            accion: 'Reintenta en unos segundos.',
        }, { status: 500 })
    }

    if ((planNutricion.count ?? 0) < 1 || (planEntrenamiento.count ?? 0) < 1) {
        return NextResponse.json({
            error: 'El cliente necesita un plan activo de nutrición y otro de entrenamiento.',
            codigo: 'ACTIVE_PLANS_REQUIRED',
            accion: 'Activa ambos planes antes de aprobar al cliente.',
        }, { status: 409 })
    }

    // Activar cliente
    const { error, count } = await db
        .from('clientes')
        .update({ revisado_por_coach: true, activo: true }, { count: 'exact' })
        .eq('id', cliente_id)
        .eq('coach_id', user.id)

    if (error || count !== 1) {
        console.error('[aprobar-cliente] No se pudo activar el cliente:', error ?? { count })
        return NextResponse.json({
            error: 'No se pudo activar el cliente.',
            codigo: 'CLIENT_ACTIVATION_FAILED',
            accion: 'Reintenta en unos segundos.',
        }, { status: 500 })
    }

    // Enviar email (no bloquea si falla)
    const warnings: string[] = []
    try {
        if (!autorizacion.cliente.profile_id) throw new Error('El cliente no tiene perfil asociado')

        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('nombre, email')
            .eq('id', autorizacion.cliente.profile_id)
            .single()

        if (profileError) throw profileError
        if (!profile?.email || !profile?.nombre) throw new Error('El perfil no tiene nombre y email completos')

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutricoach-delta.vercel.app'
        const enviado = await sendPlanListoEmail({
            to: profile.email,
            nombre: profile.nombre,
            appUrl,
        })
        if (!enviado) throw new Error('El proveedor no confirmó el envío')
    } catch (emailError) {
        console.warn('[aprobar-cliente] Cliente activado, pero falló el email de plan listo:', emailError)
        warnings.push('WELCOME_EMAIL_FAILED')
    }

    return NextResponse.json({ ok: true, ...(warnings.length ? { warnings } : {}) })
}

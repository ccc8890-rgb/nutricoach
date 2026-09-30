import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { sendPlanListoEmail } from '@/lib/emails/plan-listo'

type AprobarClienteRpcRow = {
    ok: boolean
    codigo: 'CLIENT_APPROVED' | 'CLIENT_NOT_FOUND' | 'CLIENT_NOT_OWNED' | 'ACTIVE_PLANS_REQUIRED'
    mensaje: string
    accion: string | null
    cliente_profile_id: string | null
}

export async function POST(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const body = await request.json().catch(() => null) as { cliente_id?: unknown } | null
    const cliente_id = typeof body?.cliente_id === 'string' ? body.cliente_id.trim() : ''
    if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

    const db = createServiceSupabase()
    const { data: rpcData, error: rpcError } = await db.rpc('aprobar_cliente_atomico', {
        p_cliente_id: cliente_id,
        p_actor_id: user.id,
    })
    const resultado = (rpcData as AprobarClienteRpcRow[] | null)?.[0]

    if (rpcError || !resultado) {
        console.error('[aprobar-cliente] Error en aprobación atómica:', rpcError)
        return NextResponse.json({
            error: 'No se pudo aprobar el cliente.',
            codigo: 'CLIENT_APPROVAL_FAILED',
            accion: 'Reintenta en unos segundos.',
        }, { status: 500 })
    }

    if (!resultado.ok) {
        const status = resultado.codigo === 'CLIENT_NOT_FOUND'
            ? 404
            : resultado.codigo === 'CLIENT_NOT_OWNED'
                ? 403
                : resultado.codigo === 'ACTIVE_PLANS_REQUIRED'
                    ? 409
                    : 500
        return NextResponse.json({
            error: resultado.mensaje,
            codigo: resultado.codigo,
            accion: resultado.accion,
        }, { status })
    }

    // La RPC ya ha confirmado la transacción. El email posterior no bloquea la aprobación.
    const warnings: string[] = []
    try {
        if (!resultado.cliente_profile_id) throw new Error('El cliente no tiene perfil asociado')

        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('nombre, email')
            .eq('id', resultado.cliente_profile_id)
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

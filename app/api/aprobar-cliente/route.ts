import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { sendPlanListoEmail } from '@/lib/emails/plan-listo'

export async function POST(request: NextRequest) {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { cliente_id } = await request.json() as { cliente_id: string }
    if (!cliente_id) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })

    const db = createServiceSupabase()

    // Activar cliente
    const { error } = await db
        .from('clientes')
        .update({ revisado_por_coach: true, activo: true })
        .eq('id', cliente_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Enviar email (no bloquea si falla)
    const { data: perfil } = await db
        .from('clientes')
        .select('profile_id')
        .eq('id', cliente_id)
        .single()

    let email: string | null = null
    let nombre: string | null = null
    if (perfil?.profile_id) {
        const { data: profile } = await db
            .from('profiles')
            .select('nombre, email')
            .eq('id', perfil.profile_id)
            .single()
        email = profile?.email ?? null
        nombre = profile?.nombre ?? null
    }

    if (email && nombre) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://nutricoach-delta.vercel.app'
        await sendPlanListoEmail({ to: email, nombre, appUrl })
    }

    return NextResponse.json({ ok: true })
}

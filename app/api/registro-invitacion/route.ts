import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { token, nombre, apellidos, email, password } = body

    if (!token || !nombre || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const supabase = createServiceSupabase()

    // Verificar token
    const { data: invitacion, error: invError } = await supabase
      .from('invitaciones')
      .select('token, usado, expires_at, coach_id, email')
      .eq('token', token)
      .single()

    if (invError || !invitacion) {
      return NextResponse.json({ error: 'Token no encontrado' }, { status: 400 })
    }

    if (invitacion.usado) {
      return NextResponse.json({ error: 'Token ya usado' }, { status: 400 })
    }

    if (new Date(invitacion.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 400 })
    }

    // Crear usuario en Auth
    const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { nombre, apellidos, role: 'cliente' },
      email_confirm: true,
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const profileId = newUser.user.id

    if (apellidos) {
      await supabaseAdmin.from('profiles').update({ apellidos }).eq('id', profileId)
    }

    // Insertar cliente con revisado_por_coach = false
    const { error: clienteError } = await supabaseAdmin.from('clientes').insert({
      profile_id: profileId,
      coach_id: invitacion.coach_id,
      revisado_por_coach: false,
    })

    if (clienteError) {
      return NextResponse.json({ error: clienteError.message }, { status: 400 })
    }

    // Marcar token como usado
    await supabaseAdmin.from('invitaciones').update({ usado: true }).eq('token', token)

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al procesar el registro' }, { status: 500 })
  }
}

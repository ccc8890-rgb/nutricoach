import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, createApiSupabase } from '@/lib/supabase-server'
import { sendWelcomeEmail } from '@/lib/emails/welcome'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { token, modo, nombre, apellidos, email, password } = body

    if (!token) {
      return NextResponse.json({ error: 'Falta el token' }, { status: 400 })
    }

    // ─── MODO VINCULAR: usuario ya autenticado vía OAuth/magic link ───
    if (modo === 'vincular') {
      const authSupabase = createApiSupabase(req)
      const { data: { user } } = await authSupabase.auth.getUser()
      if (!user) {
        return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
      }

      const supabase = createServiceSupabase()

      const { data: invitacion, error: invError } = await supabase
        .from('invitaciones')
        .select('token, usado, expires_at, coach_id')
        .eq('token', token)
        .single()

      if (invError || !invitacion) return NextResponse.json({ error: 'Token no encontrado' }, { status: 400 })
      if (invitacion.usado) return NextResponse.json({ error: 'Token ya usado' }, { status: 400 })
      if (new Date(invitacion.expires_at) < new Date()) return NextResponse.json({ error: 'Token expirado' }, { status: 400 })

      const { data: marcado } = await supabase
        .from('invitaciones')
        .update({ usado: true })
        .eq('token', token)
        .eq('usado', false)
        .select('id')

      if (!marcado || marcado.length === 0) {
        return NextResponse.json({ error: 'Token ya usado' }, { status: 400 })
      }

      const fullName = user.user_metadata?.full_name as string | undefined
      await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        nombre: fullName ?? 'Cliente',
        role: 'cliente',
      })

      const { error: clienteError } = await supabaseAdmin.from('clientes').insert({
        profile_id: user.id,
        coach_id: invitacion.coach_id,
        revisado_por_coach: false,
      })

      if (clienteError) {
        return NextResponse.json({ error: 'Error al crear el perfil de cliente' }, { status: 400 })
      }

      // Enviar email de bienvenida
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      sendWelcomeEmail({
        to: user.email ?? email,
        nombre: fullName ?? 'Cliente',
        appUrl,
      })

      return NextResponse.json({ ok: true })
    }

    // ─── MODO CONTRASEÑA (flujo original) ────────────────────────────

    if (!nombre || !email || !password) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
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

    // Marcar como usado ANTES de crear el usuario — evita race condition si llegan dos peticiones simultáneas
    // El UPDATE solo actualiza si usado=false; si devuelve 0 filas, otro request ya lo usó
    const { data: marcado } = await supabase
      .from('invitaciones')
      .update({ usado: true })
      .eq('token', token)
      .eq('usado', false)
      .select('id')

    if (!marcado || marcado.length === 0) {
      return NextResponse.json({ error: 'Token ya usado' }, { status: 400 })
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
      // Revertir: borrar usuario Auth para no dejar huérfanos
      await supabaseAdmin.auth.admin.deleteUser(profileId)
      return NextResponse.json({ error: 'Error al crear el perfil de cliente' }, { status: 400 })
    }

    // Enviar email de bienvenida
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    sendWelcomeEmail({
      to: email,
      nombre: nombre,
      appUrl,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al procesar el registro' }, { status: 500 })
  }
}

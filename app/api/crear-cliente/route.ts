import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    // 🔐 Verificar que quien llama es un coach autenticado
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario tiene rol de coach
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Solo los coaches pueden crear clientes' }, { status: 403 })
    }

    const body = await req.json()
    const { nombre, apellidos, email, password, objetivo, nivel, peso_inicial, altura, edad, sexo, restricciones_alimentarias, notas } = body

    // Validar campos obligatorios
    if (!nombre || !email || !password) {
      return NextResponse.json({ error: 'nombre, email y password son obligatorios' }, { status: 400 })
    }

    // Crear usuario en Auth con service role (no afecta la sesión del coach)
    const { data: newUser, error: authError2 } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { nombre, apellidos, role: 'cliente' },
      email_confirm: true,
    })

    if (authError2) return NextResponse.json({ error: authError2.message }, { status: 400 })

    const profileId = newUser.user.id

    // Actualizar apellidos en profiles (el trigger ya creó el registro base)
    if (apellidos) {
      await supabaseAdmin.from('profiles').update({ apellidos }).eq('id', profileId)
    }

    // Crear registro en clientes
    const { error: clienteError } = await supabaseAdmin.from('clientes').insert({
      profile_id: profileId,
      coach_id: user.id,
      objetivo: objetivo || null,
      nivel: nivel || null,
      peso_inicial: peso_inicial ? parseFloat(peso_inicial) : null,
      altura: altura ? parseFloat(altura) : null,
      edad: edad ? parseInt(edad) : null,
      sexo: sexo || null,
      restricciones_alimentarias: restricciones_alimentarias || null,
      notas: notas || null,
    })

    if (clienteError) return NextResponse.json({ error: clienteError.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

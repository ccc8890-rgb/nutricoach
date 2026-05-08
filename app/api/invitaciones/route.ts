import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = createApiSupabase(req)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar rol coach
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'coach') {
      return NextResponse.json({ error: 'Solo los coaches pueden invitar' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const { email } = body

    const { data, error } = await supabase
      .from('invitaciones')
      .insert({ coach_id: user.id, email: email || null })
      .select('token')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const url = base + '/registro/' + data.token

    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

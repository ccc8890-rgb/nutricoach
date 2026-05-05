import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const supabase = createServiceSupabase()
    const { data, error } = await supabase
      .from('invitaciones')
      .select('token, usado, expires_at, email')
      .eq('token', params.token)
      .single()

    if (error || !data) {
      return NextResponse.json({ valido: false, motivo: 'no_encontrado' })
    }

    if (data.usado) {
      return NextResponse.json({ valido: false, motivo: 'usado' })
    }

    if (new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ valido: false, motivo: 'expirado' })
    }

    return NextResponse.json({ valido: true, email: data.email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}

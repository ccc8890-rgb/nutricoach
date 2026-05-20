import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceSupabase()
  await service
    .from('clientes')
    .update({ last_portal_access: new Date().toISOString() })
    .eq('profile_id', user.id)

  return NextResponse.json({ ok: true })
}

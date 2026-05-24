import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase } from '@/lib/supabase-server'
import { googleFitProvider } from '@/lib/integraciones/google-fit'

export async function GET(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const clienteId = req.nextUrl.searchParams.get('cliente_id')
  if (!clienteId) return NextResponse.json({ error: 'cliente_id requerido' }, { status: 400 })
  return NextResponse.redirect(googleFitProvider.getAuthUrl(clienteId, user.id))
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

// Sesión + rol coach. Devuelve el cliente de servicio y el id del coach, o la respuesta de error.
export async function autorizarCoachRecetas(req: NextRequest) {
  const supabase = createApiSupabase(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const srv = createServiceSupabase()
  const { data: perfil } = await srv.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (perfil?.role !== 'coach') return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) }
  return { srv, coachId: user.id }
}

export function idsValidos(x: unknown, max = 100): string[] | null {
  if (!Array.isArray(x) || x.length === 0 || x.length > max) return null
  const ids = x.filter((i): i is string => typeof i === 'string' && /^[0-9a-f-]{36}$/i.test(i))
  return ids.length === x.length ? [...new Set(ids)] : null
}

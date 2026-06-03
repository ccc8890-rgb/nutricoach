import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

async function isCoach(db: ReturnType<typeof createServiceSupabase>, userId: string) {
  const { data } = await db
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  return data?.role === 'coach'
}

export async function GET(request: NextRequest) {
  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim()
  const grupo = searchParams.get('grupo')?.trim()

  const db = createServiceSupabase()
  if (!await isCoach(db, user.id)) {
    return NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 })
  }

  let q = db
    .from('ejercicios')
    .select('id, nombre, grupo_muscular, tipo, descripcion, foto_url, video_url, video_tipo, dificultad_nivel, equipamiento, musculos_secundarios')
    .order('nombre')
    .limit(500)

  if (query) q = q.ilike('nombre', `%${query}%`)
  if (grupo) q = q.eq('grupo_muscular', grupo)

  const { data, error } = await q
  if (error) {
    console.error('[GET /api/ejercicios/media]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ejercicios: data ?? [] })
}

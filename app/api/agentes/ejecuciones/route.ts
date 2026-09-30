import { NextRequest, NextResponse } from 'next/server'
import { normalizarLimiteEjecuciones } from '@/lib/agentes/ejecuciones'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'coach') {
    return NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 })
  }

  const limite = normalizarLimiteEjecuciones(new URL(request.url).searchParams.get('limite'))
  const db = createServiceSupabase()
  const { data, error } = await db
    .from('agente_ejecuciones')
    .select('id, modo, origen, dry_run, estado, clientes_procesados, tareas_generadas, errores, duracion_ms, iniciado_at, finalizado_at')
    .order('iniciado_at', { ascending: false })
    .limit(limite)

  if (error) {
    console.error('[agentes/ejecuciones]', error)
    return NextResponse.json({ error: 'No se pudo cargar el historial' }, { status: 500 })
  }

  return NextResponse.json({ ejecuciones: data ?? [] })
}

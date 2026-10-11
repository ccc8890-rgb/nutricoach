import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { evaluarSistema, type EjecucionAgente, type IntegracionSync } from '@/lib/sistema/estado'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'coach') return NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 })

  const db = createServiceSupabase()
  const [ejec, integ] = await Promise.all([
    db.from('agente_ejecuciones').select('modo, origen, dry_run, estado, errores, iniciado_at').order('iniciado_at', { ascending: false }).limit(40),
    db.from('integraciones_cliente').select('proveedor, ultima_sync, error_ultimo').eq('activa', true),
  ])
  if (ejec.error || integ.error) {
    console.error('[sistema/estado]', ejec.error ?? integ.error)
    return NextResponse.json({ error: 'No se pudo comprobar el estado' }, { status: 500 })
  }
  return NextResponse.json(evaluarSistema({
    ejecuciones: (ejec.data ?? []) as EjecucionAgente[],
    integraciones: (integ.data ?? []) as IntegracionSync[],
  }))
}

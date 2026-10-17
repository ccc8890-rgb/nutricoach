import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { evaluarSistema, type CronRegistro, type EjecucionAgente, type IntegracionSync } from '@/lib/sistema/estado'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'coach') return NextResponse.json({ error: 'Acceso restringido al coach' }, { status: 403 })

  const db = createServiceSupabase()
  const [ejec, integ, crons] = await Promise.all([
    db.from('agente_ejecuciones').select('modo, origen, dry_run, estado, errores, iniciado_at').order('iniciado_at', { ascending: false }).limit(40),
    db.from('integraciones_cliente').select('cliente_id, proveedor, ultima_sync, error_ultimo').eq('activa', true),
    db.from('cron_ejecuciones').select('cron, estado, detalle, ejecutado_at').order('ejecutado_at', { ascending: false }).limit(100),
  ])
  if (ejec.error || integ.error || crons.error) {
    console.error('[sistema/estado]', ejec.error ?? integ.error ?? crons.error)
    return NextResponse.json({ error: 'No se pudo comprobar el estado' }, { status: 500 })
  }
  const ids = [...new Set((integ.data ?? []).map(i => i.cliente_id).filter(Boolean))]
  const nombres = new Map<string, string>()
  if (ids.length > 0) {
    const { data: cls } = await db.from('clientes').select('id, profile:profiles!profile_id(nombre, apellidos)').in('id', ids)
    for (const c of (cls ?? []) as unknown as { id: string; profile: { nombre?: string; apellidos?: string } | null }[]) {
      const n = [c.profile?.nombre, c.profile?.apellidos].filter(Boolean).join(' ')
      if (n) nombres.set(c.id, n)
    }
  }
  return NextResponse.json(evaluarSistema({
    ejecuciones: (ejec.data ?? []) as EjecucionAgente[],
    integraciones: (integ.data ?? []).map(({ cliente_id, ...i }) => ({ ...i, cliente: nombres.get(cliente_id) ?? null })) as IntegracionSync[],
    crons: (crons.data ?? []) as CronRegistro[],
  }))
}

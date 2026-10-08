import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { resumirNegocio, type ClienteNegocio } from '@/lib/negocio/resumen'

// Guarda una fila diaria por coach con las cifras del dashboard de negocio (idempotente: una por día).
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: 'Service not configured' }, { status: 503 })
  if (request.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceSupabase()
  const { data: coaches, error: errCoaches } = await db.from('profiles').select('id').eq('role', 'coach')
  if (errCoaches) {
    console.error('[cron/snapshot-negocio] coaches', errCoaches)
    return NextResponse.json({ error: 'No se pudieron leer los coaches' }, { status: 500 })
  }

  const ahora = new Date()
  const fecha = ahora.toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' })
  let guardados = 0
  let errores = 0

  for (const coach of coaches ?? []) {
    const { data: clientes, error } = await db
      .from('clientes')
      .select('activo, tipo_membresia, fecha_fin_membresia, plan_tipo, plan_precio, fecha_inicio_plan, pagado_via_stripe')
      .eq('coach_id', coach.id)
    if (error) { console.error('[cron/snapshot-negocio] clientes', coach.id, error); errores++; continue }

    const r = resumirNegocio((clientes ?? []) as ClienteNegocio[], ahora)
    const { error: errUp } = await db.from('negocio_snapshots').upsert({ coach_id: coach.id, fecha, ...r }, { onConflict: 'coach_id,fecha' })
    if (errUp) { console.error('[cron/snapshot-negocio] upsert', coach.id, errUp); errores++ } else guardados++
  }

  return NextResponse.json({ fecha, guardados, errores })
}

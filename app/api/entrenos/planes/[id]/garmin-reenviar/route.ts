// app/api/entrenos/planes/[id]/garmin-reenviar/route.ts
// El coach fuerza el reenvío a Garmin de todo lo programado de un cliente (por si el envío automático falla y el cliente avisa).
// Usa la misma lógica que el cron diario, que borra y recrea sin duplicar.
import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'

export const maxDuration = 300

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const admin = createServiceSupabase()
  const { data: plan } = await admin.from('planes_entrenamiento').select('cliente_id').eq('id', id).maybeSingle()
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  const auth = await autorizarCoachCliente(admin, { userId: user.id, clienteId: plan.cliente_id as string })
  if (!auth.ok) return NextResponse.json({ error: auth.mensaje }, { status: auth.status })

  const secreto = process.env.CRON_SECRET
  if (!secreto) return NextResponse.json({ error: 'Envío no disponible' }, { status: 500 })
  const { GET } = await import('@/app/api/cron/enviar-garmin/route')
  const res = await GET(new NextRequest(`http://localhost/api/cron/enviar-garmin?cliente=${plan.cliente_id}&forzar=1`, { headers: { authorization: `Bearer ${secreto}` } }))
  const r = await res.json() as { enviados?: number; errores?: string[] }
  if (!res.ok) return NextResponse.json({ error: 'No se pudo reenviar a Garmin' }, { status: 502 })
  return NextResponse.json({ enviados: r.enviados ?? 0, errores: r.errores ?? [] })
}

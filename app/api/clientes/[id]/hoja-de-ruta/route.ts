import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { autorizarCoachCliente } from '@/lib/auth/autorizar-coach-cliente'
import { construirHojaDeRuta } from '@/lib/entrenos/hoja-de-ruta'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

// GET /api/clientes/[id]/hoja-de-ruta — previsión del motor (últimas ~8 semanas del plan aprobado o de la propuesta pendiente) frente a lo realizado.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: clienteId } = await params
  const { data: { user } } = await createApiSupabase(request).auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const db = createServiceSupabase()
  const auth = await autorizarCoachCliente(db, { userId: user.id, clienteId })
  if (!auth.ok) return NextResponse.json({ error: auth.mensaje }, { status: auth.status })

  // Lo aprobado manda; si no hay, se enseña la propuesta pendiente (marcada como tal).
  const { data: tareas } = await db.from('agente_tareas').select('estado,payload,created_at').eq('cliente_id', clienteId).eq('tipo', 'plan_entreno_ia')
    .in('estado', ['aprobado', 'modificado', 'pendiente', 'en_revision']).order('created_at', { ascending: false }).limit(10)
  const lista = tareas ?? []
  const elegida = lista.find(t => t.estado === 'aprobado' || t.estado === 'modificado') ?? lista[0]
  const payload = elegida?.payload as PayloadPlanEntrenoIA | undefined
  if (!payload?.macrociclo?.semanas?.length) return NextResponse.json({ origen: null, filas: [] })

  const hoy = new Date().toISOString().slice(0, 10)
  const desde = payload.macrociclo.semanas[0].lunes
  const { data: entrenos } = await db.from('entrenos_realizados').select('fecha,tipo,duracion_s').eq('cliente_id', clienteId).gte('fecha', desde)
  const plan = (payload.plan ?? {}) as Record<string, unknown>
  return NextResponse.json({
    origen: elegida.estado === 'aprobado' || elegida.estado === 'modificado' ? 'aprobada' : 'propuesta',
    generado: elegida.created_at,
    filas: construirHojaDeRuta(payload.macrociclo.semanas, entrenos ?? [], hoy),
    progresion: typeof plan.progresion_semanal === 'string' ? plan.progresion_semanal : null,
    indicadores: Array.isArray(plan.indicadores_mejora) ? plan.indicadores_mejora : [],
    avisos: payload.macrociclo.avisos ?? [],
  })
}

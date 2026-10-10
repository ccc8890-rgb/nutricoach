import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/** Coloca una sesión en la posición de otra del mismo día; la que estaba ahí se desplaza. */
export async function POST(request: NextRequest) {
  const authDb = createApiSupabase(request)
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sesionId: string = body.sesion_id
  const destinoId: string = body.destino_id
  if (!sesionId || !destinoId || sesionId === destinoId) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin.from('clientes').select('id').eq('profile_id', user.id).single()
  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: sesion } = await admin
    .from('sesiones_entrenamiento')
    .select('id, plan_id, dia_semana, plan:planes_entrenamiento!inner(cliente_id)')
    .eq('id', sesionId)
    .single()

  const plan = sesion?.plan as unknown as { cliente_id: string } | null
  if (!sesion || !plan || plan.cliente_id !== clienteData.id) {
    return NextResponse.json({ error: 'Sesión no encontrada en tu plan' }, { status: 404 })
  }

  const { data: delDia } = await admin
    .from('sesiones_entrenamiento')
    .select('id, orden')
    .eq('plan_id', sesion.plan_id)
    .eq('dia_semana', sesion.dia_semana)
    .order('orden')
    .order('id')

  const lista = delDia ?? []
  const pos = lista.findIndex(x => x.id === sesionId)
  const destino = lista.findIndex(x => x.id === destinoId)
  if (pos < 0 || destino < 0) return NextResponse.json({ error: 'La otra sesión no es del mismo día' }, { status: 400 })

  const nuevo = [...lista]
  const [movida] = nuevo.splice(pos, 1)
  nuevo.splice(destino, 0, movida)

  // Reparte las posiciones existentes; si hay empates o nulos, las separa para que el orden sea estable.
  const valores = lista.map(s => s.orden as number | null)
  const distintos = valores.every(v => v !== null) && new Set(valores).size === valores.length
  const base = Math.min(...valores.map(v => v ?? 0))
  const asignados = distintos ? [...(valores as number[])].sort((a, b) => a - b) : nuevo.map((_, i) => base + i)

  const resultados = await Promise.all(
    nuevo.map((s, i) => admin.from('sesiones_entrenamiento').update({ orden: asignados[i] }).eq('id', s.id))
  )
  if (resultados.some(r => r.error)) return NextResponse.json({ error: 'No se pudo cambiar el orden' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

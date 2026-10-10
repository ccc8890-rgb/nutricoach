import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

/** Sube o baja una sesión dentro de su día intercambiando su posición con la vecina. */
export async function POST(request: NextRequest) {
  const authDb = createApiSupabase(request)
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sesionId: string = body.sesion_id
  const direccion: string = body.direccion
  if (!sesionId || (direccion !== 'arriba' && direccion !== 'abajo')) {
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
  const pos = lista.findIndex(s => s.id === sesionId)
  const destino = direccion === 'arriba' ? pos - 1 : pos + 1
  if (pos < 0 || destino < 0 || destino >= lista.length) return NextResponse.json({ ok: true })

  const nuevo = [...lista]
  ;[nuevo[pos], nuevo[destino]] = [nuevo[destino], nuevo[pos]]

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

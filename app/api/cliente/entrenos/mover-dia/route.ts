import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const DIAS_VALIDOS = new Set(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'])

export async function POST(request: NextRequest) {
  const authDb = createApiSupabase(request)
  const { data: { user } } = await authDb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sesionId: string = body.sesion_id
  const diaSemana: string = body.dia_semana

  if (!sesionId || !DIAS_VALIDOS.has(diaSemana)) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })

  const { data: sesion } = await admin
    .from('sesiones_entrenamiento')
    .select('id, plan:planes_entrenamiento!inner(cliente_id, activo)')
    .eq('id', sesionId)
    .single()

  const plan = sesion?.plan as unknown as { cliente_id: string; activo: boolean } | null
  if (!sesion || !plan || plan.cliente_id !== clienteData.id) {
    return NextResponse.json({ error: 'Sesión no encontrada en tu plan' }, { status: 404 })
  }

  const { error } = await admin.from('sesiones_entrenamiento').update({ dia_semana: diaSemana }).eq('id', sesionId)
  if (error) return NextResponse.json({ error: 'No se pudo mover la sesión' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

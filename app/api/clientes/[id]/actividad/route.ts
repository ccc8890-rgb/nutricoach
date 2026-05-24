import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { cargarActividadCoach } from '@/lib/actividad/coach-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: clienteId } = await params
  const { searchParams } = new URL(request.url)
  const dias = Math.min(Math.max(Number(searchParams.get('dias') ?? 14), 7), 60)
  const admin = createServiceSupabase()

  const { data: cliente } = await admin
    .from('clientes')
    .select('id, coach_id')
    .eq('id', clienteId)
    .single()

  if (!cliente || cliente.coach_id !== user.id) {
    return NextResponse.json({ error: 'Sin acceso' }, { status: 403 })
  }

  try {
    const data = await cargarActividadCoach(admin, clienteId, dias)
    return NextResponse.json(data)
  } catch (error) {
    console.error('[GET /api/clientes/[id]/actividad]', error)
    return NextResponse.json({ error: 'Error cargando actividad' }, { status: 500 })
  }
}

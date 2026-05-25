import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { actualizarPerfilDesdeIntercambios } from '@/lib/actualizar-perfil'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const body = await request.json().catch(() => null) as {
    cliente_id?: string
    alimento_original_id?: string
    alternativa_elegida_id?: string
    gramos_original?: number
    gramos_alternativa?: number
  } | null

  if (!body?.alimento_original_id || !body?.alternativa_elegida_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id, cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (body.cliente_id && body.cliente_id !== plan.cliente_id) {
    return NextResponse.json({ error: 'Cliente no coincide con el plan' }, { status: 403 })
  }

  const { error } = await db.from('intercambios_historial').insert({
    cliente_id: plan.cliente_id,
    alimento_original_id: body.alimento_original_id,
    alternativa_elegida_id: body.alternativa_elegida_id,
    gramos_original: body.gramos_original ?? null,
    gramos_alternativa: body.gramos_alternativa ?? null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  actualizarPerfilDesdeIntercambios(plan.cliente_id).catch(console.error)

  return NextResponse.json({ ok: true })
}

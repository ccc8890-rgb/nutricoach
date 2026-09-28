import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarEscrituraPlan } from '@/lib/cliente/autorizar-escritura-plan'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  if (!codigo) {
    return NextResponse.json({ error: 'Código requerido' }, { status: 400 })
  }

  const auth = await autorizarEscrituraPlan(request, codigo)
  if (auth instanceof NextResponse) return auth

  const supabase = createServiceSupabase()

  const { data: plan } = await supabase
    .from('planes_nutricion')
    .select('cliente_id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan?.cliente_id) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  }

  const { error } = await supabase
    .from('clientes')
    .update({ last_portal_access: new Date().toISOString() })
    .eq('id', plan.cliente_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { cliente_id, alimento_original_id, alternativa_elegida_id, gramos_original, gramos_alternativa } = body

  if (!cliente_id || !alimento_original_id || !alternativa_elegida_id) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  const { error } = await supabase.from('intercambios_historial').insert({
    cliente_id,
    alimento_original_id,
    alternativa_elegida_id,
    gramos_original: gramos_original ?? null,
    gramos_alternativa: gramos_alternativa ?? null,
  })

  if (error) return NextResponse.json({ error: 'Error al guardar intercambio' }, { status: 500 })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const ejercicioIds = searchParams.get('ejercicio_ids')
  if (!ejercicioIds) return NextResponse.json({ pesos: [] })

  const ids = ejercicioIds.split(',').filter(Boolean)
  if (!ids.length) return NextResponse.json({ pesos: [] })

  const admin = createServiceSupabase()

  const { data: clienteData } = await admin
    .from('clientes')
    .select('id')
    .eq('profile_id', user.id)
    .single()

  if (!clienteData) return NextResponse.json({ pesos: [] })

  const { data: registros } = await admin
    .from('registros_sets')
    .select('ejercicio_id, sets_ejecutados, fecha')
    .eq('cliente_id', clienteData.id)
    .in('ejercicio_id', ids)
    .order('fecha', { ascending: false })

  if (!registros) return NextResponse.json({ pesos: [] })

  const porEjercicio = new Map<string, { peso: number | null; fecha: string }>()

  for (const reg of registros) {
    if (porEjercicio.has(reg.ejercicio_id)) continue

    const sets = (reg.sets_ejecutados as Array<{ peso_kg?: number; reps?: number }>) ?? []
    const pesosValidos = sets
      .map(s => typeof s.peso_kg === 'number' ? s.peso_kg : null)
      .filter((p): p is number => p !== null && p > 0)

    const ultimoPeso = pesosValidos.length > 0
      ? pesosValidos[pesosValidos.length - 1]
      : null

    porEjercicio.set(reg.ejercicio_id, { peso: ultimoPeso, fecha: reg.fecha })
  }

  const pesos = ids.map(id => ({
    ejercicio_id: id,
    ultimo_peso_kg: porEjercicio.get(id)?.peso ?? null,
    ultima_fecha: porEjercicio.get(id)?.fecha ?? null,
  }))

  return NextResponse.json({ pesos })
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export interface CosteCliente {
  cliente_id: string
  nombre: string
  plan_nombre: string | null
  coste_semanal_min: number   // cheapest supermarket for each ingredient
  coste_semanal_max: number   // most expensive option
  coste_diario: number
  ingredientes_sin_precio: number
  total_ingredientes: number
}

export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const supabase = createServiceSupabase()

  // Fetch all active clients for this coach with their active plans
  const { data: clientes } = await supabase
    .from('clientes')
    .select(`
      id,
      profile:profiles(nombre, apellidos),
      planes:planes_nutricion(
        id,
        nombre,
        activo,
        comidas(
          comida_alimentos(
            cantidad_gramos,
            alimento_id
          )
        )
      )
    `)
    .eq('coach_id', user.id)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!clientes?.length) return NextResponse.json({ costes: [] })

  // Collect all alimento_ids across all plans
  const allAlimentoIds = new Set<string>()
  for (const cliente of clientes) {
    const plan = (cliente.planes as unknown as { id: string; nombre: string; activo: boolean; comidas: { comida_alimentos: { cantidad_gramos: number; alimento_id: string }[] }[] }[])
      ?.find(p => p.activo)
    if (!plan) continue
    for (const comida of plan.comidas ?? []) {
      for (const ca of comida.comida_alimentos ?? []) {
        if (ca.alimento_id) allAlimentoIds.add(ca.alimento_id)
      }
    }
  }

  // Fetch prices for all ingredients in one query
  const { data: precios } = await supabase
    .from('precios_actuales')
    .select('alimento_id, precio_por_kg')
    .in('alimento_id', [...allAlimentoIds])
    .gt('precio_por_kg', 0)

  // Build min/max price maps per alimento
  const precioMin = new Map<string, number>()
  const precioMax = new Map<string, number>()
  for (const p of precios ?? []) {
    const cur = precioMin.get(p.alimento_id)
    if (cur === undefined || p.precio_por_kg < cur) precioMin.set(p.alimento_id, p.precio_por_kg)
    const curMax = precioMax.get(p.alimento_id)
    if (curMax === undefined || p.precio_por_kg > curMax) precioMax.set(p.alimento_id, p.precio_por_kg)
  }

  // Calculate weekly cost per client
  const costes: CosteCliente[] = []
  for (const cliente of clientes) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const perfiles = cliente.profile as any
    const nombre = perfiles
      ? `${perfiles.nombre ?? ''} ${perfiles.apellidos ?? ''}`.trim()
      : `Cliente ${cliente.id.slice(0, 6)}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planes = cliente.planes as any[]
    const plan = planes?.find((p: { activo: boolean }) => p.activo)
    if (!plan) continue

    // Aggregate grams per alimento_id for the plan
    const gramsPorAlimento = new Map<string, number>()
    for (const comida of plan.comidas ?? []) {
      for (const ca of comida.comida_alimentos ?? []) {
        if (!ca.alimento_id) continue
        gramsPorAlimento.set(ca.alimento_id, (gramsPorAlimento.get(ca.alimento_id) ?? 0) + (ca.cantidad_gramos ?? 0))
      }
    }

    // Multiply by 7 (weekly) and calculate cost
    let totalMin = 0
    let totalMax = 0
    let sinPrecio = 0
    for (const [alimentoId, gramos] of gramsPorAlimento) {
      const semanalGramos = gramos * 7
      const minP = precioMin.get(alimentoId)
      const maxP = precioMax.get(alimentoId)
      if (minP !== undefined) {
        totalMin += (semanalGramos / 1000) * minP
        totalMax += (semanalGramos / 1000) * (maxP ?? minP)
      } else {
        sinPrecio++
      }
    }

    costes.push({
      cliente_id: cliente.id,
      nombre,
      plan_nombre: plan.nombre ?? null,
      coste_semanal_min: Math.round(totalMin * 100) / 100,
      coste_semanal_max: Math.round(totalMax * 100) / 100,
      coste_diario: Math.round((totalMin / 7) * 100) / 100,
      ingredientes_sin_precio: sinPrecio,
      total_ingredientes: gramsPorAlimento.size,
    })
  }

  // Sort by cost descending (most expensive clients first — more actionable)
  costes.sort((a, b) => b.coste_semanal_min - a.coste_semanal_min)

  return NextResponse.json({ costes })
}

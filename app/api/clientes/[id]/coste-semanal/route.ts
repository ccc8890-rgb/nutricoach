import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export interface CosteIngrediente {
  alimento_id: string
  nombre: string
  cantidad_gramos: number
  precio_kg: number | null
  coste: number | null
  supermercado: string | null
}

export interface CosteSemanal {
  coste_total: number | null
  cobertura_pct: number
  ingredientes: CosteIngrediente[]
  sin_precio: string[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clienteId } = await params

  const authClient = createApiSupabase(request)
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = createServiceSupabase()

  // 1. Plan activo del cliente
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id')
    .eq('cliente_id', clienteId)
    .eq('activo', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!plan) return NextResponse.json({ error: 'Sin plan activo' }, { status: 404 })

  // 2. Comidas del plan
  const { data: comidas } = await db
    .from('comidas')
    .select('id')
    .eq('plan_id', plan.id)

  if (!comidas?.length) return NextResponse.json({ coste_total: 0, cobertura_pct: 0, ingredientes: [], sin_precio: [] })

  const comidaIds = comidas.map(c => c.id)

  // 3. Alimentos de esas comidas
  const { data: items } = await db
    .from('comida_alimentos')
    .select('alimento_id, cantidad_gramos, alimento:alimentos(nombre)')
    .in('comida_id', comidaIds)

  if (!items?.length) return NextResponse.json({ coste_total: 0, cobertura_pct: 0, ingredientes: [], sin_precio: [] })

  // 4. Agregar cantidades por alimento_id (diario → semanal ×7)
  const agg = new Map<string, { nombre: string; gramos: number }>()
  for (const item of items) {
    const alimento = Array.isArray(item.alimento) ? item.alimento[0] : item.alimento
    const nombre = (alimento as { nombre: string } | null)?.nombre ?? item.alimento_id
    const prev = agg.get(item.alimento_id)
    agg.set(item.alimento_id, {
      nombre,
      gramos: (prev?.gramos ?? 0) + (item.cantidad_gramos ?? 0),
    })
  }

  const alimentoIds = [...agg.keys()]

  // 5. Precios actuales
  const { data: precios } = await db
    .from('precios_actuales')
    .select('alimento_id, precio_por_kg, supermercado_nombre')
    .in('alimento_id', alimentoIds)

  const precioMap = new Map<string, { precio_kg: number; supermercado: string }>()
  for (const p of (precios ?? [])) {
    if (!precioMap.has(p.alimento_id) && p.precio_por_kg > 0) {
      precioMap.set(p.alimento_id, { precio_kg: p.precio_por_kg, supermercado: p.supermercado_nombre })
    }
  }

  // 6. Calcular coste semanal (×7 días)
  const ingredientes: CosteIngrediente[] = []
  const sin_precio: string[] = []
  let coste_total = 0
  let con_precio = 0

  for (const [alimento_id, { nombre, gramos }] of agg.entries()) {
    const gramos_semana = gramos * 7
    const precio = precioMap.get(alimento_id)
    if (precio) {
      const coste = (gramos_semana / 1000) * precio.precio_kg
      coste_total += coste
      con_precio++
      ingredientes.push({ alimento_id, nombre, cantidad_gramos: gramos_semana, precio_kg: precio.precio_kg, coste, supermercado: precio.supermercado })
    } else {
      sin_precio.push(nombre)
      ingredientes.push({ alimento_id, nombre, cantidad_gramos: gramos_semana, precio_kg: null, coste: null, supermercado: null })
    }
  }

  const cobertura_pct = agg.size > 0 ? Math.round((con_precio / agg.size) * 100) : 0

  ingredientes.sort((a, b) => (b.coste ?? -1) - (a.coste ?? -1))

  return NextResponse.json({
    coste_total: Math.round(coste_total * 100) / 100,
    cobertura_pct,
    ingredientes,
    sin_precio,
  } satisfies CosteSemanal)
}

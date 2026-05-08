import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
    const body = await request.json()
    const { comidas, supermercado_id } = body

    if (!comidas || !supermercado_id) {
        return NextResponse.json({ error: 'comidas y supermercado_id son requeridos' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll() { /* readonly */ },
            },
        }
    )

    // Obtener precios del supermercado seleccionado
    const { data: precios } = await supabase
        .from('precios_actuales')
        .select('*')
        .eq('supermercado_id', supermercado_id)

    const mapaPrecios = new Map<string, number>()
    if (precios) {
        for (const p of precios) {
            mapaPrecios.set(p.alimento_id, p.precio_por_kg)
        }
    }

    // Calcular costes
    const alimentosMap = new Map<string, {
        alimento_id: string
        alimento_nombre: string
        categoria: string
        cantidad_total_gramos: number
        precio_por_kg: number
        coste_total_euros: number
    }>()

    const costePorComida: { comida_nombre: string; coste_total: number }[] = []

    for (const comida of comidas) {
        let costeComida = 0
        for (const ca of comida.alimentos ?? []) {
            if (!ca.alimento?.nombre) continue
            const id = ca.alimento?.id ?? ''
            const gramos = ca.cantidad_gramos ?? 0
            const precioKg = mapaPrecios.get(id) ?? 0
            const coste = (gramos / 1000) * precioKg

            costeComida += coste

            if (alimentosMap.has(id)) {
                alimentosMap.get(id)!.cantidad_total_gramos += gramos
                alimentosMap.get(id)!.coste_total_euros = Math.round((alimentosMap.get(id)!.cantidad_total_gramos / 1000) * precioKg * 100) / 100
            } else {
                alimentosMap.set(id, {
                    alimento_id: id,
                    alimento_nombre: ca.alimento.nombre,
                    categoria: ca.alimento.categoria || 'Otros',
                    cantidad_total_gramos: gramos,
                    precio_por_kg: precioKg,
                    coste_total_euros: Math.round(coste * 100) / 100,
                })
            }
        }
        if (costeComida > 0) {
            costePorComida.push({
                comida_nombre: comida.nombre ?? 'Comida',
                coste_total: Math.round(costeComida * 100) / 100,
            })
        }
    }

    const alimentos = Array.from(alimentosMap.values())
    const precioTotal = alimentos.reduce((sum, a) => sum + a.coste_total_euros, 0)

    return NextResponse.json({
        precio_total: Math.round(precioTotal * 100) / 100,
        alimentos,
        coste_por_comida: costePorComida,
    })
}

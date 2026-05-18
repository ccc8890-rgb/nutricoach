import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export interface ItemListaCompra {
    alimento_id: string
    nombre: string
    categoria: string
    cantidad_gramos: number
    comidas_origen: string[]
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ codigo: string }> }
) {
    const { codigo } = await params
    const db = createServiceSupabase()

    const { data: plan } = await db
        .from('planes_nutricion')
        .select('id')
        .eq('codigo_publico', codigo)
        .eq('activo', true)
        .single()

    if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

    const { data: comidas } = await db
        .from('comidas')
        .select('nombre, comida_alimentos(cantidad_gramos, alimento:alimentos(id, nombre, categoria))')
        .eq('plan_id', plan.id)

    if (!comidas?.length) return NextResponse.json({ items: [] })

    // Agregar cantidades por alimento
    const mapa = new Map<string, ItemListaCompra>()
    for (const comida of comidas) {
        const alimentos = comida.comida_alimentos as unknown as {
            cantidad_gramos: number
            alimento: { id: string; nombre: string; categoria: string } | null
        }[]
        for (const ca of alimentos ?? []) {
            if (!ca.alimento) continue
            const { id, nombre, categoria } = ca.alimento
            if (mapa.has(id)) {
                const existing = mapa.get(id)!
                existing.cantidad_gramos += ca.cantidad_gramos
                if (!existing.comidas_origen.includes(comida.nombre)) {
                    existing.comidas_origen.push(comida.nombre)
                }
            } else {
                mapa.set(id, {
                    alimento_id: id,
                    nombre,
                    categoria: categoria ?? 'Otros',
                    cantidad_gramos: ca.cantidad_gramos,
                    comidas_origen: [comida.nombre],
                })
            }
        }
    }

    const items = Array.from(mapa.values()).sort((a, b) =>
        a.categoria.localeCompare(b.categoria) || a.nombre.localeCompare(b.nombre)
    )

    return NextResponse.json({ items })
}

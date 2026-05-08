import { supabase } from './supabase'
import type { Supermercado, PrecioActual, CosteAlimento, CosteComida, CostePorReceta } from '@/types'

// ── Supermercados ─────────────────────────────────────────────

export async function obtenerSupermercados(): Promise<Supermercado[]> {
    const { data } = await supabase
        .from('supermercados')
        .select('*')
        .eq('activo', true)
        .order('nombre')
    return data ?? []
}

export async function obtenerSupermercadoPorSlug(slug: string): Promise<Supermercado | null> {
    const { data } = await supabase
        .from('supermercados')
        .select('*')
        .eq('slug', slug)
        .single()
    return data
}

// ── Precios ───────────────────────────────────────────────────

export async function obtenerPreciosAlimento(alimentoId: string): Promise<PrecioActual[]> {
    const { data } = await supabase
        .from('precios_actuales')
        .select('*')
        .eq('alimento_id', alimentoId)
        .order('precio_por_kg', { ascending: true })
    return data ?? []
}

export async function obtenerPreciosPorSupermercado(supermercadoId: string): Promise<PrecioActual[]> {
    const { data } = await supabase
        .from('precios_actuales')
        .select('*')
        .eq('supermercado_id', supermercadoId)
        .order('alimento_categoria', { ascending: true })
        .order('alimento_nombre', { ascending: true })
    return data ?? []
}

export async function obtenerTodosLosPrecios(): Promise<PrecioActual[]> {
    const { data } = await supabase
        .from('precios_actuales')
        .select('*')
        .order('supermercado_nombre', { ascending: true })
        .order('alimento_categoria', { ascending: true })
    return data ?? []
}

export async function guardarPrecio(params: {
    supermercado_id: string
    alimento_id: string
    precio_por_kg: number
    precio_unidad?: number
    url_producto?: string
}): Promise<boolean> {
    const { error } = await supabase.from('productos_supermercado').upsert({
        supermercado_id: params.supermercado_id,
        alimento_id: params.alimento_id,
        precio_por_kg: params.precio_por_kg,
        precio_unidad: params.precio_unidad || null,
        url_producto: params.url_producto || null,
        fecha_precio: new Date().toISOString().split('T')[0],
    }, {
        onConflict: 'supermercado_id, alimento_id',
    })
    return !error
}

export async function eliminarPrecio(id: string): Promise<boolean> {
    const { error } = await supabase.from('productos_supermercado').delete().eq('id', id)
    return !error
}

// ── Cálculo de Costes ─────────────────────────────────────────

/**
 * Calcula el coste total de un array de comidas (plan semanal)
 * usando los precios de un supermercado específico.
 */
export async function calcularCostePlan(
    comidas: { id?: string; nombre?: string; alimentos?: { alimento?: { id?: string; nombre?: string; categoria?: string }; cantidad_gramos?: number }[] }[],
    supermercadoId: string | null
): Promise<{
    precio_total: number
    alimentos: CosteAlimento[]
    coste_por_comida: CostePorReceta[]
}> {
    if (!supermercadoId) {
        return { precio_total: 0, alimentos: [], coste_por_comida: [] }
    }

    // Obtener todos los precios del supermercado seleccionado
    const { data: precios } = await supabase
        .from('precios_actuales')
        .select('*')
        .eq('supermercado_id', supermercadoId)

    const mapaPrecios = new Map<string, number>()
    if (precios) {
        for (const p of precios) {
            mapaPrecios.set(p.alimento_id, p.precio_por_kg)
        }
    }

    // Acumular alimentos globalmente
    const mapaGlobal = new Map<string, {
        alimento_id: string
        alimento_nombre: string
        categoria: string
        cantidad_total_gramos: number
        precio_por_kg: number
    }>()

    // Acumular por comida
    const costePorComida: CostePorReceta[] = []

    for (const comida of comidas) {
        const alimentosComida: CosteComida[] = []
        let costeComidaTotal = 0

        for (const ca of comida.alimentos ?? []) {
            if (!ca.alimento?.nombre) continue
            const a = ca.alimento
            const id = a.id ?? ''
            const gramos = ca.cantidad_gramos ?? 0
            const precioKg = mapaPrecios.get(id) ?? 0
            const coste = (gramos / 1000) * precioKg

            alimentosComida.push({
                alimento_id: id,
                alimento_nombre: a.nombre ?? '',
                cantidad_gramos: gramos,
                precio_por_kg: precioKg,
                coste_euros: Math.round(coste * 100) / 100,
            })

            costeComidaTotal += coste

            // Acumular global
            if (mapaGlobal.has(id)) {
                mapaGlobal.get(id)!.cantidad_total_gramos += gramos
            } else {
                mapaGlobal.set(id, {
                    alimento_id: id,
                    alimento_nombre: a.nombre ?? '',
                    categoria: a.categoria || 'Otros',
                    cantidad_total_gramos: gramos,
                    precio_por_kg: precioKg,
                })
            }
        }

        if (alimentosComida.length > 0) {
            costePorComida.push({
                comida_nombre: comida.nombre ?? 'Comida',
                coste_total: Math.round(costeComidaTotal * 100) / 100,
                alimentos: alimentosComida,
            })
        }
    }

    const alimentos = Array.from(mapaGlobal.values()).map(a => ({
        ...a,
        coste_total_euros: Math.round((a.cantidad_total_gramos / 1000) * a.precio_por_kg * 100) / 100,
    }))

    const precioTotal = alimentos.reduce((sum, a) => sum + a.coste_total_euros, 0)

    return {
        precio_total: Math.round(precioTotal * 100) / 100,
        alimentos,
        coste_por_comida: costePorComida,
    }
}

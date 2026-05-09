import { supabase } from './supabase'
import type { Supermercado, PrecioActual, CosteAlimento, CosteComida, CostePorReceta, ProductoSupermercadoDetalle, OpcionEscandallo, EscandalloPlan } from '@/types'

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

/**
 * Obtiene todas las opciones de productos para un alimento en todos los supermercados.
 * Usa la vista mejores_precios_por_alimento que prioriza (1) preferido (2) más barato.
 */
export async function obtenerPreciosAlimento(alimentoId: string): Promise<ProductoSupermercadoDetalle[]> {
    const { data } = await supabase
        .from('mejores_precios_por_alimento')
        .select('*')
        .eq('alimento_id', alimentoId)
        .order('precio_por_kg', { ascending: true })
    return data ?? []
}

export async function obtenerPreciosPorSupermercado(supermercadoId: string): Promise<ProductoSupermercadoDetalle[]> {
    const { data } = await supabase
        .from('mejores_precios_por_alimento')
        .select('*')
        .eq('supermercado_id', supermercadoId)
        .order('alimento_categoria', { ascending: true })
        .order('alimento_nombre', { ascending: true })
    return data ?? []
}

export async function obtenerTodosLosPrecios(): Promise<ProductoSupermercadoDetalle[]> {
    const { data } = await supabase
        .from('mejores_precios_por_alimento')
        .select('*')
        .order('supermercado_nombre', { ascending: true })
        .order('alimento_categoria', { ascending: true })
    return data ?? []
}

/**
 * Guarda un precio manualmente. Si el producto ya existe (mismo URL en mismo supermercado),
 * lo actualiza. Si no, inserta uno nuevo (permitiendo múltiples productos por alimento).
 */
export async function guardarPrecio(params: {
    supermercado_id: string
    alimento_id: string
    precio_por_kg: number
    precio_unidad?: number
    url_producto?: string
}): Promise<boolean> {
    const payload: Record<string, unknown> = {
        supermercado_id: params.supermercado_id,
        alimento_id: params.alimento_id,
        precio_por_kg: params.precio_por_kg,
        precio_unidad: params.precio_unidad || null,
        url_producto: params.url_producto || null,
        fecha_precio: new Date().toISOString().split('T')[0],
    }

    // Si tiene URL, upsert por URL; si no, insert directo
    if (params.url_producto) {
        const { error } = await supabase.from('productos_supermercado').upsert(payload, {
            onConflict: 'supermercado_id, url_producto',
        })
        return !error
    } else {
        const { error } = await supabase.from('productos_supermercado').insert(payload)
        return !error
    }
}

export async function eliminarPrecio(id: string): Promise<boolean> {
    const { error } = await supabase.from('productos_supermercado').delete().eq('id', id)
    return !error
}

// ── Favoritos / Preferidos ───────────────────────────────────

/**
 * Marca un producto como preferido para su alimento.
 * Desmarca cualquier otro preferido del mismo alimento en el mismo supermercado.
 */
export async function marcarProductoPreferido(productoId: string, alimentoId: string, supermercadoId: string): Promise<boolean> {
    // Desmarcar todos los preferidos de este alimento en este supermercado
    const { error: unmarkError } = await supabase
        .from('productos_supermercado')
        .update({ preferido: false })
        .eq('alimento_id', alimentoId)
        .eq('supermercado_id', supermercadoId)

    if (unmarkError) return false

    // Marcar el seleccionado
    const { error: markError } = await supabase
        .from('productos_supermercado')
        .update({ preferido: true })
        .eq('id', productoId)

    return !markError
}

// ── Cálculo de Costes ─────────────────────────────────────────

/**
 * Calcula el coste total de un array de comidas (plan semanal)
 * usando los mejores precios del supermercado seleccionado.
 *
 * Usa la vista mejores_precios_por_alimento que para cada alimento
 * devuelve el producto preferido (o el más barato si no hay preferido).
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

    // Obtener mejor precio de cada alimento en este supermercado
    const { data: precios } = await supabase
        .from('mejores_precios_por_alimento')
        .select('*')
        .eq('supermercado_id', supermercadoId)

    const mapaPrecios = new Map<string, number>()
    if (precios) {
        for (const p of precios) {
            // Si ya tenemos un precio para este alimento, nos quedamos con el menor
            const actual = mapaPrecios.get(p.alimento_id) ?? Infinity
            if (p.precio_por_kg < actual) {
                mapaPrecios.set(p.alimento_id, p.precio_por_kg)
            }
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

// ── Escandallo con Alternativas (multi-producto) ──────────────

/**
 * Calcula el escandallo de un plan incluyendo todas las alternativas
 * de producto para cada alimento, permitiendo al coach comparar y elegir.
 *
 * Para cada alimento del plan, obtiene:
 * - El producto seleccionado (preferido o más barato)
 * - Alternativas en otros supermercados / productos
 * - Ahorro potencial si se escoge la opción más barata global
 */
export async function calcularEscandalloConAlternativas(
    comidas: { id?: string; nombre?: string; alimentos?: { alimento?: { id?: string; nombre?: string; categoria?: string }; cantidad_gramos?: number }[] }[],
    supermercadoId: string | null
): Promise<EscandalloPlan> {
    if (!supermercadoId) {
        return { precio_total: 0, alimentos: [], ahorro_potencial: 0 }
    }

    // 1. Obtener el mejor precio de cada alimento en el supermercado seleccionado
    const { data: mejoresPrecios } = await supabase
        .from('mejores_precios_por_alimento')
        .select('*')
        .eq('supermercado_id', supermercadoId)

    const mapaMejores = new Map<string, ProductoSupermercadoDetalle>()
    if (mejoresPrecios) {
        for (const p of mejoresPrecios) {
            const actual = mapaMejores.get(p.alimento_id)
            if (!actual || p.precio_por_kg < actual.precio_por_kg) {
                mapaMejores.set(p.alimento_id, p as ProductoSupermercadoDetalle)
            }
        }
    }

    // 2. Obtener TODOS los productos de cada alimento (para alternativas)
    const todosAlimentoIds = new Set<string>()
    for (const comida of comidas) {
        for (const ca of comida.alimentos ?? []) {
            if (ca.alimento?.id) todosAlimentoIds.add(ca.alimento.id)
        }
    }

    const { data: todosProductos } = await supabase
        .from('productos_supermercado')
        .select(`
            id,
            supermercado_id,
            alimento_id,
            precio_por_kg,
            nombre_original,
            marca,
            preferido,
            supermercados!inner(nombre, slug, color)
        `)
        .in('alimento_id', Array.from(todosAlimentoIds))
        .order('precio_por_kg', { ascending: true })

    // Agrupar productos por alimento_id
    const productosPorAlimento = new Map<string, any[]>()
    for (const p of todosProductos ?? []) {
        const arr = productosPorAlimento.get(p.alimento_id) || []
        arr.push(p)
        productosPorAlimento.set(p.alimento_id, arr)
    }

    // 3. Construir alimentos de salida
    const alimentosEscandallo: OpcionEscandallo[] = []
    let precioTotal = 0
    let sumaMasBaratos = 0

    for (const comida of comidas) {
        for (const ca of comida.alimentos ?? []) {
            if (!ca.alimento?.id || !ca.alimento?.nombre) continue
            const alimentoId = ca.alimento.id
            const alimentoNombre = ca.alimento.nombre
            const categoria = ca.alimento.categoria || 'Otros'
            const gramos = ca.cantidad_gramos ?? 0
            if (gramos === 0) continue

            // Producto seleccionado (mejor precio en supermercado elegido)
            const seleccionado = mapaMejores.get(alimentoId)
            const precioKg = seleccionado?.precio_por_kg ?? 0
            const coste = (gramos / 1000) * precioKg
            precioTotal += coste

            // Alternativas: todos los productos de este alimento
            const productos = productosPorAlimento.get(alimentoId) ?? []
            const alternativas = productos.map((p: any) => ({
                id: p.id,
                supermercado_nombre: p.supermercados?.nombre || '',
                precio_por_kg: p.precio_por_kg,
                es_preferido: p.preferido === true,
            }))
            // Quitar duplicados de mismo supermercado (quedarse con el más barato)
            const unicas = new Map<string, typeof alternativas[0]>()
            for (const alt of alternativas) {
                const existente = unicas.get(alt.supermercado_nombre)
                if (!existente || alt.precio_por_kg < existente.precio_por_kg) {
                    unicas.set(alt.supermercado_nombre, alt)
                }
            }
            const alternativasUnicas = Array.from(unicas.values())
                .sort((x, y) => x.precio_por_kg - y.precio_por_kg)

            // Calcular el más barato global para ahorro potencial
            const masBaratoGlobal = alternativasUnicas[0]
            const costeMasBarato = masBaratoGlobal
                ? (gramos / 1000) * masBaratoGlobal.precio_por_kg
                : coste
            sumaMasBaratos += costeMasBarato

            alimentosEscandallo.push({
                alimento_id: alimentoId,
                alimento_nombre: alimentoNombre,
                categoria: categoria,
                cantidad_gramos: gramos,
                producto_seleccionado: {
                    id: seleccionado?.id || '',
                    nombre_original: seleccionado?.nombre_original,
                    supermercado_nombre: seleccionado?.supermercado_nombre || '',
                    precio_por_kg: precioKg,
                },
                coste_euros: Math.round(coste * 100) / 100,
                alternativas: alternativasUnicas,
            })
        }
    }

    // 4. Determinar supermercado base (el que más aparece como preferido)
    const conteoSuper = new Map<string, number>()
    for (const al of alimentosEscandallo) {
        const nombre = al.producto_seleccionado.supermercado_nombre
        conteoSuper.set(nombre, (conteoSuper.get(nombre) || 0) + 1)
    }
    let superBase = ''
    let maxCount = 0
    for (const [nombre, count] of conteoSuper) {
        if (count > maxCount) {
            maxCount = count
            superBase = nombre
        }
    }

    return {
        precio_total: Math.round(precioTotal * 100) / 100,
        supermercado_base: superBase || undefined,
        alimentos: alimentosEscandallo,
        ahorro_potencial: Math.round((precioTotal - sumaMasBaratos) * 100) / 100,
    }
}

import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

interface AlimentoRow {
    id: string
    nombre: string
    fuente: string | null
    calorias: number | null
    proteinas: number | null
    carbohidratos: number | null
    grasas: number | null
}

/**
 * POST /api/alimentos/deduplicar
 *
 * Limpia alimentos duplicados en la base de datos conservando
 * el registro con mejor fuente (curada > bedca > coach > ia > openfoodfacts)
 * y más datos nutricionales.
 *
 * NO requiere autenticación porque usa service_role (operación de mantenimiento).
 */
export async function POST() {
    try {
        const supabase = createServiceSupabase()

        // Intentar usar RPC si existe, si no, lógica manual
        return await deduplicarManualmente(supabase)
    } catch (err: any) {
        return NextResponse.json(
            { error: err.message ?? 'Error interno' },
            { status: 500 }
        )
    }
}

async function deduplicarManualmente(supabase: any) {
    // 1. Obtener todos los alimentos base (no custom, sin coach)
    const { data: todos, error } = await supabase
        .from('alimentos')
        .select('id, nombre, fuente, calorias, proteinas, carbohidratos, grasas')
        .is('coach_id', null)
        .order('nombre')

    if (error) throw error
    if (!todos?.length) {
        return NextResponse.json({ message: 'No hay alimentos que procesar', eliminados: 0 })
    }

    const alimentos = todos as AlimentoRow[]

    // 2. Prioridad de fuentes (menor = mejor)
    const PRIORIDAD_FUENTE: Record<string, number> = {
        curada: 0,
        bedca: 1,
        coach: 2,
        ia: 3,
        openfoodfacts: 4,
    }

    // 3. Agrupar por nombre normalizado
    const grupos = new Map<string, AlimentoRow[]>()
    for (const a of alimentos) {
        const key = a.nombre.trim().toLowerCase()
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key)!.push(a)
    }

    // 4. Para cada grupo con duplicados, conservar el mejor
    const idsAEliminar: string[] = []
    for (const [, items] of grupos.entries()) {
        if (items.length <= 1) continue

        // Ordenar: mejor fuente primero, luego más datos
        items.sort((a: AlimentoRow, b: AlimentoRow) => {
            const fa = PRIORIDAD_FUENTE[a.fuente ?? ''] ?? 99
            const fb = PRIORIDAD_FUENTE[b.fuente ?? ''] ?? 99
            if (fa !== fb) return fa - fb
            // A igual fuente, el que tiene más datos
            const da = (a.calorias ?? 0) + (a.proteinas ?? 0) + (a.carbohidratos ?? 0) + (a.grasas ?? 0)
            const db = (b.calorias ?? 0) + (b.proteinas ?? 0) + (b.carbohidratos ?? 0) + (b.grasas ?? 0)
            return db - da
        })

        // Conservar el primero (mejor), eliminar el resto
        const [, ...eliminar] = items
        idsAEliminar.push(...eliminar.map(i => i.id))
    }

    if (idsAEliminar.length === 0) {
        return NextResponse.json({ message: 'No se encontraron duplicados', eliminados: 0, totalRestantes: alimentos.length })
    }

    // 5. Eliminar en lotes
    const TAMANO_LOTE = 50
    let eliminados = 0
    for (let i = 0; i < idsAEliminar.length; i += TAMANO_LOTE) {
        const lote = idsAEliminar.slice(i, i + TAMANO_LOTE)
        const { error: delError } = await supabase
            .from('alimentos')
            .delete()
            .in('id', lote)
        if (!delError) eliminados += lote.length
    }

    return NextResponse.json({
        message: `🧹 ${eliminados} alimentos duplicados eliminados de ${alimentos.length} totales`,
        eliminados,
        totalRestantes: alimentos.length - eliminados,
    })
}

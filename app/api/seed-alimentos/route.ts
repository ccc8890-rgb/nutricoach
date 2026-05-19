import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ALIMENTOS_SEED } from '@/lib/foods-data'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/seed-alimentos
 *
 * Inserta los alimentos base (desde lib/foods-data.ts) que NO existan ya en la BD.
 * Verifica nombre por nombre para evitar duplicados, incluso si otros sistemas
 * (BEDCA, importaciones manuales) ya poblaron parcialmente la tabla.
 *
 * USO:
 *   curl http://localhost:3000/api/seed-alimentos
 */
/** Prioridad de fuentes para deduplicación (menor = mejor) */
const PRIORIDAD_FUENTE: Record<string, number> = {
    curada: 0,
    bedca: 1,
    coach: 2,
    ia: 3,
    openfoodfacts: 4,
}

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
 * Elimina duplicados entre alimentos base (no custom, sin coach_id).
 * Agrupa por nombre normalizado, conserva el de mejor fuente y más datos.
 */
async function deduplicarAlimentos() {
    const { data: todos } = await supabaseAdmin
        .from('alimentos')
        .select('id, nombre, fuente, calorias, proteinas, carbohidratos, grasas')
        .eq('es_comestible', true)
        .is('coach_id', null)

    if (!todos?.length) return 0

    const alimentos = todos as AlimentoRow[]

    // Agrupar por nombre normalizado
    const grupos = new Map<string, AlimentoRow[]>()
    for (const a of alimentos) {
        const key = a.nombre.trim().toLowerCase()
        if (!grupos.has(key)) grupos.set(key, [])
        grupos.get(key)!.push(a)
    }

    // Para cada grupo con duplicados, conservar el mejor
    const idsAEliminar: string[] = []
    for (const [, items] of grupos.entries()) {
        if (items.length <= 1) continue

        items.sort((a: AlimentoRow, b: AlimentoRow) => {
            const fa = PRIORIDAD_FUENTE[a.fuente ?? ''] ?? 99
            const fb = PRIORIDAD_FUENTE[b.fuente ?? ''] ?? 99
            if (fa !== fb) return fa - fb
            const da = (a.calorias ?? 0) + (a.proteinas ?? 0) + (a.carbohidratos ?? 0) + (a.grasas ?? 0)
            const db = (b.calorias ?? 0) + (b.proteinas ?? 0) + (b.carbohidratos ?? 0) + (b.grasas ?? 0)
            return db - da
        })

        const [, ...eliminar] = items
        idsAEliminar.push(...eliminar.map(i => i.id))
    }

    if (idsAEliminar.length === 0) return 0

    // Eliminar en lotes de 50
    const TAMANO_LOTE = 50
    let eliminados = 0
    for (let i = 0; i < idsAEliminar.length; i += TAMANO_LOTE) {
        const lote = idsAEliminar.slice(i, i + TAMANO_LOTE)
        const { error } = await supabaseAdmin.from('alimentos').delete().in('id', lote)
        if (!error) eliminados += lote.length
    }

    return eliminados
}

export async function GET() {
    try {
        // 1. Primero: limpiar duplicados existentes
        const duplicadosEliminados = await deduplicarAlimentos()
        if (duplicadosEliminados > 0) {
            console.log(`🧹 Deduplicación automática: ${duplicadosEliminados} registros eliminados`)
        }

        // 2. Obtener todos los nombres de alimentos no-custom existentes
        const { data: existentes } = await supabaseAdmin
            .from('alimentos')
            .select('nombre')
            .eq('custom', false)

        const nombresExistentes = new Set(
            (existentes ?? []).map(a => a.nombre.trim().toLowerCase())
        )

        // 3. Filtrar solo los que NO existen
        const aInsertar = ALIMENTOS_SEED.filter(
            a => !nombresExistentes.has(a.nombre.trim().toLowerCase())
        )

        if (aInsertar.length === 0) {
            return NextResponse.json({
                message: duplicadosEliminados > 0
                    ? `✅ Todos los alimentos base ya existen. Se eliminaron ${duplicadosEliminados} duplicados.`
                    : `✅ Todos los alimentos base ya existen en la BD. Total: ${ALIMENTOS_SEED.length}`,
                count: 0,
                total: ALIMENTOS_SEED.length,
                duplicadosEliminados,
            })
        }

        // 4. Insertar en lotes
        const TAMANO_LOTE = 20
        let insertados = 0
        const errores: string[] = []

        for (let i = 0; i < aInsertar.length; i += TAMANO_LOTE) {
            const lote = aInsertar.slice(i, i + TAMANO_LOTE)
            const registros = lote.map(a => ({
                nombre: a.nombre,
                categoria: a.categoria,
                calorias: a.calorias,
                proteinas: a.proteinas,
                carbohidratos: a.carbohidratos,
                grasas: a.grasas,
                fibra: a.fibra ?? 0,
                custom: false,
                fuente: 'curada',
            }))

            const { error } = await supabaseAdmin
                .from('alimentos')
                .insert(registros)

            if (error) {
                errores.push(`Lote ${Math.floor(i / TAMANO_LOTE) + 1}: ${error.message}`)
            } else {
                insertados += registros.length
            }
        }

        return NextResponse.json({
            message: errores.length === 0
                ? `✅ ${insertados} alimentos base insertados${duplicadosEliminados > 0 ? ` y ${duplicadosEliminados} duplicados eliminados` : ''}.`
                : `⚠️ ${insertados} insertados, ${errores.length} lotes con errores.`,
            count: insertados,
            total: ALIMENTOS_SEED.length,
            yaExistentes: ALIMENTOS_SEED.length - aInsertar.length,
            duplicadosEliminados,
            errores: errores.length > 0 ? errores.slice(0, 3) : undefined,
        })
    } catch (error: any) {
        console.error('Error en seed-alimentos API:', error)
        return NextResponse.json(
            { error: 'Error interno al insertar alimentos' },
            { status: 500 }
        )
    }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

interface RecetaIngredienteRaw {
    id: string
    nombre_libre: string
    cantidad_gramos: number
    orden: number
    alimento: {
        id: string
        nombre: string
        calorias: number
        proteinas: number
        carbohidratos: number
        grasas: number
        fibra: number | null
    } | null
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const db = createServiceSupabase()

    const { data: receta, error } = await db
        .from('recetas')
        .select(`
            id, nombre, kcal, proteinas, carbohidratos, grasas, porciones,
            receta_ingredientes!receta_ingredientes_receta_id_fkey(
                id, nombre_libre, cantidad_gramos, orden,
                alimento:alimentos(id, nombre, calorias, proteinas, carbohidratos, grasas, fibra)
            )
        `)
        .eq('id', id)
        .eq('estado', 'aprobada')
        .single()

    if (error || !receta) {
        return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
    }

    const ingredientes = ((receta.receta_ingredientes ?? []) as unknown as RecetaIngredienteRaw[])
        .sort((a, b) => a.orden - b.orden)
        .map(ri => ({
            id: `ri_${ri.id}`,
            alimento_id: ri.alimento?.id ?? undefined,
            cantidad_gramos: ri.cantidad_gramos,
            alimento: ri.alimento
                ? {
                    nombre: ri.alimento.nombre,
                    calorias: ri.alimento.calorias,
                    proteinas: ri.alimento.proteinas,
                    carbohidratos: ri.alimento.carbohidratos,
                    grasas: ri.alimento.grasas,
                    fibra: ri.alimento.fibra ?? 0,
                }
                : {
                    nombre: ri.nombre_libre,
                    calorias: 0,
                    proteinas: 0,
                    carbohidratos: 0,
                    grasas: 0,
                    fibra: 0,
                },
        }))

    return NextResponse.json({
        receta_id: receta.id,
        nombre: receta.nombre,
        ingredientes,
    })
}

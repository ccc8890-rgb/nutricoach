import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
)

interface RecetaRow {
    id: string
    ingredientes: string | null
}

/**
 * POST /api/recetas/migrar
 *
 * Migra las recetas del esquema antiguo al nuevo.
 * NO requiere auth porque usa service_role.
 */
export async function POST() {
    const results: string[] = []
    const errors: string[] = []

    // ---- 1. Crear tabla receta_ingredientes si no existe ----
    try {
        // Primero verificamos si la tabla existe intentando leer de ella
        const { error: checkError } = await supabaseAdmin
            .from('receta_ingredientes')
            .select('id')
            .limit(1)

        if (checkError && checkError.message.includes('relation') && checkError.message.includes('does not exist')) {
            // La tabla no existe, la creamos via SQL directo (solo funciona si hay RPC exec_sql)
            // Como alternativa, la migración SQL debe ejecutarse manualmente
            errors.push('La tabla receta_ingredientes no existe. Ejecuta el script supabase_migrar_recetas.sql en el SQL Editor de Supabase primero.')
            return NextResponse.json({
                success: false,
                message: 'La tabla receta_ingredientes no existe. Debes ejecutar el script SQL primero.',
                needsSqlMigration: true,
                sqlFile: 'supabase_migrar_recetas.sql',
            }, { status: 400 })
        }
        results.push('Tabla receta_ingredientes existe')
    } catch {
        errors.push('No se pudo verificar la existencia de receta_ingredientes')
    }

    // ---- 2. Migrar ingredientes (texto) a receta_ingredientes (join table) ----
    try {
        const { data: recetasConTexto, error: fetchError } = await supabaseAdmin
            .from('recetas')
            .select('id, ingredientes')
            .not('ingredientes', 'is', null)
            .neq('ingredientes', '')

        if (fetchError) throw fetchError

        if (recetasConTexto && recetasConTexto.length > 0) {
            for (const receta of recetasConTexto as RecetaRow[]) {
                // Verificar si ya tiene ingredientes migrados
                const { data: existingIngs } = await supabaseAdmin
                    .from('receta_ingredientes')
                    .select('id')
                    .eq('receta_id', receta.id)
                    .limit(1)

                if (existingIngs && existingIngs.length > 0) continue

                const lines = String(receta.ingredientes).split('\n').filter(l => l.trim())
                const inserts: any[] = []

                lines.forEach((line: string, idx: number) => {
                    line = line.trim()
                    if (!line) return

                    const match = line.match(/^([\d.,]+)\s*(?:g|gr|gramos?)?\s+(.+)$/i)
                    let gramos = 100
                    let nombre = line

                    if (match) {
                        gramos = Math.max(1, Math.round(parseFloat(match[1].replace(',', '.'))))
                        nombre = match[2].trim()
                    } else {
                        const huevos = line.match(/^(\d+)\s*huevos?\b/i)
                        if (huevos) {
                            gramos = parseInt(huevos[1]) * 60
                            nombre = 'Huevo'
                        }
                    }

                    inserts.push({
                        receta_id: receta.id,
                        nombre_libre: nombre,
                        cantidad_gramos: gramos,
                        orden: idx,
                    })
                })

                if (inserts.length > 0) {
                    const { error: insErr } = await supabaseAdmin
                        .from('receta_ingredientes')
                        .insert(inserts)

                    if (!insErr) {
                        results.push(`Ingredientes migrados: "${receta.id}" (${inserts.length} items)`)
                    }
                }
            }
        } else {
            results.push('No hay recetas con ingredientes en texto pendientes de migrar')
        }
    } catch (err: any) {
        errors.push(`Error migrando ingredientes: ${err.message}`)
    }

    // ---- 3. Recalcular macros desde ingredientes vinculados ----
    try {
        // Obtener todas las recetas con ingredientes vinculados a alimentos
        const { data: recetasConVinculos } = await supabaseAdmin
            .from('receta_ingredientes')
            .select(`
                receta_id,
                cantidad_gramos,
                orden,
                alimento:alimentos(calorias, proteinas, carbohidratos, grasas, fibra)
            `)
            .not('alimento_id', 'is', null)

        if (recetasConVinculos && recetasConVinculos.length > 0) {
            // Agrupar por receta_id
            const grouped: Record<string, any[]> = {}
            for (const ing of recetasConVinculos) {
                if (!grouped[ing.receta_id]) grouped[ing.receta_id] = []
                grouped[ing.receta_id].push(ing)
            }

            for (const [recetaId, ingreds] of Object.entries(grouped)) {
                // Obtener porciones de la receta
                const { data: receta } = await supabaseAdmin
                    .from('recetas')
                    .select('porciones')
                    .eq('id', recetaId)
                    .single()

                const porciones = (receta as { porciones?: number })?.porciones ?? 1
                const divisor = Math.max(1, porciones)

                // Calcular totales
                let kcal = 0, proteinas = 0, carbohidratos = 0, grasas = 0, fibra = 0
                for (const ing of ingreds) {
                    const a = ing.alimento as any
                    if (!a) continue
                    const factor = ing.cantidad_gramos / 100
                    kcal += (a.calorias ?? 0) * factor
                    proteinas += (a.proteinas ?? 0) * factor
                    carbohidratos += (a.carbohidratos ?? 0) * factor
                    grasas += (a.grasas ?? 0) * factor
                    fibra += (a.fibra ?? 0) * factor
                }

                // Actualizar solo si no tiene macros o son cero
                const { error: updateErr } = await supabaseAdmin
                    .from('recetas')
                    .update({
                        kcal: Math.round(kcal / divisor * 100) / 100,
                        proteinas: Math.round(proteinas / divisor * 100) / 100,
                        carbohidratos: Math.round(carbohidratos / divisor * 100) / 100,
                        grasas: Math.round(grasas / divisor * 100) / 100,
                        fibra: Math.round(fibra / divisor * 100) / 100,
                    })
                    .eq('id', recetaId)
                    .or('kcal.is.null,kcal.eq.0')

                if (!updateErr) {
                    results.push(`Macros calculados para receta ${recetaId}`)
                }
            }
        } else {
            results.push('No hay ingredientes vinculados a alimentos para calcular macros')
        }
    } catch (err: any) {
        errors.push(`Error calculando macros: ${err.message}`)
    }

    return NextResponse.json({
        success: errors.length === 0 || errors.length < results.length,
        message: `${results.length} operaciones completadas, ${errors.length} errores`,
        results: results.slice(0, 30),
        errors: errors.slice(0, 10),
    })
}

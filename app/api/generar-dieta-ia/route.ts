import { NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase } from '@/lib/supabase-server'
import { construirPrompt, generarDietaConIA } from '@/lib/deepseek'
import type { DietaGenerada } from '@/lib/deepseek'
import { registrarInteraccionIA } from '@/lib/ia-logger'
import { fetchKnowledgeContext } from '@/lib/knowledge'
import { aplicarRecetaAComida } from '@/lib/recetas/aplicar-receta-comida'

/**
 * POST /api/generar-dieta-ia
 *
 * Genera una dieta automáticamente usando DeepSeek V3.
 *
 * INPUT:
 *   { respuesta_cliente_id: "uuid" }
 *
 * PROCESO:
 *   1. Obtiene la respuesta del cliente con sus datos
 *   2. Obtiene las plantillas de dieta del coach
 *   3. Obtiene las recetas disponibles
 *   4. Construye prompt y llama a DeepSeek
 *   5. Crea el plan de nutrición + comidas + alimentos en BD
 *   6. Actualiza estado de la respuesta a "dieta_lista"
 *
 * OUTPUT:
 *   { plan_id: "uuid", macros: {...}, status: "generada" }
 */
export async function POST(request: Request) {
    try {
        const supabase = await createServerSupabase()
        // 1. Autenticación
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }

        // 2. Validar input
        const body = await request.json()
        const { respuesta_cliente_id } = body

        if (!respuesta_cliente_id) {
            return NextResponse.json({ error: 'respuesta_cliente_id es obligatorio' }, { status: 400 })
        }

        // 3. Obtener respuesta del cliente
        const { data: respuesta, error: respError } = await supabase
            .from('respuestas_clientes')
            .select('*, cuestionario:cuestionarios(*)')
            .eq('id', respuesta_cliente_id)
            .eq('coach_id', user.id)
            .single()

        if (respError || !respuesta) {
            return NextResponse.json({ error: 'Respuesta no encontrada' }, { status: 404 })
        }

        // Actualizar estado inmediatamente a "procesando"
        await supabase
            .from('respuestas_clientes')
            .update({ estado: 'procesando', updated_at: new Date().toISOString() })
            .eq('id', respuesta_cliente_id)

        // 3.5 Obtener contexto de knowledge_base para la IA
        const serviceSupabase = createServiceSupabase()
        const disciplinasCliente = ['nutricion', 'general']
        const condicionesCliente = (respuesta.respuestas as any)?.condiciones_especiales
            ? [respuesta.respuestas.condiciones_especiales].flat().filter(Boolean)
            : []
        const kbContext = await fetchKnowledgeContext(serviceSupabase, {
            disciplinas: disciplinasCliente,
            condiciones: condicionesCliente.length > 0 ? condicionesCliente : undefined,
            limite: 6,
        })

        // 4. Obtener plantillas del coach
        const { data: plantillas } = await supabase
            .from('plantillas_dietas')
            .select('id, nombre, kcal_objetivo, proteinas_objetivo, carbohidratos_objetivo, grasas_objetivo')
            .eq('coach_id', user.id)
            .eq('activo', true)

        if (!plantillas || plantillas.length === 0) {
            await actualizarEstadoError(respuesta_cliente_id, 'No hay plantillas disponibles')
            return NextResponse.json({ error: 'No hay plantillas de dieta configuradas. Ejecuta el seed primero.' }, { status: 400 })
        }

        // 5. Obtener recetas disponibles (incluyendo azúcares, sodio y fibra para IA personalizada)
        const { data: recetas } = await supabase
            .from('recetas')
            .select('id, nombre, categoria, kcal, proteinas, carbohidratos, grasas, azucares, sodio_mg, fibra')
            .or(`coach_id.eq.${user.id},coach_id.is.null`)

        if (!recetas || recetas.length < 5) {
            await actualizarEstadoError(respuesta_cliente_id, 'Recetas insuficientes (mín. 5)')
            return NextResponse.json({ error: 'No hay suficientes recetas. Se necesitan al menos 5.' }, { status: 400 })
        }

        // 6. Construir prompt y llamar a DeepSeek
        const prompt = construirPrompt(
            respuesta.respuestas as Record<string, string | string[] | number>,
            plantillas,
            recetas,
            kbContext
        )

        let dietaGenerada: DietaGenerada
        let totalTokens = 0
        try {
            const result = await generarDietaConIA(prompt)
            dietaGenerada = result.data
            totalTokens = result.total_tokens
        } catch (deepseekError) {
            console.error('Error en DeepSeek:', deepseekError)
            await actualizarEstadoError(respuesta_cliente_id, 'Error al contactar con IA')
            return NextResponse.json(
                { error: `Error al generar dieta con IA: ${deepseekError instanceof Error ? deepseekError.message : 'Error desconocido'}` },
                { status: 500 }
            )
        }

        // 7. Validar que la plantilla elegida existe
        const plantillaElegida = plantillas.find(p => p.id === dietaGenerada.plantilla_id_elegida)
        if (!plantillaElegida) {
            await actualizarEstadoError(respuesta_cliente_id, 'Plantilla no encontrada')
            return NextResponse.json({ error: 'La plantilla seleccionada por la IA no existe' }, { status: 400 })
        }

        // 8. Validar macros (±10%)
        if (!plantillaElegida.kcal_objetivo) {
            await actualizarEstadoError(respuesta_cliente_id, 'Plantilla sin kcal_objetivo')
            return NextResponse.json({
                error: 'La plantilla seleccionada no tiene kcal_objetivo definido',
            }, { status: 400 })
        }
        const kcalDiff = Math.abs(dietaGenerada.macros_totales.kcal - plantillaElegida.kcal_objetivo)
        const kcalMaxDiff = plantillaElegida.kcal_objetivo * 0.10
        if (kcalDiff > kcalMaxDiff) {
            await actualizarEstadoError(respuesta_cliente_id, 'Macros fuera de rango')
            return NextResponse.json({
                error: `Las macros generadas (${dietaGenerada.macros_totales.kcal} kcal) no están dentro del ±10% de la plantilla (${plantillaElegida.kcal_objetivo} kcal)`,
            }, { status: 400 })
        }

        // 9. Crear el plan de nutrición
        // Para MVP: el plan se crea sin cliente_id (se asigna manualmente después)
        const { data: plan, error: planError } = await supabase
            .from('planes_nutricion')
            .insert({
                coach_id: user.id,
                nombre: `Dieta generada por IA - ${new Date().toLocaleDateString('es-ES')}`,
                descripcion: dietaGenerada.notas || `Basada en: ${plantillaElegida.nombre}. ${dietaGenerada.razon_plantilla}`,
                kcal_objetivo: dietaGenerada.macros_totales.kcal,
                proteinas_objetivo: dietaGenerada.macros_totales.proteinas,
                carbohidratos_objetivo: dietaGenerada.macros_totales.carbohidratos,
                grasas_objetivo: dietaGenerada.macros_totales.grasas,
                activo: true,
                generado_por_ia: true,
            })
            .select()
            .single()

        if (planError || !plan) {
            await actualizarEstadoError(respuesta_cliente_id, 'Error al crear plan')
            return NextResponse.json({ error: 'Error al crear el plan de nutrición' }, { status: 500 })
        }

        // 10. Crear comidas + expandir recetas en ingredientes reales
        for (const comida of dietaGenerada.comidas) {
            const recetaPrincipal = comida.alimentos
                .map(alimento => recetas.find(r => r.id === alimento.receta_id))
                .find(Boolean)
            const alternativas = comida.alimentos
                .map(alimento => alimento.receta_id)
                .filter((id): id is string => !!id && id !== recetaPrincipal?.id)
                .slice(0, 3)

            const { data: comidaDb, error: comidaError } = await supabase
                .from('comidas')
                .insert({
                    plan_id: plan.id,
                    nombre: comida.nombre,
                    orden: comida.orden,
                    receta_id: recetaPrincipal?.id ?? null,
                    alternativas_receta_ids: alternativas.length > 0 ? alternativas : null,
                    kcal_target: recetaPrincipal?.kcal ? Math.round(recetaPrincipal.kcal) : null,
                    proteinas_target: recetaPrincipal?.proteinas ? Math.round(recetaPrincipal.proteinas) : null,
                    carbos_target: recetaPrincipal?.carbohidratos ? Math.round(recetaPrincipal.carbohidratos) : null,
                    grasas_target: recetaPrincipal?.grasas ? Math.round(recetaPrincipal.grasas) : null,
                })
                .select()
                .single()

            if (comidaError || !comidaDb) {
                console.error('Error al crear comida:', comidaError)
                continue
            }

            for (let index = 0; index < comida.alimentos.length; index++) {
                const alimento = comida.alimentos[index]
                const receta = recetas.find(r => r.id === alimento.receta_id)
                if (!receta) continue

                try {
                    await aplicarRecetaAComida(serviceSupabase, {
                        comidaId: comidaDb.id,
                        recetaId: receta.id,
                        clienteId: respuesta.cliente_id ?? null,
                        planId: plan.id,
                        comidaSlot: comida.nombre,
                        targetKcal: Number(receta.kcal ?? 0) * (alimento.cantidad_porciones ?? 1),
                        tipoInteraccion: respuesta.cliente_id ? 'asignada_plan' : undefined,
                        reemplazar: index === 0,
                    })
                } catch (error) {
                    console.error('Error al expandir receta en comida:', receta.nombre, error)
                }
            }
        }

        // 11. Actualizar estado de la respuesta
        await supabase
            .from('respuestas_clientes')
            .update({
                estado: 'dieta_lista',
                plan_id: plan.id,
                updated_at: new Date().toISOString(),
            })
            .eq('id', respuesta_cliente_id)

        // 12. Loguear interacción IA (con tokens)
        registrarInteraccionIA({
            coachId: user.id,
            clienteId: respuesta.cliente_id || '',
            tipo: 'dieta',
            prompt,
            respuestaJson: {
                plan_id: plan.id,
                macros: dietaGenerada.macros_totales,
                plantilla_id_elegida: dietaGenerada.plantilla_id_elegida,
            },
            planId: plan.id,
            tokensUsados: totalTokens,
        }).catch(err => console.error('[ia-logger] Error al registrar dieta IA:', err))

        // 13. Respuesta exitosa
        return NextResponse.json({
            plan_id: plan.id,
            status: 'generada',
            macros: dietaGenerada.macros_totales,
            notas: dietaGenerada.notas,
        })

    } catch (error) {
        console.error('Error en generar-dieta-ia:', error)
        return NextResponse.json({ error: 'Error interno al generar dieta' }, { status: 500 })
    }
}

/**
 * Helper para actualizar estado a error cuando algo falla
 */
async function actualizarEstadoError(respuestaId: string, motivo: string) {
    try {
        const supabase = await createServerSupabase()
        await supabase
            .from('respuestas_clientes')
            .update({
                estado: 'dieta_rechazada',
                updated_at: new Date().toISOString(),
            })
            .eq('id', respuestaId)
    } catch {
        console.error('Error al actualizar estado de respuesta:', respuestaId)
    }
}

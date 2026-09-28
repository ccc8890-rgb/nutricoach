import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarEscrituraPlan } from '@/lib/cliente/autorizar-escritura-plan'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

// Convierte comidas "recurrentes" (dia_semana null, se repiten cada día) en
// 7 copias concretas por día, una por comida recurrente. Necesario antes de
// poder arrastrar comidas entre días en el Kanban: mover una comida que
// hoy es la misma en los 7 días no tiene un significado claro, así que
// primero se "materializa" en 7 instancias independientes y luego el drag
// es un simple cambio de dia_semana, igual que ya hacen las sesiones de
// entrenamiento (siempre día concreto, nunca recurrentes).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params

    const auth = await autorizarEscrituraPlan(request, codigo)
    if (auth instanceof NextResponse) return auth
    const planId = auth.planId

    const admin = createServiceSupabase()

    const { data: recurrentes, error: comidasError } = await admin
      .from('comidas')
      .select('*')
      .eq('plan_id', planId)
      .is('dia_semana', null)

    if (comidasError) {
      return NextResponse.json({ error: 'Error al leer comidas' }, { status: 500 })
    }

    if (!recurrentes || recurrentes.length === 0) {
      return NextResponse.json({ ok: true, materializadas: 0 })
    }

    for (const comida of recurrentes) {
      const { data: alimentos } = await admin
        .from('comida_alimentos')
        .select('alimento_id, cantidad_gramos, factor_ajuste')
        .eq('comida_id', comida.id)

      const nuevasFilas = DIAS.map(dia => ({
        plan_id: comida.plan_id,
        nombre: comida.nombre,
        orden: comida.orden,
        hora_sugerida: comida.hora_sugerida,
        kcal_target: comida.kcal_target,
        proteinas_target: comida.proteinas_target,
        carbos_target: comida.carbos_target,
        grasas_target: comida.grasas_target,
        notas_peri_entreno: comida.notas_peri_entreno,
        receta_id: comida.receta_id,
        alternativas_receta_ids: comida.alternativas_receta_ids,
        dia_semana: dia,
        dieta_habitual_id: comida.dieta_habitual_id,
        origen_adherencia: comida.origen_adherencia,
        adaptacion_habitual: comida.adaptacion_habitual,
      }))

      const { data: creadas, error: insertError } = await admin
        .from('comidas')
        .insert(nuevasFilas)
        .select('id')

      if (insertError || !creadas) {
        return NextResponse.json({ error: `No se pudo materializar "${comida.nombre}"` }, { status: 500 })
      }

      if (alimentos && alimentos.length > 0) {
        const filasAlimentos = creadas.flatMap(nueva =>
          alimentos.map(a => ({
            comida_id: nueva.id,
            alimento_id: a.alimento_id,
            cantidad_gramos: a.cantidad_gramos,
            factor_ajuste: a.factor_ajuste,
          }))
        )
        const { error: alimentosError } = await admin.from('comida_alimentos').insert(filasAlimentos)
        if (alimentosError) {
          return NextResponse.json({ error: `No se pudieron copiar los ingredientes de "${comida.nombre}"` }, { status: 500 })
        }
      }

      // Borrar la comida recurrente original (comida_alimentos se borra en
      // cascada si la FK tiene ON DELETE CASCADE; si no, se limpia antes).
      await admin.from('comida_alimentos').delete().eq('comida_id', comida.id)
      await admin.from('comidas').delete().eq('id', comida.id)
    }

    return NextResponse.json({ ok: true, materializadas: recurrentes.length })
  } catch (err) {
    console.error('[comidas/materializar] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

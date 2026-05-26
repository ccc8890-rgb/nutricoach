import { NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string; recetaId: string }> }
) {
  try {
    const { codigo, recetaId } = await params
    const supabase = createServiceSupabase()

    const { data: plan, error: planError } = await supabase
      .from('planes_nutricion')
      .select('id, comidas(id, receta_id, alternativas_receta_ids)')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
    }

    const recetaPermitida = (plan.comidas ?? []).some((comida: { receta_id?: string | null; alternativas_receta_ids?: string[] | null }) =>
      comida.receta_id === recetaId || (comida.alternativas_receta_ids ?? []).includes(recetaId)
    )
    if (!recetaPermitida) {
      return NextResponse.json({ error: 'Receta no vinculada al plan' }, { status: 403 })
    }

    const [recetaRes, ingredientesRes] = await Promise.all([
      supabase.from('recetas').select('*').eq('id', recetaId).single(),
      supabase
        .from('receta_ingredientes')
        .select('*, alimento:alimentos(*)')
        .eq('receta_id', recetaId)
        .order('cantidad_gramos', { ascending: false }),
    ])

    if (recetaRes.error || !recetaRes.data) {
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({
      receta: recetaRes.data,
      ingredientes: ingredientesRes.data ?? [],
    })
  } catch (err) {
    console.error('[cliente receta] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

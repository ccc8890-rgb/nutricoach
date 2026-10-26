import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { elegirComida, racionDeComida } from '@/lib/nutricion/racion'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string; recetaId: string }> }
) {
  try {
    const { codigo, recetaId } = await params
    const auth = await autorizarAccesoPlan(request, codigo)
    if (auth instanceof NextResponse) return auth
    const supabase = createServiceSupabase()

    const { data: plan, error: planError } = await supabase
      .from('planes_nutricion')
      .select('id, cliente_id, comidas(id, nombre, dia_semana, receta_id, alternativas_receta_ids)')
      .eq('codigo_publico', codigo)
      .eq('activo', true)
      .single()

    if (planError || !plan) {
      return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
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

    // Antes solo se podía ver una receta si estaba vinculada a una comida
    // del plan (403 en cualquier otro caso) — eso impedía explorar el
    // recetario más allá de lo ya asignado. Cualquier receta aprobada es
    // contenido curado y público del coach, así que basta con que esté
    // aprobada; las vinculadas al plan también se ven aunque cambien de
    // estado más adelante.
    const recetaPermitida = (plan.comidas ?? []).some((comida: { receta_id?: string | null; alternativas_receta_ids?: string[] | null }) =>
      comida.receta_id === recetaId || (comida.alternativas_receta_ids ?? []).includes(recetaId)
    ) || recetaRes.data.estado === 'aprobada'
    if (!recetaPermitida) {
      return NextResponse.json({ error: 'Receta no disponible' }, { status: 403 })
    }

    // El vídeo original solo se muestra a los clientes a los que el coach se lo ha activado
    const { data: ajuste } = await supabase.from('clientes').select('ver_video_recetas').eq('id', plan.cliente_id).maybeSingle()
    // Campos internos del coach (notas, calidad, clínico, scraping…) no salen al cliente
    const INTERNOS = ['notas_coach', 'notas_clinicas', 'raw_scrape', 'quality_issues', 'quality_estado_sugerido', 'quality_actualizado_at', 'score_calidad_detalle', 'revisado_clinico',
      'clasificacion_manual', 'recipe_intelligence_detail', 'recipe_intelligence_flags', 'imagen_prompt_base', 'imagen_review_notes', 'imagen_reviewed_by', 'coach_id', 'cliente_id', 'notion_id', 'similar_ids']
    const publica = Object.fromEntries(Object.entries(recetaRes.data).filter(([k]) => !INTERNOS.includes(k)))
    const receta = ajuste?.ver_video_recetas ? publica : { ...publica, url_origen: null }

    // "Tu ración": la comida del plan que lleva esta receta (indicada en el enlace o la de hoy)
    const comidaPlan = elegirComida((plan.comidas ?? []) as { id: string; nombre: string; dia_semana: string | null; receta_id: string | null }[], recetaId, new URL(request.url).searchParams.get('comida'))
    const racion = comidaPlan ? await racionDeComida(supabase, comidaPlan) : null

    // Salsas que combinan («Va bien con…»): solo las aprobadas
    const { data: enlaces } = await supabase.from('receta_salsas').select('salsa_id, orden').eq('receta_id', recetaId).order('orden')
    const salsaIds = (enlaces ?? []).map(e => e.salsa_id)
    const { data: salsasRows } = salsaIds.length
      ? await supabase.from('recetas').select('id, nombre, kcal').in('id', salsaIds).eq('estado', 'aprobada')
      : { data: [] as { id: string; nombre: string; kcal: number | null }[] }
    const salsas = salsaIds.map(id => (salsasRows ?? []).find(s => s.id === id)).filter(Boolean)

    return NextResponse.json({
      racion,
      receta,
      ingredientes: ingredientesRes.data ?? [],
      salsas,
    })
  } catch (err) {
    console.error('[cliente receta] Error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

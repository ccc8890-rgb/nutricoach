// app/api/recetas/alternativas/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, createApiSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const comidaId = searchParams.get('comida_id')
  const clienteId = searchParams.get('cliente_id')

  if (!comidaId) return NextResponse.json({ error: 'comida_id requerido' }, { status: 400 })

  const supabase = createServiceSupabase()

  // 1. Cargar alternativas pre-calculadas desde la comida
  const { data: comida } = await supabase
    .from('comidas')
    .select('alternativas_receta_ids, kcal_target, proteinas_target')
    .eq('id', comidaId)
    .single()

  let alternativaIds: string[] = comida?.alternativas_receta_ids ?? []

  // 2. Si no hay alternativas pre-calculadas, calcular en tiempo real
  if (alternativaIds.length === 0 && comida?.kcal_target) {
    const targetKcal = comida.kcal_target
    const targetProt = comida.proteinas_target ?? 0

    let restricciones: string[] = []
    if (clienteId) {
      const { data: onb } = await supabase
        .from('onboarding_responses')
        .select('restricciones')
        .eq('cliente_id', clienteId)
        .single()
      restricciones = onb?.restricciones ?? []
    }

    const { data: recetas } = await supabase
      .from('recetas')
      .select('id, kcal, proteinas, intolerancias')
      .eq('estado', 'aprobada')
      .gt('kcal', 0)
      .limit(50)

    if (recetas) {
      alternativaIds = recetas
        .filter(r => {
          if (restricciones.length === 0) return true
          const recetaIntol: string[] = r.intolerancias ?? []
          return !restricciones.some(res => recetaIntol.includes(res))
        })
        .map(r => ({
          id: r.id,
          dist: Math.abs((r.kcal - targetKcal) / targetKcal) +
                Math.abs(((r.proteinas ?? 0) - targetProt) / (targetProt || 1)),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 4)
        .map(r => r.id)
    }
  }

  if (alternativaIds.length === 0) {
    return NextResponse.json({ alternativas: [] })
  }

  // 3. Cargar datos completos de las alternativas
  const { data: recetas } = await supabase
    .from('recetas')
    .select('id, nombre, imagen_url, url_origen, kcal, proteinas, carbohidratos, grasas, tiempo_prep_min, tipo_receta')
    .in('id', alternativaIds)

  const alternativas = (recetas ?? []).map(r => ({
    id: r.id,
    nombre: r.nombre,
    imagen_url: r.imagen_url,
    tiene_foto_real: !!r.url_origen,
    kcal: r.kcal,
    proteinas: r.proteinas,
    carbohidratos: r.carbohidratos,
    grasas: r.grasas,
    tiempo_prep_min: r.tiempo_prep_min,
  }))

  return NextResponse.json({ alternativas })
}

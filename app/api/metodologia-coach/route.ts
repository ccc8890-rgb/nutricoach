import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'
import type { MetodologiaCoach } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const service = createServiceSupabase()
  const { data, error } = await service
    .from('metodologia_coach')
    .select('*')
    .eq('coach_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ metodologia: data })
}

export async function PUT(request: NextRequest) {
  const supabase = createApiSupabase(request)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: Partial<MetodologiaCoach>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const service = createServiceSupabase()
  const { data, error } = await service
    .from('metodologia_coach')
    .upsert(
      {
        coach_id: user.id,
        proteina_perdida_grasa: body.proteina_perdida_grasa,
        proteina_recomposicion: body.proteina_recomposicion,
        proteina_rendimiento: body.proteina_rendimiento,
        proteina_ganancia_musculo: body.proteina_ganancia_musculo,
        proteina_salud_general: body.proteina_salud_general,
        reglas_fijas: body.reglas_fijas,
        estilos_dieta: body.estilos_dieta,
        filosofia_coaching: body.filosofia_coaching,
        num_comidas_default: body.num_comidas_default,
        deficit_maximo_kcal: body.deficit_maximo_kcal,
        superavit_maximo_kcal: body.superavit_maximo_kcal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'coach_id' }
    )
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ metodologia: data })
}

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createApiSupabase(request)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const receta_id = searchParams.get('receta_id')
    const limite = parseInt(searchParams.get('limite') ?? '3')

    if (!receta_id) return NextResponse.json({ error: 'receta_id requerido' }, { status: 400 })

    const supabaseService = createServiceSupabase()

    const { data: receta, error } = await supabaseService
      .from('recetas')
      .select('id, nombre, kcal, proteinas, carbohidratos, grasas, tipo_plato, categoria, coach_id')
      .eq('id', receta_id)
      .eq('coach_id', user.id)
      .eq('estado', 'aprobada')
      .single()

    if (error || !receta) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

    const kcal = receta.kcal ?? 0
    const prot = receta.proteinas ?? 0

    if (kcal === 0) {
      return NextResponse.json({ data: [], receta_origen: { id: receta.id, nombre: receta.nombre, kcal, proteinas: prot } })
    }

    let query = supabaseService
      .from('recetas')
      .select('id, nombre, kcal, proteinas, carbohidratos, grasas, imagen_url, categoria, tipo_plato')
      .eq('coach_id', user.id)
      .eq('estado', 'aprobada')
      .neq('id', receta_id)
      .gte('kcal', kcal * 0.88)
      .lte('kcal', kcal * 1.12)
      .gte('proteinas', prot * 0.85)
      .lte('proteinas', prot * 1.15)
      .order('kcal', { ascending: true })
      .limit(limite)

    if (receta.tipo_plato) {
      query = query.eq('tipo_plato', receta.tipo_plato)
    } else if (receta.categoria) {
      query = query.eq('categoria', receta.categoria)
    }

    const { data: alternativas } = await query

    return NextResponse.json({
      data: alternativas ?? [],
      receta_origen: { id: receta.id, nombre: receta.nombre, kcal, proteinas: prot },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

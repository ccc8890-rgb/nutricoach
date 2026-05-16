import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const supabaseAuth = createApiSupabase(request)
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const alimento_id = searchParams.get('alimento_id')
  const kcal = parseFloat(searchParams.get('kcal') ?? '0')
  const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')

  if (!alimento_id || !kcal) {
    return NextResponse.json({ error: 'alimento_id y kcal requeridos' }, { status: 400 })
  }

  const supabase = createServiceSupabase()

  // Obtener categoría del alimento original
  const { data: original } = await supabase
    .from('alimentos')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, categoria')
    .eq('id', alimento_id)
    .single()

  if (!original) return NextResponse.json({ error: 'Alimento no encontrado' }, { status: 404 })

  // Buscar alternativas homólogas por categoría + macros ±15%
  const margenKcal = kcal * 0.15
  const margenProt = proteinas > 0 ? proteinas * 0.20 : 5

  const { data: alternativas } = await supabase
    .from('alimentos')
    .select('id, nombre, kcal, proteinas, carbohidratos, grasas, categoria')
    .eq('categoria', original.categoria)
    .gte('kcal', kcal - margenKcal)
    .lte('kcal', kcal + margenKcal)
    .gte('proteinas', proteinas - margenProt)
    .lte('proteinas', proteinas + margenProt)
    .neq('id', alimento_id)
    .gt('kcal', 0)
    .order('proteinas', { ascending: false })
    .limit(4)

  // Si no hay suficientes por categoría, ampliar la búsqueda por kcal sola
  let resultado = alternativas ?? []
  if (resultado.length < 2) {
    const { data: ampliado } = await supabase
      .from('alimentos')
      .select('id, nombre, kcal, proteinas, carbohidratos, grasas, categoria')
      .gte('kcal', kcal - margenKcal * 1.5)
      .lte('kcal', kcal + margenKcal * 1.5)
      .gte('proteinas', proteinas - margenProt * 1.5)
      .lte('proteinas', proteinas + margenProt * 1.5)
      .neq('id', alimento_id)
      .gt('kcal', 0)
      .order('proteinas', { ascending: false })
      .limit(4)

    resultado = [
      ...resultado,
      ...(ampliado ?? []).filter(a => !resultado.some(r => r.id === a.id)),
    ].slice(0, 3)
  }

  return NextResponse.json({
    original,
    alternativas: resultado.slice(0, 3),
  })
}

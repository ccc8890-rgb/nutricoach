import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const { searchParams } = new URL(request.url)
  const alimentoId = searchParams.get('alimento_id')
  const kcal = parseFloat(searchParams.get('kcal') ?? '0')
  const proteinas = parseFloat(searchParams.get('proteinas') ?? '0')

  if (!alimentoId || !kcal) {
    return NextResponse.json({ error: 'alimento_id y kcal requeridos' }, { status: 400 })
  }

  const db = createServiceSupabase()
  const { data: plan } = await db
    .from('planes_nutricion')
    .select('id')
    .eq('codigo_publico', codigo)
    .eq('activo', true)
    .single()

  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })

  const { data: original } = await db
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, categoria')
    .eq('id', alimentoId)
    .eq('es_comestible', true)
    .single()

  if (!original) return NextResponse.json({ error: 'Alimento no encontrado' }, { status: 404 })

  const margenKcal = kcal * 0.15
  const margenProt = proteinas > 0 ? proteinas * 0.20 : 5
  const kcalCol = 'calorias'

  const { data: alternativasBase } = await db
    .from('alimentos')
    .select('id, nombre, calorias, proteinas, carbohidratos, grasas, categoria')
    .eq('categoria', original.categoria)
    .eq('es_comestible', true)
    .gte(kcalCol, kcal - margenKcal)
    .lte(kcalCol, kcal + margenKcal)
    .gte('proteinas', proteinas - margenProt)
    .lte('proteinas', proteinas + margenProt)
    .neq('id', alimentoId)
    .gt(kcalCol, 0)
    .order('proteinas', { ascending: false })
    .limit(4)

  let alternativas = alternativasBase ?? []
  if (alternativas.length < 2) {
    const { data: ampliadas } = await db
      .from('alimentos')
      .select('id, nombre, calorias, proteinas, carbohidratos, grasas, categoria')
      .eq('es_comestible', true)
      .gte(kcalCol, kcal - margenKcal * 1.5)
      .lte(kcalCol, kcal + margenKcal * 1.5)
      .gte('proteinas', proteinas - margenProt * 1.5)
      .lte('proteinas', proteinas + margenProt * 1.5)
      .neq('id', alimentoId)
      .gt(kcalCol, 0)
      .order('proteinas', { ascending: false })
      .limit(4)

    alternativas = [
      ...alternativas,
      ...(ampliadas ?? []).filter(a => !alternativas.some(r => r.id === a.id)),
    ].slice(0, 3)
  }

  const normalizar = (a: typeof original) => ({
    id: a.id,
    nombre: a.nombre,
    kcal: a.calorias ?? 0,
    proteinas: a.proteinas ?? 0,
    carbohidratos: a.carbohidratos ?? 0,
    grasas: a.grasas ?? 0,
    categoria: a.categoria,
  })

  return NextResponse.json({
    original: normalizar(original),
    alternativas: alternativas.slice(0, 3).map(normalizar),
  })
}

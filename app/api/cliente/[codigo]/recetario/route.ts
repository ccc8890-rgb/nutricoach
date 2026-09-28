import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'

// Mismo mapeo restricción → alérgenos EU que ya usan lib/plan-recetas.ts
// y app/api/recetas/sugeridas/route.ts para generar planes. Se duplica
// aquí en vez de extraerlo porque las otras dos implementaciones son
// piezas sensibles del motor de generación — este endpoint solo lee.
const RESTRICCION_A_ALERGENOS: Record<string, string[]> = {
  'sin gluten':       ['Gluten'],
  'sin lactosa':      ['Lácteos'],
  'sin huevo':        ['Huevos'],
  'sin frutos secos': ['Frutos Secos', 'Cacahuetes'],
  'sin soja':         ['Soja'],
  'sin mariscos':     ['Crustáceos', 'Moluscos'],
  'vegetariano':      ['Pescado', 'Crustáceos', 'Moluscos'],
  'vegano':           ['Lácteos', 'Huevos', 'Pescado', 'Crustáceos', 'Moluscos'],
}
const RESTRICCION_A_TAG_POSITIVO: Record<string, string> = {
  'vegano': 'Vegano',
  'vegetariano': 'Vegetariano',
}

const PAGE_SIZE = 20

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const categoria = searchParams.get('categoria')?.trim() ?? ''
  const page = Math.max(parseInt(searchParams.get('page') ?? '0', 10) || 0, 0)

  const supabase = createServiceSupabase()

  const { data: plan } = await supabase
    .from('planes_nutricion')
    .select('cliente_id')
    .eq('codigo_publico', codigo)
    .maybeSingle()

  if (!plan) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
  }

  const { data: onboarding } = await supabase
    .from('onboarding_responses')
    .select('restricciones')
    .eq('cliente_id', plan.cliente_id)
    .maybeSingle()

  const restricciones = (onboarding?.restricciones as string[] | null) ?? []
  const alergenosExcluir = [...new Set(
    restricciones.flatMap(r => RESTRICCION_A_ALERGENOS[r.toLowerCase()] ?? [])
  )]
  const tagsPositivosRequeridos = [...new Set(
    restricciones
      .map(r => RESTRICCION_A_TAG_POSITIVO[r.toLowerCase()])
      .filter((tag): tag is string => Boolean(tag))
  )]

  // El filtro por restricciones se aplica en memoria (negar "no contiene X
  // en un array" no es una query simple), así que se pagina también en
  // memoria: paginar primero en la query y filtrar después dejaría páginas
  // con menos de 20 resultados o un "hay más" incorrecto para un cliente
  // con muchas restricciones. El recetario tiene un tamaño acotado
  // (cientos de recetas), así que traer todas las que matchean q/categoria
  // y paginar en memoria es correcto y sigue siendo barato.
  let query = supabase
    .from('recetas')
    .select('id, nombre, imagen_url, kcal, proteinas, categoria, intolerancias')
    .eq('estado', 'aprobada')
    .order('nombre', { ascending: true })

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (categoria && categoria !== 'Todos') query = query.eq('categoria', categoria)

  const { data: recetas } = await query
  if (!recetas) return NextResponse.json({ recetas: [], hayMas: false })

  const filtradas = recetas.filter(r => {
    const intol: string[] = r.intolerancias ?? []
    if (alergenosExcluir.length && alergenosExcluir.some(a => intol.includes(a))) return false
    if (tagsPositivosRequeridos.length && !tagsPositivosRequeridos.every(t => intol.includes(t))) return false
    return true
  })

  const inicio = page * PAGE_SIZE
  const pagina = filtradas.slice(inicio, inicio + PAGE_SIZE)

  return NextResponse.json({
    recetas: pagina.map(r => ({
      id: r.id, nombre: r.nombre, imagen_url: r.imagen_url, kcal: r.kcal, proteinas: r.proteinas, categoria: r.categoria,
    })),
    hayMas: filtradas.length > inicio + PAGE_SIZE,
  })
}

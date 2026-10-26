import { expandirRecetas } from '@/lib/recetas/elaboraciones-db'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-server'
import { autorizarAccesoPlan } from '@/lib/cliente/autorizar-escritura-plan'
import { palabrasDeBusqueda, coincidePalabras } from '@/lib/recetas/busqueda'
import { cumpleRestriccionesReligiosas, pideRestriccionReligiosa, contieneCerdo, esHalalPorIngredientes } from '@/lib/recetas/halal'
import { recetaLibreDe, recetaTieneEtiqueta } from '@/lib/recetas-constants'

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
  const auth = await autorizarAccesoPlan(request, codigo)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const categoria = searchParams.get('categoria')?.trim() ?? ''
  // Tipo de ficha (platos por defecto) y familia de cocinero
  const tipoParam = searchParams.get('tipo')?.trim() ?? 'platos'
  const tipo = tipoParam === 'elaboraciones' || tipoParam === 'todo' ? tipoParam : 'platos'
  const familia = searchParams.get('familia')?.trim() ?? ''
  const tag = searchParams.get('tag')?.trim() ?? ''
  // Mismos filtros que la Biblioteca del coach (valores separados por comas)
  const lista = (k: string) => (searchParams.get(k) ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const aptaFiltros = lista('apta')
  const sinFiltros = lista('sin')
  const uso = searchParams.get('uso')?.trim() ?? ''
  const metodo = searchParams.get('metodo')?.trim() ?? ''
  const rangoKcal = searchParams.get('kcal')?.trim() ?? ''
  const tiempoPrep = searchParams.get('tiempo')?.trim() ?? ''
  const page = Math.max(parseInt(searchParams.get('page') ?? '0', 10) || 0, 0)

  const supabase = createServiceSupabase()
  // El filtro por restricciones se aplica en memoria (negar "no contiene X
  // en un array" no es una query simple), así que se pagina también en
  // memoria: paginar primero en la query y filtrar después dejaría páginas
  // con menos de 20 resultados o un "hay más" incorrecto para un cliente
  // con muchas restricciones. El recetario tiene un tamaño acotado
  // (cientos de recetas), así que traer todas las que matchean q/categoria
  // y paginar en memoria es correcto y sigue siendo barato.
  let query = supabase
    .from('recetas')
    .select('id, nombre, imagen_url, kcal, proteinas, categoria, intolerancias, tags, tipo_coccion, tiempo_prep_min, tiempo_coccion_min, premium_chef, estilos, adherencia_score, batch_cooking, tupper, momentos, deportes')
    .eq('estado', 'aprobada')
    .order('nombre', { ascending: true })

  // «cuándo se come» solo tiene sentido en platos; las elaboraciones no se mezclan con ellos salvo en «todo»
  if (tipo === 'platos' && categoria && categoria !== 'Todos') query = query.eq('categoria', categoria)
  if (tipo === 'platos') query = query.neq('tipo_contenido', 'elaboracion')
  if (tipo === 'elaboraciones') query = query.eq('tipo_contenido', 'elaboracion')
  if (familia) query = query.eq('familia', familia)
  // `tag` filtra por ingrediente principal (Pollo/Carne/Pescado/Pasta/...),
  // ya calculado por lib/auto-tag.ts y guardado en recetas.tags. Filtro
  // independiente de `categoria` (tipo de comida) — se pueden combinar.
  if (tag) query = query.contains('tags', [tag])

  // clienteId viene del guard (antes se repetía la consulta del plan); onboarding y recetas van en paralelo.
  const [{ data: onboarding }, { data: recetasBase }] = await Promise.all([
    supabase.from('onboarding_responses').select('restricciones').eq('cliente_id', auth.clienteId).maybeSingle(),
    query,
  ])
  const restricciones = (onboarding?.restricciones as string[] | null) ?? []

  // Halal / Sin cerdo se deciden por los ingredientes: solo en ese caso se pide también la lista de ingredientes
  let recetas: (NonNullable<typeof recetasBase>[number] & { receta_ingredientes?: { nombre_libre?: string | null; alimento?: { nombre?: string | null } | { nombre?: string | null }[] | null }[] })[] | null = recetasBase
  const pideIngredientes = pideRestriccionReligiosa(restricciones) || aptaFiltros.includes('Halal') || sinFiltros.includes('Sin Cerdo')
  if (recetasBase && pideIngredientes) {
    let conIngredientes = supabase
      .from('recetas')
      .select('id, nombre, imagen_url, kcal, proteinas, categoria, intolerancias, tags, tipo_coccion, tiempo_prep_min, tiempo_coccion_min, premium_chef, estilos, adherencia_score, batch_cooking, tupper, momentos, deportes, receta_ingredientes!receta_ingredientes_receta_id_fkey(elaboracion_id, nombre_libre, alimento:alimentos(nombre))')
      .eq('estado', 'aprobada')
      .order('nombre', { ascending: true })
    if (tipo === 'platos' && categoria && categoria !== 'Todos') conIngredientes = conIngredientes.eq('categoria', categoria)
    if (tipo === 'platos') conIngredientes = conIngredientes.neq('tipo_contenido', 'elaboracion')
    if (tipo === 'elaboraciones') conIngredientes = conIngredientes.eq('tipo_contenido', 'elaboracion')
    if (familia) conIngredientes = conIngredientes.eq('familia', familia)
    if (tag) conIngredientes = conIngredientes.contains('tags', [tag])
    const { data } = await conIngredientes
    // Los ingredientes de las elaboraciones enlazadas cuentan para Halal / Sin cerdo
    recetas = await expandirRecetas(supabase, data ?? recetasBase)
  }
  if (!recetas) return NextResponse.json({ recetas: [], hayMas: false })

  const alergenosExcluir = [...new Set(
    restricciones.flatMap(r => RESTRICCION_A_ALERGENOS[r.toLowerCase()] ?? [])
  )]
  const tagsPositivosRequeridos = [...new Set(
    restricciones
      .map(r => RESTRICCION_A_TAG_POSITIVO[r.toLowerCase()])
      .filter((tag): tag is string => Boolean(tag))
  )]


  // Búsqueda por palabras sueltas y sin tildes: «tarta chocolate» encuentra «Tarta de chocolate con…» y «limon» encuentra «limón».
  const buscadas = palabrasDeBusqueda(q)

  const filtradas = recetas.filter(r => {
    if (!coincidePalabras(r.nombre, buscadas)) return false
    const intol: string[] = r.intolerancias ?? []
    if (alergenosExcluir.length && alergenosExcluir.some(a => intol.includes(a))) return false
    if (tagsPositivosRequeridos.length && !tagsPositivosRequeridos.every(t => intol.includes(t))) return false
    if (!cumpleRestriccionesReligiosas(r, restricciones)) return false

    // Las aparcadas (sin fuente real) no se enseñan, igual que en la Biblioteca del coach
    if (Array.isArray(r.tags) && r.tags.includes('Aparcada')) return false

    if (metodo && r.tipo_coccion !== metodo) return false
    if (rangoKcal) {
      if (r.kcal == null) return false
      if (rangoKcal === '<300' && !(r.kcal < 300)) return false
      if (rangoKcal === '300-600' && !(r.kcal >= 300 && r.kcal <= 600)) return false
      if (rangoKcal === '>600' && !(r.kcal > 600)) return false
    }
    if (tiempoPrep) {
      const total = (r.tiempo_prep_min ?? 0) + (r.tiempo_coccion_min ?? 0)
      if (tiempoPrep === '<15' && !(total > 0 && total < 15)) return false
      if (tiempoPrep === '15-30' && !(total >= 15 && total <= 30)) return false
      if (tiempoPrep === '>30' && !(total > 30)) return false
    }
    const estilos: string[] = r.estilos ?? []
    const momentos: string[] = r.momentos ?? []
    const deportes: string[] = r.deportes ?? []
    if (uso === 'chef' && !(r.premium_chef || estilos.includes('chef_healthy') || estilos.includes('comfort_healthy') || estilos.includes('gourmet_simple'))) return false
    if (uso === 'adherencia' && !((r.adherencia_score ?? 0) >= 80)) return false
    if (uso === 'batch' && !(r.batch_cooking || r.tupper || estilos.includes('batch_cooking') || estilos.includes('tupper'))) return false
    if (uso === 'prepost' && !(momentos.includes('pre_entreno') || momentos.includes('post_entreno') || momentos.includes('carga_cho'))) return false
    if (uso === 'endurance' && !['running', 'hyrox', 'endurance', 'triatlon', 'ciclismo'].some(d => deportes.includes(d))) return false

    const tagsInt: string[] = r.intolerancias ?? []
    const okApta = aptaFiltros.every(v => v === 'Halal'
      ? esHalalPorIngredientes(r)
      : v === 'Sin Gluten' || v === 'Sin Lactosa' ? recetaLibreDe(tagsInt, v) : recetaTieneEtiqueta(tagsInt, v))
    if (!okApta) return false
    if (!sinFiltros.every(v => v === 'Sin Cerdo' ? !contieneCerdo(r) : recetaLibreDe(tagsInt, v))) return false
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

import { NextRequest, NextResponse } from 'next/server'
import { createApiSupabase, createServiceSupabase } from '@/lib/supabase-server'

const SYSTEM_PROMPT = `Eres un dietista y chef experto en versiones healthy/fit de recetas.
Crea una receta healthificada completa, apetecible y con macros realistas.

REGLAS (aplicar siempre):
1. Frituras → Air Fryer, horno o plancha
2. Rebozados con harina blanca → copos de avena, cornflakes sin azúcar o pan integral
3. Salsas grasas (mayonesa, nata) → yogur griego 0%, queso cottage, leche evaporada desnatada
4. Aceite en exceso → spray o cantidad mínima
5. Azúcar/miel en exceso → eritritol, stevia, o reducir 70%
6. Pasta/arroz blanco → integral, legumbre o konjac
7. Quesos grasos → ricotta, cottage, mozzarella light, queso fresco 0%
8. Carnes grasas → pechuga pollo/pavo, ternera magra 5%, pescado
9. Harinas refinadas → harina avena, almendra o garbanzos

SALSAS FIT:
- César fit: yogur griego 0% + mostaza + limón + ajo polvo + parmesano + clara cocida
- Bechamel fit: leche desnatada + maicena + queso fresco 0%
- Carbonara fit: cottage + huevo + parmesano
- Alioli fit: yogur griego + ajo + limón

RESPONDE ÚNICAMENTE con JSON válido, sin markdown:
{
  "nombre": "string",
  "descripcion": "string (2-3 frases apetecibles)",
  "tipo_plato": "Comida",
  "categoria": "Carnes|Pescados|Ensaladas|Platos variados|Mealpreps|Postres|Snacks|Desayunos",
  "tipo_coccion": "Horno|Freidora de Aire|Plancha|Sartén/Wok|No Bake|Vapor|Microondas|Olla/Cazuela",
  "dificultad": "Fácil|Medio|Difícil",
  "porciones": 2,
  "tiempo_prep_min": 15,
  "tiempo_coccion_min": 20,
  "instrucciones": "1. Paso breve.\\n2. Paso breve. (máx 8 pasos)",
  "descripcion_porcion": "1 plato",
  "consejos": "string breve opcional",
  "intolerancias": [],
  "ingredientes": [{"nombre": "Pechuga de pollo", "gramos": 200}],
  "cambios_fit": ["Cambio 1", "Cambio 2"]
}`

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

type AlimentoRow = { id: string; nombre: string; calorias: number; proteinas: number; carbohidratos: number; grasas: number }

async function matchIngrediente(nombreLibre: string, supabase: ReturnType<typeof createServiceSupabase>) {
  const n = normalizar(nombreLibre)
  const palabras = n.split(' ').filter((w: string) => w.length > 2)

  // Nivel 1: exact ilike
  const { data: exacto } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas')
    .eq('es_comestible', true).ilike('nombre', nombreLibre).gt('calorias', 0).limit(1)
  if (exacto?.length) return exacto[0]

  // Nivel 2: startsWith — acumula candidatos de TODAS las palabras antes de elegir
  // Tiebreaker: más palabras en común > nombre más corto (genérico gana sobre específico)
  const vistos = new Set<string>()
  const candidatos: Array<AlimentoRow & { score: number }> = []

  for (const palabra of palabras) {
    const { data } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas')
      .eq('es_comestible', true).ilike('nombre', `${palabra}%`).gt('calorias', 0).order('calorias', { ascending: false }).limit(5)
    for (const a of (data || [])) {
      if (vistos.has(a.id)) continue
      vistos.add(a.id)
      const an = normalizar(a.nombre).split(' ')
      const score = palabras.filter((w: string) => an.some((aw: string) => aw.startsWith(w) || w.startsWith(aw))).length
      candidatos.push({ ...a, score })
    }
  }

  if (candidatos.length) {
    // Ordenar: más coincidencias primero, en empate el nombre más corto gana
    candidatos.sort((a, b) => b.score - a.score || a.nombre.length - b.nombre.length)
    if (candidatos[0].score > 0) return candidatos[0]
  }

  // Nivel 3: contains (fallback)
  for (const palabra of palabras) {
    const { data } = await supabase.from('alimentos').select('id, nombre, calorias, proteinas, carbohidratos, grasas')
      .eq('es_comestible', true).ilike('nombre', `%${palabra}%`).gt('calorias', 0).order('nombre', { ascending: true }).limit(3)
    if (data?.length) {
      // Elegir el que más palabras comparte
      const scored = data.map((a: AlimentoRow) => {
        const an = normalizar(a.nombre).split(' ')
        const score = palabras.filter((w: string) => an.includes(w)).length
        return { ...a, score }
      }).sort((a, b) => b.score - a.score || a.nombre.length - b.nombre.length)
      if (scored[0]) return scored[0]
    }
  }

  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabaseAuth = createApiSupabase(req)
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { specs = '', nombre: nombrePersonalizado = '' } = body

  const sbService = createServiceSupabase()

  // Cargar receta original
  const { data: recetaBase } = await sbService.from('recetas')
    .select('nombre, instrucciones, descripcion, porciones, tipo_plato, receta_ingredientes(nombre_libre, cantidad_gramos)')
    .eq('id', id).single()

  if (!recetaBase) return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 })

  const ings = (recetaBase.receta_ingredientes as { nombre_libre: string; cantidad_gramos: number }[] || [])
    .map(i => `${i.nombre_libre} (${i.cantidad_gramos}g)`).join(', ')

  const nombreFit = nombrePersonalizado || `${recetaBase.nombre} Fit`

  const userPrompt = `Receta base: "${recetaBase.nombre}"
Ingredientes: ${ings || 'ver instrucciones'}
Instrucciones: ${recetaBase.instrucciones?.slice(0, 400) || ''}

Crea la versión healthy/fit:
NOMBRE DESEADO: "${nombreFit}"
TIPO DE PLATO: ${recetaBase.tipo_plato || 'Comida'}
PORCIONES: ${recetaBase.porciones || 2}
${specs ? `ESPECIFICACIONES: ${specs}` : ''}`

  // Llamar a DeepSeek
  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY
  if (!DEEPSEEK_KEY) return NextResponse.json({ error: 'DeepSeek no configurado' }, { status: 500 })

  const dsRes = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }],
      temperature: 0.4,
      max_tokens: 6000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(180000),
  })

  if (!dsRes.ok) {
    const err = await dsRes.text()
    return NextResponse.json({ error: `DeepSeek error: ${err.slice(0, 200)}` }, { status: 500 })
  }

  const dsData = await dsRes.json()
  const recetaGenerada = JSON.parse(dsData.choices?.[0]?.message?.content ?? '{}')

  // Matchear ingredientes y calcular macros
  let totalKcal = 0, totalProt = 0, totalCarbs = 0, totalGrasas = 0
  const ingredientesInsert = []

  for (const ing of (recetaGenerada.ingredientes || [])) {
    const alimento = await matchIngrediente(ing.nombre, sbService)
    const factor = ing.gramos / 100
    if (alimento) {
      totalKcal += (alimento.calorias || 0) * factor
      totalProt += (alimento.proteinas || 0) * factor
      totalCarbs += (alimento.carbohidratos || 0) * factor
      totalGrasas += (alimento.grasas || 0) * factor
    }
    ingredientesInsert.push({
      nombre_libre: ing.nombre,
      cantidad_gramos: ing.gramos,
      alimento_id: alimento?.id ?? null,
    })
  }

  const porciones = recetaGenerada.porciones || recetaBase.porciones || 2

  // Insertar receta fit
  const { data: nuevaReceta, error: insertError } = await sbService.from('recetas').insert({
    nombre: recetaGenerada.nombre || nombreFit,
    descripcion: recetaGenerada.descripcion || null,
    instrucciones: recetaGenerada.instrucciones || null,
    consejos: recetaGenerada.consejos || null,
    tipo_plato: recetaGenerada.tipo_plato || recetaBase.tipo_plato || 'Comida',
    categoria: recetaGenerada.categoria || 'Platos variados',
    tipo_coccion: recetaGenerada.tipo_coccion || 'Horno',
    dificultad: recetaGenerada.dificultad || 'Fácil',
    porciones,
    descripcion_porcion: recetaGenerada.descripcion_porcion || null,
    tiempo_prep_min: recetaGenerada.tiempo_prep_min || 15,
    tiempo_coccion_min: recetaGenerada.tiempo_coccion_min || 20,
    kcal: Math.round(totalKcal / porciones * 10) / 10,
    proteinas: Math.round(totalProt / porciones * 10) / 10,
    carbohidratos: Math.round(totalCarbs / porciones * 10) / 10,
    grasas: Math.round(totalGrasas / porciones * 10) / 10,
    intolerancias: recetaGenerada.intolerancias || [],
    estado: 'aprobada',
    coach_id: user.id,
    receta_original_id: id,
  }).select('id, nombre').single()

  if (insertError || !nuevaReceta) {
    return NextResponse.json({ error: insertError?.message || 'Error al insertar' }, { status: 500 })
  }

  // Insertar ingredientes
  if (ingredientesInsert.length) {
    await sbService.from('receta_ingredientes').insert(
      ingredientesInsert.map((ing, i) => ({ ...ing, receta_id: nuevaReceta.id, orden: i + 1 }))
    )
  }

  return NextResponse.json({
    id: nuevaReceta.id,
    nombre: nuevaReceta.nombre,
    cambios_fit: recetaGenerada.cambios_fit || [],
    macros: { kcal: Math.round(totalKcal / porciones), proteinas: Math.round(totalProt / porciones), carbohidratos: Math.round(totalCarbs / porciones), grasas: Math.round(totalGrasas / porciones) },
  })
}

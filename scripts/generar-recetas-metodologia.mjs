/**
 * generar-recetas-metodologia.mjs
 *
 * Genera recetas nuevas siguiendo la metodología de Carlos Casanova:
 * - Estilo híbrido: base mediterránea española + toques internacionales
 * - Foto-friendly: platos atractivos, colores vivos, presentación food blogger
 * - Ingredientes de Mercadona/Carrefour, ≤30 min prep
 * - Proteína prominente en cada plato
 *
 * Foco de generación (gaps detectados en auditoría):
 *   GAP_1: Snacks rendimiento + post-entreno (0 en BD)
 *   GAP_2: Desayunos rendimiento (6 en BD, necesita 15+)
 *   GAP_3: Meriendas variadas (16 en BD, insuficiente)
 *   GAP_4: Postres/snacks aptos SOP/Hashimoto
 *
 * Uso:
 *   node scripts/generar-recetas-metodologia.mjs --dry-run      # ver sin insertar
 *   node scripts/generar-recetas-metodologia.mjs --lote snacks  # solo snacks
 *   node scripts/generar-recetas-metodologia.mjs --lote desayunos
 *   node scripts/generar-recetas-metodologia.mjs --lote meriendas
 *   node scripts/generar-recetas-metodologia.mjs --lote sop
 *   node scripts/generar-recetas-metodologia.mjs --todo          # todos los lotes
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Cargar .env.local ──────────────────────────────────────────
const envPath = join(__dirname, '..', '.env.local')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions'

// ── Coach ID ──────────────────────────────────────────────────
const { data: coachProfile } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', 'ccc8890@gmail.com')
  .maybeSingle()

const COACH_ID = coachProfile?.id
if (!COACH_ID) { console.error('❌ Coach no encontrado'); process.exit(1) }

// ── Parámetros CLI ────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
const loteArg = args.includes('--lote') ? args[args.indexOf('--lote') + 1] : null
const TODOS = args.includes('--todo')

// ── METODOLOGÍA DEL COACH (inyectada en cada prompt) ─────────
const METODOLOGIA = `
METODOLOGÍA CARLOS CASANOVA — DIETISTA DEPORTIVO (Valencia, España)

FILOSOFÍA:
Comida real, sabrosa y mediterránea adaptada al deportista moderno. No es dieta,
es educación alimentaria. Cada plato debe ser visualmente atractivo (Instagram-worthy),
usar ingredientes accesibles en cualquier supermercado español, y cocinarse en ≤30 min.

ESTILO VISUAL:
- Platos coloridos con protagonismo de la proteína
- Salsas, aliños y toppings creativos (no solo sal y aceite)
- Presentación tipo food blogger: bowls, wraps, tostadas apiladas, tarros overnight
- Colores: verdes, rojos, naranjas — nunca platos beiges y aburridos

INGREDIENTES FAVORITOS:
Proteínas: pechuga pollo, salmón, atún, merluza, huevos, claras, queso fresco batido,
           queso cottage, yogur griego 0%, skyr, fiambre pavo, gambas, mejillones
Hidratos: arroz basmati, pasta integral, boniato, avena, pan proteico, legumbres,
          quinoa, arroz de coliflor (para bajo CHO)
Grasas buenas: aguacate, AOVE, nueces, almendras, semillas chía/lino/cáñamo, hummus
Verduras base: espinacas, rúcula, pepino, tomate cherry, pimiento, calabacín, brócoli
Saborizantes: limón, jengibre, cúrcuma, canela, tahini, salsa sriracha, salsa de soja,
              miso, mostaza Dijon, vinagre de manzana, hierbas frescas

REGLAS DE RECETA:
1. Proteína por porción: desayuno ≥15g, comida/cena ≥25g, snack ≥10g, merienda ≥12g
2. Tiempo preparación: ≤30 min activos (puede haber tiempo de reposo)
3. Nombre atractivo y descriptivo (ej: "Bowl de salmón teriyaki con edamame" no "Salmón con arroz")
4. Instrucciones claras en 4-6 pasos, con trucos visuales (cómo emplatarlo bien)
5. Incluir SIEMPRE: descripción del plato (2-3 frases evocadoras), consejos de prep/variación
6. Ingredientes: cantidades en gramos o medidas caseras claras (1 cucharada = 15g)
7. Ingredientes de Mercadona o Carrefour — nada exótico que no se encuentre en España
`

// ── LOTES DE RECETAS A GENERAR ────────────────────────────────
const LOTES = {
  snacks: {
    label: 'Snacks Rendimiento & Post-Entreno',
    tipo_plato: 'Snack',
    count: 10,
    tags_clinicos: { apto_rendimiento: true, es_post_entreno: true, apto_meal_prep: true },
    prompt_extra: `
OBJETIVO: Snacks proteicos para deportistas. Post-entreno o entre comidas.
PERFIL: Rápidos de preparar (≤10 min), alta proteína (≥12g por porción),
        portables o de prep rápida. Sin cocción si posible.

EJEMPLOS DE ESTILO (no copiar, inspirar):
- Tarro de queso cottage con frutos rojos y nueces
- Tortitas de avena y clara con miel
- Bowl de yogur griego con granola proteica y mango
- Mini wraps de pavo y hummus
- Pudding de chía con leche vegetal y cacao
- Arroz con leche proteico de canela
- Bolas de dátil, almendra y cacao (energy balls)
- Crackers de semillas con aguacate y salmón ahumado
- Mousse de queso fresco y fresa
- Tostada proteica con cottage y fresas laminadas

TIPOS A INCLUIR: Mix de dulces y salados, algunos sin cocción, algunos calientes.
RESTRICCIONES: Sin fritos, sin ultraprocesados. Ingredientes simples.
    `,
  },

  desayunos: {
    label: 'Desayunos Rendimiento & SOP',
    tipo_plato: 'Desayuno',
    count: 5,
    tags_clinicos: { apto_rendimiento: true, apto_sop: true, apto_hashimoto: true },
    prompt_extra: `
OBJETIVO: Desayunos proteicos para deportistas y clientas con SOP/Hashimoto.
PERFIL: Alta proteína (≥18g), IG bajo-medio, saciantes, visualmente atractivos.
        Algunos pre-entreno (carbos moderados + proteína) y otros día de descanso (proteína + grasas).

EJEMPLOS DE ESTILO:
- Overnight oats de proteína con cacao y mantequilla de almendra
- Tostada de boniato con aguacate y huevo poché
- Bowl de skyr con granola casera, semillas y kiwi
- Wrap de tortilla de espinacas con claras y salmón
- Porridge de avena con proteína y frutos del bosque
- Tortitas proteicas de plátano y avena
- Revuelto de claras con espárragos y queso fresco
- Smoothie bowl de espinacas, plátano y proteína
- Crepes de avena rellenas de queso cottage y fresa
- Muesli overnight con leche de avena, chía y frambuesas

CLAVE PARA SOP/HASHIMOTO:
- Sin azúcares añadidos (usar dátiles, plátano, miel en pequeña cantidad)
- Incluir semillas (chía, lino, cáñamo) para omega-3
- Preferir avena vs pan blanco
- Proteína animal de calidad (huevo, yogur, skyr)
    `,
  },

  meriendas: {
    label: 'Meriendas Variadas',
    tipo_plato: 'Merienda',
    count: 8,
    tags_clinicos: { apto_sop: true, apto_meal_prep: true },
    prompt_extra: `
OBJETIVO: Meriendas saciantes y variadas. Entre comida y cena.
PERFIL: Moderadas en kcal (200-350), proteína ≥12g, preparación ≤15 min.
        Mix de dulces fit y opciones saladas.

EJEMPLOS:
- Donut fit de avena horneado con glaseado de proteína
- Flan de requesón con canela
- Crackers de semillas con aguacate y tomate cherry
- Muffin de proteína chocolate-plátano
- Batido verde saciante (espinaca + plátano + proteína)
- Bowl de queso fresco con melocotón y pistachos
- Pan proteico con AOVE y tomate (pa amb tomaquet proteico)
- Cookies de avena y chocolate negro sin azúcar
    `,
  },

  sop: {
    label: 'Postres & Snacks Aptos SOP/Hashimoto',
    tipo_plato: 'Postre',
    count: 8,
    tags_clinicos: { apto_sop: true, apto_hashimoto: true, apto_diabetes: true },
    prompt_extra: `
OBJETIVO: Postres y dulces que puedan comer clientas con SOP, Hashimoto o resistencia a la insulina.
PERFIL: Sin azúcar añadida o mínima (usar dátiles, eritritol, stevia natural),
        IG bajo, anti-inflamatorios, visualmente irresistibles.

CRITERIOS ESTRICTOS:
- Azúcar añadida < 5g por porción (usar dátiles, plátano, canela para dulzor natural)
- Sin harina refinada (usar avena, harina de almendra, coco)
- Incluir grasas antiinflamatorias (aguacate, aceite de coco, almendras, nueces)
- Proteína: ≥8g por porción (proteína en polvo, claras, yogur griego, queso cottage)

EJEMPLOS:
- Brownie de boniato y cacao sin azúcar
- Tarta de queso sin base con frutas del bosque
- Mousse de aguacate y cacao (tipo "chocolate mousse")
- Helado de banana y mantequilla de cacahuete (nice cream)
- Cookies de avena, chía y chocolate negro 85%
- Vasitos de yogur griego con compota de fresa sin azúcar
- Coulant de dátiles y almendra
- Trufas de cacao, nueces y dátiles (raw balls)
    `,
  },
}

// ── FUNCIÓN: Generar recetas con DeepSeek ────────────────────
async function generarLote(loteKey) {
  const lote = LOTES[loteKey]
  if (!lote) { console.error(`❌ Lote "${loteKey}" no existe`); return [] }

  console.log(`\n🍽️  Generando lote: ${lote.label} (${lote.count} recetas)...`)

  const prompt = `${METODOLOGIA}

${lote.prompt_extra}

INSTRUCCIÓN:
Genera exactamente ${lote.count} recetas diferentes siguiendo la metodología descrita.
Cada receta debe ser ÚNICA, con nombre atractivo, ingredientes concretos y macros calculados.

REGLAS DE MACROS:
- Todos los macros son POR PORCIÓN (no totales)
- kcal = proteinas*4 + carbohidratos*4 + grasas*9 (aproximado)
- Sé preciso: 200g pollo pechuga = 44g proteína, 2g grasa, 220 kcal

RESPONDE ÚNICAMENTE EN JSON VÁLIDO con esta estructura exacta:
{
  "recetas": [
    {
      "nombre": "Nombre atractivo del plato",
      "descripcion": "2-3 frases evocadoras que dan ganas de cocinarlo",
      "tipo_plato": "${lote.tipo_plato}",
      "categoria": "elige la más apropiada: Desayuno|Snack|Merienda|Postre|Comida|Cena|Entrante",
      "dificultad": "Fácil|Medio",
      "porciones": 1,
      "tiempo_prep_min": número (tiempo activo cocinando, sin esperas),
      "tiempo_coccion_min": número o 0,
      "kcal": número por porción,
      "proteinas": número en g por porción,
      "carbohidratos": número en g por porción,
      "grasas": número en g por porción,
      "fibra": número en g por porción,
      "ingredientes": [
        { "nombre": "nombre en español", "cantidad_gramos": número, "unidad_visual": "descripción para el cliente ej: 150g / 1 taza" }
      ],
      "instrucciones": "Paso 1: descripción. Paso 2: descripción. (4-6 pasos claros, incluir cómo emplatar visualmente)",
      "consejos": "1-2 trucos prácticos: variaciones, conservación, o tip visual para la foto",
      "intolerancias": ["Sin Gluten" si aplica, "Sin Lactosa" si aplica, "Vegetariano" si aplica, "Vegano" si aplica],
      "tags": ["tag1", "tag2", "tag3"],
      "es_post_entreno": true/false,
      "es_pre_entreno": true/false,
      "apto_sop": true/false,
      "apto_hashimoto": true/false,
      "apto_rendimiento": true/false,
      "apto_meal_prep": true/false,
      "ig_estimado": "bajo|medio|alto",
      "carga_inflamatoria": "baja|media|alta",
      "notas_clinicas": "nota breve si hay algo relevante clínicamente (opcional, puede ser null)"
    }
  ]
}`

  try {
    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'Eres un chef nutricionista experto en cocina mediterránea fit. Generas recetas precisas con macros calculados correctamente. Respondes SOLO en JSON válido.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 8000,
      }),
    })

    if (!response.ok) {
      console.error(`❌ DeepSeek error ${response.status}:`, await response.text())
      return []
    }

    const ds = await response.json()
    const texto = ds.choices?.[0]?.message?.content ?? ''
    const parsed = JSON.parse(texto)
    const recetas = parsed.recetas ?? []
    console.log(`  ✅ ${recetas.length} recetas generadas`)
    return recetas.map(r => ({ ...r, ...lote.tags_clinicos }))
  } catch (err) {
    console.error('❌ Error generando lote:', err.message)
    return []
  }
}

// ── FUNCIÓN: Buscar alimento en BD ───────────────────────────
async function buscarAlimento(nombre) {
  const normalizado = nombre.toLowerCase().trim()

  const { data: exacto } = await supabase
    .from('alimentos')
    .select('id, nombre, calorias')
    .ilike('nombre', normalizado)
    .eq('es_comestible', true)
    .limit(1)
  if (exacto?.[0]) return exacto[0]

  const palabras = normalizado.split(/\s+/).filter(p => p.length > 3)
  for (const palabra of palabras) {
    const { data: parcial } = await supabase
      .from('alimentos')
      .select('id, nombre, calorias')
      .ilike('nombre', `%${palabra}%`)
      .eq('es_comestible', true)
      .limit(1)
    if (parcial?.[0]) return parcial[0]
  }

  return null
}

// ── FUNCIÓN: Insertar receta en BD ───────────────────────────
async function insertarReceta(receta) {
  // 1. Insertar en recetas
  const { data: recetaDb, error } = await supabase
    .from('recetas')
    .insert({
      coach_id: COACH_ID,
      nombre: receta.nombre,
      descripcion: receta.descripcion,
      tipo_plato: receta.tipo_plato,
      categoria: receta.categoria ?? receta.tipo_plato,
      dificultad: receta.dificultad ?? 'Fácil',
      porciones: receta.porciones ?? 1,
      tiempo_prep_min: receta.tiempo_prep_min ?? null,
      tiempo_coccion_min: receta.tiempo_coccion_min ?? null,
      kcal: receta.kcal,
      proteinas: receta.proteinas,
      carbohidratos: receta.carbohidratos,
      grasas: receta.grasas,
      fibra: receta.fibra ?? null,
      instrucciones: receta.instrucciones,
      consejos: receta.consejos ?? null,
      intolerancias: receta.intolerancias ?? [],
      tags: receta.tags ?? [],
      // ⚠️  Se deja en_revision porque este script .mjs no puede ejecutar auditarRecetaProfesional (TS).
      // La receta deberá pasar por el quality gate manualmente o mediante otro script.
      estado: 'en_revision',
      fuente_tipo: 'ia_generada',
      // Tags clínicos
      apto_sop: receta.apto_sop ?? false,
      apto_hashimoto: receta.apto_hashimoto ?? false,
      apto_diabetes: receta.apto_diabetes ?? false,
      apto_rendimiento: receta.apto_rendimiento ?? false,
      es_post_entreno: receta.es_post_entreno ?? false,
      es_pre_entreno: receta.es_pre_entreno ?? false,
      apto_meal_prep: receta.apto_meal_prep ?? false,
      // Scores
      ig_estimado: receta.ig_estimado ?? null,
      carga_inflamatoria: receta.carga_inflamatoria ?? null,
      densidad_proteica: receta.kcal > 0 ? Math.round((receta.proteinas * 4 / receta.kcal) * 100) : null,
      score_saciedad: receta.proteinas >= 30 ? 5
        : receta.proteinas >= 25 ? 4
        : receta.proteinas >= 15 ? 3
        : receta.proteinas >= 8 ? 2 : 1,
      notas_clinicas: receta.notas_clinicas ?? null,
      revisado_clinico: true,
    })
    .select('id')
    .single()

  if (error || !recetaDb) {
    console.error(`    ❌ Error insertando "${receta.nombre}":`, error?.message)
    return null
  }

  // 2. Insertar ingredientes vinculados
  let ingredientesVinculados = 0
  for (const ing of (receta.ingredientes ?? [])) {
    const alimento = await buscarAlimento(ing.nombre)
    if (!alimento) continue

    await supabase.from('receta_ingredientes').insert({
      receta_id: recetaDb.id,
      alimento_id: alimento.id,
      nombre_libre: ing.nombre,
      cantidad_gramos: ing.cantidad_gramos ?? 100,
    })
    ingredientesVinculados++
  }

  return { id: recetaDb.id, ingredientes_vinculados: ingredientesVinculados, total_ingredientes: receta.ingredientes?.length ?? 0 }
}

// ── MAIN ─────────────────────────────────────────────────────
const lotesAEjecutar = TODOS
  ? Object.keys(LOTES)
  : loteArg
    ? [loteArg]
    : Object.keys(LOTES) // por defecto todos

console.log('═══════════════════════════════════════════════════════')
console.log('  GENERADOR DE RECETAS — METODOLOGÍA CARLOS CASANOVA')
console.log(`  Modo: ${DRY ? '🔍 DRY RUN (sin insertar)' : '🚀 INSERCIÓN REAL'}`)
console.log(`  Lotes: ${lotesAEjecutar.join(', ')}`)
console.log('═══════════════════════════════════════════════════════')

let totalGeneradas = 0
let totalInsertadas = 0

for (const loteKey of lotesAEjecutar) {
  const recetas = await generarLote(loteKey)
  totalGeneradas += recetas.length

  if (DRY) {
    console.log(`\n📋 Preview "${loteKey}":`)
    recetas.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.nombre}`)
      console.log(`     ${r.kcal} kcal | ${r.proteinas}g P | ${r.carbohidratos}g C | ${r.grasas}g G`)
      console.log(`     Tags: sop=${r.apto_sop} | rendimiento=${r.apto_rendimiento} | post=${r.es_post_entreno} | ig=${r.ig_estimado}`)
    })
    continue
  }

  console.log(`\n💾 Insertando recetas de "${loteKey}"...`)
  for (const receta of recetas) {
    process.stdout.write(`  → ${receta.nombre}... `)
    const resultado = await insertarReceta(receta)
    if (resultado) {
      totalInsertadas++
      console.log(`✅ (${resultado.ingredientes_vinculados}/${resultado.total_ingredientes} ingredientes vinculados)`)
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════')
console.log(`  RESUMEN FINAL`)
console.log(`  Recetas generadas: ${totalGeneradas}`)
if (!DRY) console.log(`  Recetas insertadas: ${totalInsertadas}`)
console.log('═══════════════════════════════════════════════════════')

// ── Mostrar nueva cobertura tras inserción ────────────────────
if (!DRY && totalInsertadas > 0) {
  const { data: stats } = await supabase
    .from('recetas')
    .select('tipo_plato, apto_sop, apto_rendimiento, es_post_entreno, estado')
    .eq('estado', 'aprobada')

  const resumen = {}
  for (const r of (stats ?? [])) {
    if (!resumen[r.tipo_plato]) resumen[r.tipo_plato] = { total: 0, sop: 0, rendimiento: 0, post: 0 }
    resumen[r.tipo_plato].total++
    if (r.apto_sop) resumen[r.tipo_plato].sop++
    if (r.apto_rendimiento) resumen[r.tipo_plato].rendimiento++
    if (r.es_post_entreno) resumen[r.tipo_plato].post++
  }

  console.log('\n📊 COBERTURA ACTUALIZADA:')
  console.log('  Tipo            | Total | SOP | Rendimiento | Post-Entreno')
  console.log('  ─────────────────────────────────────────────────────────')
  for (const [tipo, s] of Object.entries(resumen).sort((a, b) => b[1].total - a[1].total)) {
    const pad = tipo.padEnd(15)
    console.log(`  ${pad} | ${String(s.total).padStart(5)} | ${String(s.sop).padStart(3)} | ${String(s.rendimiento).padStart(11)} | ${String(s.post).padStart(12)}`)
  }
}

import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  construirPromptLoteRecetas,
  extraerJsonLoteRecetas,
  MAX_OUTPUT_TOKENS_LOTE,
  normalizarRequestLoteRecetas,
  type LoteRecetasRequest,
} from '../lib/recetas/generacion-lote'
import { normalizarRecetasGeneradas, type RecetaImportable } from '../lib/recetas/importar-lote'
import { construirPromptImagenReceta, inferirPresetImagenReceta } from '../lib/recetas/imagen-prompts'
import { RECETA_CHEF_COLECCIONES } from '../lib/recetario-taxonomia'

dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const APPLY = process.argv.includes('--apply')
const COUNT_ARG = process.argv.includes('--count') ? Number(process.argv[process.argv.indexOf('--count') + 1]) : 4
const LOTES_ARG = process.argv.includes('--lotes') ? String(process.argv[process.argv.indexOf('--lotes') + 1]) : 'comfort-healthy,performance-bowls,batch-gourmet'
const LOTES = LOTES_ARG.split(',').map(s => s.trim()).filter(Boolean)
const MAX_RECIPES_PER_LOTE = Math.max(1, Math.min(Number.isFinite(COUNT_ARG) ? COUNT_ARG : 4, 6))
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const TIPOS_PLATO_VALIDOS = ['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Snack', 'Postre'] as const

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
}
if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('Falta DEEPSEEK_API_KEY')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function getCoachId() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', 'ccc8890@gmail.com')
    .maybeSingle()

  if (profile?.id) return profile.id as string

  const { data: receta } = await supabase
    .from('recetas')
    .select('coach_id')
    .not('coach_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (receta?.coach_id) return receta.coach_id as string
  throw new Error('No se pudo resolver coach_id')
}

function promptParaColeccion(collectionId: string) {
  const collection = RECETA_CHEF_COLECCIONES.find(c => c.id === collectionId)
  if (!collection) throw new Error(`Colección no encontrada: ${collectionId}`)

  const input = normalizarRequestLoteRecetas({
    bloque: collection.bloque,
    tipo: 'manual',
    cantidad: MAX_RECIPES_PER_LOTE,
    objetivo: collection.objetivo,
    deporte: collection.deporte,
    momento: collection.momento,
    estilo: collection.estilo,
    confirmar: true,
    proveedor: 'deepseek',
  } satisfies LoteRecetasRequest)

  const base = construirPromptLoteRecetas(input)
  const direccion = [
    '',
    'DIRECCION ESPECIFICA DE ESTA COLECCION:',
    `- Colección: ${collection.titulo}`,
    `- Intención: ${collection.descripcion}`,
    ...collection.direccion.map(line => `- ${line}`),
    '',
    'EXIGENCIA VISUAL PARA FUTURAS FOTOS:',
    '- Cada receta debe poder fotografiarse como comida real, no como render ni stock genérico.',
    '- El plato debe tener 3-5 elementos visualmente reconocibles y textura clara.',
    '- Evitar platos monocromos, secos, beige o con emplatado de dieta restrictiva.',
  ].join('\n')

  return { collection, prompt: `${base}${direccion}` }
}

async function generarRecetas(collectionId: string) {
  const { collection, prompt } = promptParaColeccion(collectionId)
  console.log(`\nGenerando ${MAX_RECIPES_PER_LOTE} recetas: ${collection.titulo}`)

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Eres chef nutricional y dietista deportivo. Respondes solo JSON válido. Recetas realistas para España.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.72,
      max_tokens: MAX_OUTPUT_TOKENS_LOTE,
    }),
  })

  if (!response.ok) {
    const detalle = await response.text()
    throw new Error(`DeepSeek ${response.status}: ${detalle.slice(0, 500)}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('DeepSeek devolvió contenido vacío')

  const parsed = extraerJsonLoteRecetas(content)
  const recetas = normalizarRecetasGeneradas(parsed.recetas)
  return {
    collection,
    recetas,
    tokens: data.usage ?? null,
  }
}

async function recetaExiste(nombre: string, coachId: string) {
  const { data } = await supabase
    .from('recetas')
    .select('id')
    .eq('nombre', nombre)
    .eq('coach_id', coachId)
    .maybeSingle()
  return data?.id as string | undefined
}

async function recetaTieneIngredientes(recetaId: string) {
  const { count, error } = await supabase
    .from('receta_ingredientes')
    .select('id', { count: 'exact', head: true })
    .eq('receta_id', recetaId)

  if (error) throw new Error(`No se pudieron comprobar ingredientes: ${error.message}`)
  return Boolean(count && count > 0)
}

function recetaParaPrompt(receta: RecetaImportable) {
  return {
    ...receta,
    receta_ingredientes: receta.ingredientes.map(ing => ({
      nombre_libre: ing.nombre_libre,
      cantidad_gramos: ing.cantidad_gramos,
    })),
  }
}

function normalizarTipoPlato(tipoPlato: string | null, categoria: string | null, collectionId: string) {
  if (TIPOS_PLATO_VALIDOS.includes(tipoPlato as (typeof TIPOS_PLATO_VALIDOS)[number])) return tipoPlato
  const raw = `${tipoPlato ?? ''} ${categoria ?? ''}`.toLowerCase()
  if (raw.includes('desayuno') || raw.includes('breakfast')) return 'Desayuno'
  if (raw.includes('almuerzo') || raw.includes('media mañana') || raw.includes('media_manana')) return 'Almuerzo'
  if (raw.includes('merienda')) return 'Merienda'
  if (raw.includes('snack') || raw.includes('tentempi')) return 'Snack'
  if (raw.includes('postre') || raw.includes('dulce')) return 'Postre'
  if (raw.includes('cena')) return 'Cena'
  if (raw.includes('comida') || raw.includes('principal') || raw.includes('plato')) return 'Comida'
  if (collectionId === 'pre-race') return 'Snack'
  return 'Comida'
}

function formatearInstrucciones(instrucciones: string | null) {
  if (!instrucciones) return instrucciones
  return instrucciones
    .replace(/\s+(\d+[\.)]\s+)/g, '\n$1')
    .replace(/^\n+/, '')
    .trim()
}

function inferirIntolerancias(receta: RecetaImportable) {
  const texto = `${receta.nombre} ${receta.descripcion ?? ''} ${receta.ingredientes.map(i => i.nombre_libre).join(' ')}`.toLowerCase()
  const tags = new Set<string>()

  const tieneGluten = /\b(trigo|pan|tortilla|wrap|pasta|cuscus|couscous|harina|seitan|seitán|cebada|centeno|bulgur|pan rallado)\b/.test(texto)
  const tieneLactosa = /\b(yogur|yogurt|leche|queso|nata|mantequilla|kefir|kéfir|mozzarella|parmesano|ricotta)\b/.test(texto)
  const tieneHuevo = /\b(huevo|claras|yema)\b/.test(texto)
  const tienePescadoOMarisco = /\b(salmon|salmón|atun|atún|merluza|bacalao|gamba|langostino|sepia|pulpo|rape|dorada|lubina)\b/.test(texto)
  const tieneCarne = /\b(pollo|pavo|ternera|cerdo|jamon|jamón|lomo|carne|bacon|beicon)\b/.test(texto)
  const tieneFrutosSecos = /\b(almendra|nuez|nueces|avellana|pistacho|cacahuete|anacardo|tahini|sesamo|sésamo)\b/.test(texto)

  if (!tieneGluten) tags.add('Sin Gluten')
  if (!tieneLactosa) tags.add('Sin Lactosa')
  if (!tieneHuevo) tags.add('Sin Huevo')
  if (!tieneFrutosSecos) tags.add('Sin Frutos Secos')
  if (!tieneCarne && !tienePescadoOMarisco) tags.add('Vegetariano')
  if (!tieneCarne && !tienePescadoOMarisco && !tieneLactosa && !tieneHuevo) tags.add('Vegano')

  return [...tags]
}

async function insertarReceta(receta: RecetaImportable, coachId: string, collectionId: string) {
  const existente = await recetaExiste(receta.nombre, coachId)
  if (existente) {
    if (!(await recetaTieneIngredientes(existente)) && receta.ingredientes.length) {
      await insertarIngredientes(existente, receta)
      return { id: existente, nombre: receta.nombre, skipped: false, repaired: true }
    }
    return { id: existente, nombre: receta.nombre, skipped: true }
  }

  const preset = inferirPresetImagenReceta(recetaParaPrompt(receta))
  const promptImagen = construirPromptImagenReceta(recetaParaPrompt(receta), preset)
  const { ingredientes, tags, ...recetaBase } = receta

  const { data, error } = await supabase
    .from('recetas')
    .insert({
      ...recetaBase,
      instrucciones: formatearInstrucciones(receta.instrucciones),
      intolerancias: inferirIntolerancias(receta),
      tipo_plato: normalizarTipoPlato(receta.tipo_plato, receta.categoria, collectionId),
      tags: [...new Set([...tags, 'chef_healthy_batch', collectionId])],
      coach_id: coachId,
      estado: 'en_revision',
      fuente: 'ia_lote_deepseek',
      fuente_tipo: 'ia_generada',
      taxonomia_version: 2,
      taxonomia_actualizada_at: new Date().toISOString(),
      imagen_origen: 'missing',
      imagen_estado: 'sin_imagen',
      imagen_quality_score: 0,
      imagen_realismo_score: 0,
      imagen_match_receta_score: 0,
      imagen_needs_review: true,
      imagen_estilo_preset: preset,
      imagen_prompt_base: promptImagen,
      imagen_review_notes: 'Receta nueva generada por lote chef healthy. Requiere imagen realista o revisión antes de aprobar.',
    })
    .select('id, nombre')
    .single()

  if (error || !data) throw new Error(error?.message || `No se pudo insertar ${receta.nombre}`)

  if (ingredientes.length) await insertarIngredientes(data.id as string, receta)

  return { id: data.id as string, nombre: data.nombre as string, skipped: false, preset }
}

async function insertarIngredientes(recetaId: string, receta: RecetaImportable) {
  const { error } = await supabase
    .from('receta_ingredientes')
    .insert(receta.ingredientes.map(ing => ({
      receta_id: recetaId,
      alimento_id: null,
      nombre_libre: ing.nombre_libre,
      cantidad_gramos: ing.cantidad_gramos,
      orden: ing.orden,
    })))

  if (error) throw new Error(`Ingredientes fallaron para ${receta.nombre}: ${error.message}`)
}

async function main() {
  const startedAt = new Date().toISOString()
  const coachId = await getCoachId()
  const report = {
    started_at: startedAt,
    apply: APPLY,
    model: DEEPSEEK_MODEL,
    lotes: [] as unknown[],
    created: [] as unknown[],
    skipped: [] as unknown[],
  }

  for (const lote of LOTES) {
    const result = await generarRecetas(lote)
    report.lotes.push({
      id: result.collection.id,
      titulo: result.collection.titulo,
      generadas: result.recetas.map(r => r.nombre),
      tokens: result.tokens,
    })

    if (!APPLY) continue

    for (const receta of result.recetas) {
      const inserted = await insertarReceta(receta, coachId, result.collection.id)
      if (inserted.skipped) report.skipped.push(inserted)
      else report.created.push(inserted)
      console.log(`${inserted.skipped ? 'Saltada' : 'Creada'}: ${inserted.nombre}`)
    }
  }

  mkdirSync('salidas', { recursive: true })
  const file = `salidas/25-05-2026_lote-recetas-chef-healthy.json`
  writeFileSync(file, JSON.stringify(report, null, 2))
  console.log(`\nReporte: ${file}`)
  console.log(`Creadas: ${report.created.length} · Saltadas: ${report.skipped.length}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

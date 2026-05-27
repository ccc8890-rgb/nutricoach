/**
 * Repara recetas ya importadas desde los JSON de DeepSeek:
 * - restaura macros originales del JSON
 * - añade prompts de imagen y metadatos de IA
 * - normaliza aliases de ingredientes conflictivos
 * - vincula ingredientes genéricos conocidos para lista de compra
 *
 * Uso:
 *   npx tsx scripts/reparar-lote-deepseek-recetas.ts scripts/lote.json --coach-email coach@email.com
 *   npx tsx scripts/reparar-lote-deepseek-recetas.ts --coach-id uuid
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ENV_LOCAL = resolve(process.cwd(), '.env.local')
function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) throw new Error(`No se encuentra .env.local en ${ENV_LOCAL}`)
  for (const line of readFileSync(ENV_LOCAL, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] = value
  }
}
loadEnvLocal()

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

type Args = {
  files: string[]
  coachId?: string
  coachEmail?: string
}

type RawReceta = {
  nombre: string
  descripcion?: string
  categoria?: string
  kcal?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
  fibra?: number
  instrucciones?: string
  consejos?: string
  tags?: string[]
  objetivos?: string[]
  deportes?: string[]
  momentos?: string[]
  estilos?: string[]
  premium_chef?: boolean
  intolerancias?: string[]
  adherencia_score?: number
  digestibilidad?: string
  densidad_energetica?: string
  nivel_elaboracion?: number
  coste_estimado_nivel?: string
  imagen_prompt?: string
  ingredientes?: Array<{ nombre?: string; nombre_libre?: string; cantidad_gramos?: number }>
}

const FILES = [
  'scripts/deepseek-lote-perdida-grasa.json',
  'scripts/deepseek-lote-perdida-grasa-restantes.json',
  'scripts/deepseek-lote-rendimiento-funcional.json',
]

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const parsed: Args = { files: [] }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--coach-id') {
      parsed.coachId = args[++i]
      continue
    }
    if (arg === '--coach-email') {
      parsed.coachEmail = args[++i]
      continue
    }
    if (arg === '--file') {
      parsed.files.push(args[++i])
      continue
    }
    if (!arg.startsWith('--')) {
      parsed.files.push(arg)
      continue
    }
    throw new Error(`Argumento no reconocido: ${arg}`)
  }

  if (parsed.files.length === 0) parsed.files = FILES
  return parsed
}

async function resolverCoachId(args: Args) {
  if (args.coachId) return args.coachId

  if (args.coachEmail) {
    const { data, error } = await db
      .from('profiles')
      .select('id,email,role')
      .ilike('email', args.coachEmail.trim())
      .maybeSingle()

    if (error) throw new Error(`No se pudo resolver el coach por email: ${error.message}`)
    if (!data?.id) throw new Error(`No existe ningún profile con email ${args.coachEmail}`)
    if (data.role && data.role !== 'coach') {
      throw new Error(`El profile ${args.coachEmail} existe, pero role=${data.role}. No reparo recetas de un no-coach.`)
    }
    return data.id as string
  }

  return process.env.NUTRICOACH_COACH_ID || null
}

const FALLBACK_ALIMENTOS: Record<string, { calorias: number; proteinas: number; carbohidratos: number; grasas: number; fibra?: number; categoria?: string }> = {
  'Piña natural': { calorias: 50, proteinas: 0.5, carbohidratos: 13, grasas: 0.1, fibra: 1.4, categoria: 'Frutas' },
}

function formatearInstrucciones(instrucciones?: string | null) {
  if (!instrucciones) return instrucciones ?? null
  return instrucciones.replace(/\s+(\d+[\.)]\s+)/g, '\n$1').replace(/^\n+/, '').trim()
}

function normalizarNombre(nombre: string) {
  const n = nombre.toLowerCase()
  if (n === 'aove' || n.includes('aove en spray') || n.includes('aceite de oliva virgen extra')) return 'Aceite de oliva virgen extra'
  if (n.includes('pan integral de molde') || n.includes('pan integral en cubos')) return 'Pan integral'
  if (n.includes('pan rallado integral')) return 'Pan rallado'
  if (n.includes('piña natural')) return 'Piña natural'
  if (n.includes('pollo cocido desmenuzado') || n.includes('pollo troceado')) return 'Pechuga de pollo'
  if (n.includes('wrap de trigo integral')) return 'Tortilla de Trigo'
  if (n.includes('plátano congelado') || n.includes('platano congelado')) return 'Plátano'
  if (n.includes('setas variadas')) return 'Champiñón'
  if (n.includes('calabacín') || n.includes('calabacin')) return 'Calabacín crudo'
  if (n.includes('proteína whey')) return 'Proteína whey (polvo)'
  return nombre
}

function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cargarRaw(files: string[]) {
  const byName = new Map<string, RawReceta>()
  for (const file of files) {
    const raw = JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf-8'))
    const recetas: RawReceta[] = Array.isArray(raw.recetas) ? raw.recetas : raw
    for (const receta of recetas) {
      if (receta?.nombre) byName.set(receta.nombre.trim().toLowerCase(), receta)
    }
  }
  return byName
}

async function ensureAlimento(nombre: string) {
  const exact = await db
    .from('alimentos')
    .select('id,nombre,calorias')
    .ilike('nombre', nombre)
    .gt('calorias', 0)
    .order('calorias', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (exact.data?.id) return exact.data.id as string

  const fallback = FALLBACK_ALIMENTOS[nombre]
  if (fallback) {
    const inserted = await db
      .from('alimentos')
      .insert({
        nombre,
        calorias: fallback.calorias,
        proteinas: fallback.proteinas,
        carbohidratos: fallback.carbohidratos,
        grasas: fallback.grasas,
        fibra: fallback.fibra ?? 0,
        categoria: fallback.categoria ?? 'Otros',
        fuente: 'ia',
        es_comestible: true,
      })
      .select('id')
      .single()

    if (inserted.error) throw new Error(`No se pudo crear alimento ${nombre}: ${inserted.error.message}`)
    return inserted.data.id as string
  }

  const palabras = normalizarTexto(nombre)
    .split(' ')
    .filter(w => w.length > 2 && !['tipo', 'para', 'bajo', 'baja', 'alto', 'alta', 'light', 'natural', 'fresco', 'fresca', 'cocido', 'cocida'].includes(w))

  const vistos = new Set<string>()
  const candidatos: Array<{ id: string; nombre: string; score: number }> = []

  for (const palabra of palabras.slice(0, 4)) {
    const { data } = await db
      .from('alimentos')
      .select('id,nombre,calorias')
      .eq('es_comestible', true)
      .ilike('nombre', `${palabra}%`)
      .gt('calorias', 0)
      .limit(8)

    for (const item of data ?? []) {
      if (vistos.has(item.id)) continue
      vistos.add(item.id)
      const words = normalizarTexto(item.nombre).split(' ')
      const score = palabras.filter(w => words.some(aw => aw.startsWith(w) || w.startsWith(aw))).length
      if (score > 0) candidatos.push({ id: item.id, nombre: item.nombre, score })
    }
  }

  if (candidatos.length > 0) {
    candidatos.sort((a, b) => b.score - a.score || a.nombre.length - b.nombre.length)
    return candidatos[0].id
  }

  return null
}

async function main() {
  const args = parseArgs()
  const coachId = await resolverCoachId(args)
  const rawByName = cargarRaw(args.files)
  const nombres = [...rawByName.values()].map(receta => receta.nombre).filter(Boolean)

  let query = db
    .from('recetas')
    .select('id,nombre')
    .eq('fuente', 'ia_lote_deepseek')

  if (coachId) query = query.eq('coach_id', coachId)
  if (nombres.length > 0) query = query.in('nombre', nombres)

  const { data: recetas, error } = await query

  if (error) throw error

  console.log(JSON.stringify({
    archivos: args.files,
    coach_id: coachId ?? 'sin_scope_por_coach',
    recetas_json: rawByName.size,
    recetas_bd: recetas?.length ?? 0,
  }, null, 2))

  let reparadas = 0
  let ingredientesActualizados = 0
  let sinRaw = 0

  for (const receta of recetas ?? []) {
    const raw = rawByName.get(String(receta.nombre).trim().toLowerCase())
    if (!raw) {
      sinRaw++
      continue
    }

    const ingredientesRaw = raw.ingredientes ?? []
    const { data: ingredientesDb, error: ingError } = await db
      .from('receta_ingredientes')
      .select('id,orden,nombre_libre')
      .eq('receta_id', receta.id)
      .order('orden', { ascending: true })
    if (ingError) throw ingError

    for (const ingDb of ingredientesDb ?? []) {
      const ingRaw = ingredientesRaw[Number(ingDb.orden ?? 0)]
      if (!ingRaw) continue
      const nombreOriginal = String(ingRaw.nombre ?? ingRaw.nombre_libre ?? ingDb.nombre_libre ?? '').trim()
      const nombreNormalizado = normalizarNombre(nombreOriginal)
      const alimentoId = await ensureAlimento(nombreNormalizado)

      const { error: updateIngError } = await db
        .from('receta_ingredientes')
        .update({
          nombre_libre: nombreNormalizado,
          cantidad_gramos: Number(ingRaw.cantidad_gramos ?? 0) || null,
          alimento_id: alimentoId,
        })
        .eq('id', ingDb.id)
      if (updateIngError) throw updateIngError
      ingredientesActualizados++
    }

    const { error: updateRecetaError } = await db
      .from('recetas')
      .update({
        descripcion: raw.descripcion ?? null,
        categoria: raw.categoria ?? null,
        kcal: raw.kcal ?? null,
        proteinas: raw.proteinas ?? null,
        carbohidratos: raw.carbohidratos ?? null,
        grasas: raw.grasas ?? null,
        fibra: raw.fibra ?? null,
        instrucciones: formatearInstrucciones(raw.instrucciones),
        consejos: raw.consejos ?? null,
        tags: raw.tags ?? [],
        objetivos: raw.objetivos ?? [],
        deportes: raw.deportes ?? [],
        momentos: raw.momentos ?? [],
        estilos: raw.estilos ?? [],
        premium_chef: Boolean(raw.premium_chef),
        intolerancias: raw.intolerancias ?? [],
        adherencia_score: raw.adherencia_score ?? null,
        digestibilidad: raw.digestibilidad ?? null,
        densidad_energetica: raw.densidad_energetica ?? null,
        nivel_elaboracion: raw.nivel_elaboracion ?? null,
        coste_estimado_nivel: raw.coste_estimado_nivel ?? null,
        fuente_tipo: 'ia_generada',
        imagen_estado: 'sin_imagen',
        imagen_origen: 'missing',
        imagen_needs_review: true,
        imagen_prompt_base: raw.imagen_prompt ?? null,
        imagen_review_notes: 'Receta nueva generada por lote DeepSeek. Requiere imagen realista o revisión antes de aprobar.',
        taxonomia_version: 2,
        taxonomia_actualizada_at: new Date().toISOString(),
      })
      .eq('id', receta.id)
    if (updateRecetaError) throw updateRecetaError
    reparadas++
  }

  console.log(JSON.stringify({ reparadas, ingredientesActualizados, sinRaw }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

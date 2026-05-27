/**
 * Valida un JSON de recetas DeepSeek ANTES de importarlo.
 *
 * Uso:
 *   npx tsx scripts/validar-lote-deepseek.ts scripts/lote.json
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

type Receta = {
  nombre?: string
  categoria?: string
  porciones?: number
  kcal?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
  fibra?: number
  ingredientes?: Array<{ nombre?: string; nombre_libre?: string; cantidad_gramos?: number }>
  instrucciones?: string
  tags?: string[]
  objetivos?: string[]
  deportes?: string[]
  momentos?: string[]
  estilos?: string[]
  intolerancias?: string[]
  imagen_prompt?: string
  nota_adherencia?: string
}

const CATEGORIAS_VALIDAS = new Set(['Desayuno', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Postre', 'Snack'])
const OBJETIVOS_VALIDOS = new Set(['perdida_grasa', 'recomposicion', 'ganancia_muscular', 'mantenimiento', 'rendimiento', 'salud_general'])
const MOMENTOS_VALIDOS = new Set(['desayuno', 'media_manana', 'comida', 'merienda', 'cena', 'pre_entreno', 'post_entreno', 'refeed', 'tapering', 'carga_cho'])
const ESTILOS_VALIDOS = new Set(['chef_healthy', 'comfort_healthy', 'funcional', 'batch_cooking', 'tupper', 'rapida', 'mediterranea', 'gourmet_simple', 'alto_volumen'])

const ESPECIAS_RE = /\b(sal|pimienta|piment[oó]n|comino|curry|or[eé]gano|canela|vainilla|chile|guindilla|jengibre|cilantro|perejil|edulcorante|levadura)\b/i
const GLUTEN_RE = /\b(pan|trigo|tortilla de trigo|wrap|avena|copos de avena|harina|pasta|cusc[uú]s|bulgur|cebada|centeno|galleta|bizcocho|seitan)\b/i
const GLUTEN_OK_RE = /\b(sin gluten|certificad[ao] sin gluten|avena certificad[ao])\b/i
const LACTOSA_RE = /\b(leche|yogur|yogh?urt|queso|reques[oó]n|ricotta|mozzarella|burrata|k[eé]fir|nata|mantequilla|whey|suero)\b/i
const LACTOSA_OK_RE = /\b(sin lactosa|vegetal|soja|coco|almendra|avena)\b/i

function arr(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function rangoKcal(categoria?: string): [number, number] {
  if (categoria === 'Desayuno') return [250, 650]
  if (categoria === 'Postre' || categoria === 'Merienda' || categoria === 'Snack' || categoria === 'Almuerzo') return [120, 450]
  return [300, 750]
}

function validarReceta(receta: Receta, index: number) {
  const issues: string[] = []
  const ref = receta.nombre || `receta_${index + 1}`

  if (!receta.nombre || receta.nombre.length < 6) issues.push('nombre ausente o demasiado corto')
  if (!receta.categoria || !CATEGORIAS_VALIDAS.has(receta.categoria)) issues.push(`categoria inválida: ${receta.categoria ?? 'null'}`)

  const [minKcal, maxKcal] = rangoKcal(receta.categoria)
  if (!Number.isFinite(receta.kcal) || Number(receta.kcal) < minKcal || Number(receta.kcal) > maxKcal) {
    issues.push(`kcal fuera de rango para ${receta.categoria}: ${receta.kcal}`)
  }
  if (!Number.isFinite(receta.proteinas) || Number(receta.proteinas) < 10 || Number(receta.proteinas) > 65) {
    issues.push(`proteínas fuera de rango: ${receta.proteinas}`)
  }
  if (!Number.isFinite(receta.carbohidratos) || Number(receta.carbohidratos) < 0 || Number(receta.carbohidratos) > 140) {
    issues.push(`carbohidratos fuera de rango: ${receta.carbohidratos}`)
  }
  if (!Number.isFinite(receta.grasas) || Number(receta.grasas) < 0 || Number(receta.grasas) > 45) {
    issues.push(`grasas fuera de rango: ${receta.grasas}`)
  }

  const ingredientes = receta.ingredientes ?? []
  const intolerancias = arr(receta.intolerancias)
  if (ingredientes.length < 4) issues.push('menos de 4 ingredientes')
  if (ingredientes.length > 16) issues.push('demasiados ingredientes')

  for (const ing of ingredientes) {
    const nombre = ing.nombre ?? ing.nombre_libre ?? ''
    const gramos = Number(ing.cantidad_gramos)
    if (!nombre || nombre.length < 2) issues.push(`ingrediente sin nombre en ${ref}`)
    if (!Number.isFinite(gramos) || gramos <= 0) issues.push(`cantidad inválida: ${nombre} ${ing.cantidad_gramos}`)
    if (ESPECIAS_RE.test(nombre) && gramos > 30) issues.push(`especia/condimento con gramos altos: ${nombre} ${gramos}g`)
    if (/dientes?/i.test(nombre) && gramos > 20) issues.push(`dientes de ajo mal expresados: ${nombre} ${gramos}g`)
    if (/\bagua\b/i.test(nombre) && gramos > 0 && ingredientes.length > 4) issues.push(`agua como ingrediente de compra: ${nombre}`)
    if (intolerancias.includes('Sin Gluten') && GLUTEN_RE.test(nombre) && !GLUTEN_OK_RE.test(nombre)) {
      issues.push(`intolerancia incoherente: "${nombre}" no puede marcarse Sin Gluten salvo versión certificada`)
    }
    if (intolerancias.includes('Sin Lactosa') && LACTOSA_RE.test(nombre) && !LACTOSA_OK_RE.test(nombre)) {
      issues.push(`intolerancia incoherente: "${nombre}" no puede marcarse Sin Lactosa salvo versión sin lactosa/vegetal`)
    }
  }

  if (receta.categoria === 'Desayuno' && !arr(receta.momentos).includes('desayuno')) {
    issues.push('categoria Desayuno sin momento desayuno')
  }
  if (receta.categoria === 'Cena' && !arr(receta.momentos).includes('cena')) {
    issues.push('categoria Cena sin momento cena')
  }
  if (receta.categoria === 'Comida' && !arr(receta.momentos).includes('comida')) {
    issues.push('categoria Comida sin momento comida')
  }
  if ((receta.categoria === 'Postre' || receta.categoria === 'Merienda') && arr(receta.momentos).some(m => ['comida', 'cena'].includes(m))) {
    issues.push(`${receta.categoria} no debe etiquetarse como comida/cena principal`)
  }

  if (!receta.instrucciones || receta.instrucciones.length < 80) issues.push('instrucciones demasiado pobres')
  if (receta.instrucciones && !/\d+[\.)]/.test(receta.instrucciones)) issues.push('instrucciones sin pasos numerados')
  if (!receta.imagen_prompt || receta.imagen_prompt.length < 80) issues.push('imagen_prompt ausente o pobre')
  if (!receta.nota_adherencia || receta.nota_adherencia.length < 30) issues.push('nota_adherencia ausente o pobre')

  if (!arr(receta.objetivos).some(o => OBJETIVOS_VALIDOS.has(o))) issues.push('sin objetivo válido')
  if (!arr(receta.momentos).some(m => MOMENTOS_VALIDOS.has(m))) issues.push('sin momento válido')
  if (!arr(receta.estilos).some(e => ESTILOS_VALIDOS.has(e))) issues.push('sin estilo válido')
  if (arr(receta.tags).length < 3) issues.push('menos de 3 tags')

  return issues
}

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('Uso: npx tsx scripts/validar-lote-deepseek.ts scripts/lote.json')
  process.exit(1)
}

const filePath = fileArg.startsWith('/') ? fileArg : resolve(process.cwd(), fileArg)
const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
const recetas: Receta[] = Array.isArray(raw.recetas) ? raw.recetas : Array.isArray(raw) ? raw : []

const results = recetas.map((receta, index) => ({ nombre: receta.nombre ?? `receta_${index + 1}`, issues: validarReceta(receta, index) }))
const conIssues = results.filter(r => r.issues.length > 0)

console.log(JSON.stringify({
  archivo: fileArg,
  recetas: recetas.length,
  ok: recetas.length - conIssues.length,
  con_issues: conIssues.length,
  issues: conIssues,
}, null, 2))

if (conIssues.length > 0) process.exit(1)

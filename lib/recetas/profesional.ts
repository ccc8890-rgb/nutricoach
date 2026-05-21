export type NivelFit = 'fit' | 'equilibrada' | 'flexible' | 'indulgente' | 'no_fit'
export type TipoUso = 'diario' | 'ocasional' | 'deportivo' | 'clinico' | 'restaurante' | 'batch_cooking' | 'snack' | 'postre' | 'celebracion'
export type ContextoUso = 'pre_entreno' | 'post_entreno' | 'cena_ligera' | 'comida_familiar' | 'menu_horeca' | 'desayuno_rapido' | 'tupper' | 'general'
export type AptaCliente = 'general' | 'atleta' | 'perdida_grasa' | 'ganancia_muscular' | 'mantenimiento' | 'clinica' | 'requiere_revision'
export type EstadoSugerido = 'aprobada' | 'en_revision' | 'bloqueada'
export type BandaCalidad = 'excelente' | 'buena' | 'revisar' | 'bloqueada'

export interface IngredienteProfesionalInput {
  alimento_id?: string | null
  nombre_libre?: string | null
  cantidad_gramos?: number | null
  tiene_precio?: boolean
}

export interface RecetaProfesionalInput {
  nombre?: string | null
  descripcion?: string | null
  instrucciones?: string | null
  categoria?: string | null
  tipo_plato?: string | null
  dificultad?: string | null
  imagen_url?: string | null
  url_origen?: string | null
  kcal?: number | null
  proteinas?: number | null
  carbohidratos?: number | null
  grasas?: number | null
  fibra?: number | null
  porciones?: number | null
  intolerancias?: string[] | null
  tags?: string[] | null
  ingredientes?: IngredienteProfesionalInput[]
}

export interface ClasificacionProfesional {
  nivel_fit: NivelFit
  tipo_uso: TipoUso
  contexto_uso: ContextoUso
  apta_cliente: AptaCliente
  alcohol_culinario: boolean
}

export interface ScoreCalidadReceta {
  score: number
  banda: BandaCalidad
  bloqueantes: string[]
  avisos: string[]
  desglose: {
    ingredientes: number
    macros: number
    precio: number
    contenido: number
    media: number
    trazabilidad: number
  }
}

const ALCOHOL_RE = /\b(vino|vodka|amaretto|licor|brandy|brandi|ron|whisky|ginebra|tequila|anis|anís|cava|cerveza|jerez|moscatel|vermut|limoncello)\b/i
const POSTRE_RE = /\b(postre|tiramisu|tiramis[uú]|tarta|bizcocho|helado|brownie|galleta|dulce|flan|natilla|cheesecake)\b/i
const DEPORTIVO_RE = /\b(prote[ií]na|post[- ]?entreno|pre[- ]?entreno|fit|recovery|energy|energ[eé]tico)\b/i
const CLINICO_RE = /\b(diabetes|digestiv|fodmap|hipertensi[oó]n|renal|colesterol|gluc[eé]mico|sin gluten|sin lactosa)\b/i
const HORECA_RE = /\b(restaurante|chef|gastro|men[uú]|raci[oó]n|escandallo|lote|mise)\b/i

function textoReceta(receta: RecetaProfesionalInput): string {
  const ingredientes = (receta.ingredientes || []).map(i => i.nombre_libre || '').join(' ')
  const tags = (receta.tags || []).join(' ')
  return [
    receta.nombre,
    receta.descripcion,
    receta.categoria,
    receta.tipo_plato,
    receta.instrucciones,
    tags,
    ingredientes,
  ].filter(Boolean).join(' ')
}

function n(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

export function clasificarRecetaProfesional(receta: RecetaProfesionalInput): ClasificacionProfesional {
  const texto = textoReceta(receta)
  const kcal = n(receta.kcal)
  const proteinas = n(receta.proteinas)
  const grasas = n(receta.grasas)
  const fibra = n(receta.fibra)
  const tipoPlato = `${receta.tipo_plato || receta.categoria || ''}`.toLowerCase()
  const alcohol = ALCOHOL_RE.test(texto)
  const esPostre = POSTRE_RE.test(texto) || tipoPlato.includes('postre')
  const proteinaAlta = kcal > 0 ? proteinas * 4 / kcal >= 0.25 : proteinas >= 25
  const energiaDensa = kcal >= 600 || grasas >= 28

  let nivel_fit: NivelFit = 'equilibrada'
  if (esPostre && energiaDensa) nivel_fit = 'indulgente'
  else if (energiaDensa && proteinas < 20) nivel_fit = 'flexible'
  else if (kcal > 800) nivel_fit = 'no_fit'
  else if (proteinaAlta && fibra >= 5 && grasas <= 25) nivel_fit = 'fit'

  let tipo_uso: TipoUso = 'diario'
  if (HORECA_RE.test(texto)) tipo_uso = 'restaurante'
  else if (CLINICO_RE.test(texto)) tipo_uso = 'clinico'
  else if (DEPORTIVO_RE.test(texto)) tipo_uso = 'deportivo'
  if (esPostre) tipo_uso = energiaDensa || alcohol ? 'ocasional' : 'postre'

  let contexto_uso: ContextoUso = 'general'
  if (/pre[- ]?entreno/i.test(texto)) contexto_uso = 'pre_entreno'
  else if (/post[- ]?entreno|recovery/i.test(texto) || (proteinaAlta && kcal >= 350)) contexto_uso = 'post_entreno'
  else if (/tupper|batch/i.test(texto)) contexto_uso = 'tupper'
  else if (/cena/i.test(tipoPlato) && kcal <= 450) contexto_uso = 'cena_ligera'
  else if (HORECA_RE.test(texto)) contexto_uso = 'menu_horeca'
  else if (/desayuno/i.test(tipoPlato) && kcal <= 450) contexto_uso = 'desayuno_rapido'

  let apta_cliente: AptaCliente = 'general'
  if (alcohol || nivel_fit === 'indulgente' || nivel_fit === 'no_fit') apta_cliente = 'requiere_revision'
  else if (tipo_uso === 'clinico') apta_cliente = 'clinica'
  else if (proteinaAlta && kcal >= 350) apta_cliente = 'atleta'
  else if (proteinaAlta && kcal <= 500) apta_cliente = 'perdida_grasa'
  else if (kcal >= 650 && proteinas >= 25) apta_cliente = 'ganancia_muscular'

  return {
    nivel_fit,
    tipo_uso,
    contexto_uso,
    apta_cliente,
    alcohol_culinario: alcohol,
  }
}

export function calcularScoreCalidadReceta(receta: RecetaProfesionalInput): ScoreCalidadReceta {
  const ingredientes = receta.ingredientes || []
  const conAlimento = ingredientes.filter(i => !!i.alimento_id)
  const cantidadesValidas = ingredientes.filter(i => n(i.cantidad_gramos) > 0)
  const conPrecio = ingredientes.filter(i => i.tiene_precio !== false)
  const bloqueantes: string[] = []
  const avisos: string[] = []

  if (ingredientes.length === 0) bloqueantes.push('sin_ingredientes')
  if (ingredientes.some(i => !i.alimento_id)) bloqueantes.push('ingredientes_sin_alimento')
  if (ingredientes.some(i => n(i.cantidad_gramos) <= 0)) bloqueantes.push('cantidades_invalidas')
  if (!receta.porciones || receta.porciones <= 0) bloqueantes.push('porciones_invalidas')
  if (!receta.kcal || receta.kcal <= 0) bloqueantes.push('sin_macros')

  if (ingredientes.length > 0 && ingredientes.length < 3) avisos.push('pocos_ingredientes')
  if (!receta.descripcion) avisos.push('sin_descripcion')
  if (!receta.imagen_url) avisos.push('sin_imagen')
  if (!receta.url_origen) avisos.push('sin_origen')
  if (!receta.intolerancias || receta.intolerancias.length === 0) avisos.push('sin_intolerancias')

  const ingredientesScore = ingredientes.length === 0
    ? 0
    : clamp((conAlimento.length / ingredientes.length) * 55 + (cantidadesValidas.length / ingredientes.length) * 35 + Math.min(ingredientes.length, 5) * 2)

  const macrosScore = clamp(
    (n(receta.kcal) > 0 ? 35 : 0) +
    (n(receta.proteinas) > 0 ? 20 : 0) +
    (n(receta.carbohidratos) >= 0 ? 15 : 0) +
    (n(receta.grasas) >= 0 ? 15 : 0) +
    (n(receta.fibra) > 0 ? 15 : 0)
  )

  const precioScore = ingredientes.length === 0 ? 0 : clamp((conPrecio.length / ingredientes.length) * 100)

  const contenidoScore = clamp(
    (receta.descripcion ? 20 : 0) +
    ((receta.instrucciones || '').length >= 30 ? 35 : (receta.instrucciones ? 15 : 0)) +
    (receta.categoria || receta.tipo_plato ? 15 : 0) +
    (receta.dificultad ? 10 : 0) +
    (receta.porciones && receta.porciones > 0 ? 10 : 0) +
    (receta.intolerancias && receta.intolerancias.length > 0 ? 10 : 0)
  )

  const mediaScore = receta.imagen_url ? 100 : 0
  const trazabilidadScore = clamp((receta.url_origen ? 70 : 35) + ((receta.tags || []).length > 0 ? 30 : 0))

  const raw =
    ingredientesScore * 0.28 +
    macrosScore * 0.2 +
    precioScore * 0.18 +
    contenidoScore * 0.2 +
    mediaScore * 0.08 +
    trazabilidadScore * 0.06

  const score = Math.round(clamp(raw - bloqueantes.length * 10 - avisos.length * 2))
  const banda: BandaCalidad = bloqueantes.length > 0
    ? 'bloqueada'
    : score >= 90
      ? 'excelente'
      : score >= 75
        ? 'buena'
        : 'revisar'

  return {
    score,
    banda,
    bloqueantes,
    avisos,
    desglose: {
      ingredientes: Math.round(ingredientesScore),
      macros: Math.round(macrosScore),
      precio: Math.round(precioScore),
      contenido: Math.round(contenidoScore),
      media: Math.round(mediaScore),
      trazabilidad: Math.round(trazabilidadScore),
    },
  }
}

export function resumenCalidadReceta(score: ScoreCalidadReceta): { estado_sugerido: EstadoSugerido; aprobable: boolean } {
  if (score.bloqueantes.length > 0 || score.score < 55) return { estado_sugerido: 'bloqueada', aprobable: false }
  if (score.score < 75) return { estado_sugerido: 'en_revision', aprobable: false }
  return { estado_sugerido: 'aprobada', aprobable: true }
}

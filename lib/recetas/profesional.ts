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
  nombre_alimento?: string | null
  kcal_alimento?: number | null
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

// Token normalization for semantic matching
function normalizarToken(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function tokensSignificativos(s: string): string[] {
  const tokens = normalizarToken(s).split(' ').filter(t => t.length > 2)
  // Remove generic tokens that are too common
  const genericos = new Set(['con', 'sin', 'para', 'de', 'la', 'el', 'los', 'las', 'del', 'y', 'e', 'o', 'a', 'en', 'por', 'al', 'un', 'una', 'unas', 'unos', 'que', 'es', 'se', 'no', 'lo', 'su', 'sus', 'como', 'mas', 'pero', 'muy', 'todo', 'tipo', 'sabor', 'estilo', 'casero', 'natural', 'ecologico', 'artesanal', 'tradicional', 'integral', 'light', 'zero', 'diet', 'fit', 'healthy', 'bio', 'eco', 'sin', 'con', 'bajo', 'alto', 'enriquecido', 'fortificado', 'premium', 'selecto', 'extra', 'super', 'max', 'plus', 'classic', 'original', 'clasico', 'tradicion', 'receta', 'cocina', 'plato', 'comida', 'bebida', 'postre', 'snack', 'aperitivo', 'entrante', 'principal', 'guarnicion', 'acompanamiento', 'base', 'mezcla', 'preparado', 'listo', 'instantaneo', 'rapido', 'facil', 'casero', 'artesano', 'natural', 'ecologico', 'bio', 'organico', 'integral', 'light', 'diet', 'zero', 'sin', 'con', 'bajo', 'alto', 'enriquecido', 'fortificado', 'premium', 'selecto', 'extra', 'super', 'max', 'plus', 'classic', 'original', 'clasico', 'tradicion', 'receta', 'cocina', 'plato', 'comida', 'bebida', 'postre', 'snack', 'aperitivo', 'entrante', 'principal', 'guarnicion', 'acompanamiento', 'base', 'mezcla', 'preparado', 'listo', 'instantaneo', 'rapido', 'facil'])
  return tokens.filter(t => !genericos.has(t))
}

function tokensCompartidos(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter(t => setB.has(t)).length
}

function normalizarStr(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function validarMatchSemantico(ing: IngredienteProfesionalInput): string | null {
  if (!ing.nombre_libre || !ing.nombre_alimento) return null
  const libre = normalizarStr(ing.nombre_libre)
  const alimento = normalizarStr(ing.nombre_alimento)

  // 1) Frutos rojos vs Frutos secos
  const frutosRojos = /frutos rojos|fruta roja|berries|frambuesa|fresa|arandano|arándano|mora/.test(libre)
  const frutosSecos = /frutos secos|almendra|nuez|avellana|cacahuete|anacardo|pistacho/.test(alimento)
  if (frutosRojos && frutosSecos) return 'match_semantico_sospechoso'

  // 2) Nata / crema de leche vs patata / snack / aperitivo / chips / nata agria cebolla
  const nata = /nata|crema de leche/.test(libre)
  const patataSnack = /patata|snack|aperitivo|chips|nata agria.*cebolla/.test(alimento)
  if (nata && patataSnack) return 'match_semantico_sospechoso'

  // 3) Arroz glutinoso / sticky rice vs cereal / cereales / chocolate / copos de trigo
  const arrozGlutinoso = /arroz glutinoso|sticky rice/.test(libre)
  const cerealChocolate = /cereal|cereales|chocolate|copos de trigo/.test(alimento)
  if (arrozGlutinoso && cerealChocolate) return 'match_semantico_sospechoso'

  // 4) Hielo vs polo / helado / sorbete o kcal_alimento > 5
  const hielo = /^hielo$/.test(libre)
  if (hielo) {
    const poloHelado = /polo|helado|sorbete/.test(alimento)
    const kcalAlto = (ing.kcal_alimento ?? 0) > 5
    if (poloHelado || kcalAlto) return 'match_semantico_sospechoso'
  }

  // 5) Agua de coco vs solo 'agua'
  const aguaCoco = /agua de coco/.test(libre)
  const soloAgua = /^agua$/.test(alimento)
  if (aguaCoco && soloAgua) return 'match_semantico_sospechoso'

  // Fallback to token overlap check
  const tokensLibre = tokensSignificativos(ing.nombre_libre)
  const tokensAlimento = tokensSignificativos(ing.nombre_alimento)
  if (tokensLibre.length === 0 || tokensAlimento.length === 0) return null
  const compartidos = tokensCompartidos(tokensLibre, tokensAlimento)
  if (compartidos === 0) return 'match_semantico_sospechoso'
  return null
}

function validarCantidadesSospechosas(ing: IngredienteProfesionalInput): string | null {
  const gramos = ing.cantidad_gramos ?? 0
  if (gramos <= 0) return null
  const nombre = normalizarStr(ing.nombre_libre || '')
  // Sal > 10g
  if (/^sal\b/.test(nombre) && gramos > 10) return 'cantidades_sospechosas'
  // Ralladura/cascara/piel de citrico > 10g
  if (/(ralladura|cascara|piel)\s*(de\s*)?(limon|lima|naranja|pomelo|mandarina)/.test(nombre) && gramos > 10) return 'cantidades_sospechosas'
  // Especias secas > 20g
  if (/(canela|clavo|nuez moscada|jengibre|curcuma|pimenton|oregano|tomillo|romero|laurel|comino|cilantro|perejil|albahaca|menta|hierbabuena|eneldo|estragon|salvia|cebollino|ajo en polvo|cebolla en polvo|mostaza en polvo|curry|garam masala|chile|pimienta|cardamomo|anís|vainilla|azafran)/.test(nombre) && gramos > 20) return 'cantidades_sospechosas'
  // Aceite > 60g por receta (we'll check per ingredient, but total will be checked later)
  if (/(aceite|aceite de oliva|aceite de girasol|aceite de coco|aceite de aguacate|aceite de sesamo|aceite de cacahuete|aceite de soja|aceite de maiz|aceite de canola|aceite vegetal|aceite de palma|aceite de almendras|aceite de nuez|aceite de avellana|aceite de uva|aceite de linaza|aceite de onagra|aceite de borraja|aceite de pescado|aceite de higado de bacalao)/.test(nombre) && gramos > 60) return 'cantidades_sospechosas'
  // Condimentos tipo vinagre/zumo/limon > 120g salvo bebida (solo líquidos/condimentos, no frutas enteras)
  if (/(vinagre|zumo|jugo|limon|lima|naranja exprimida|salsa|aliño|aderezo)/.test(nombre) && gramos > 120) return 'cantidades_sospechosas'
  return null
}

function validarRecetaSemanticaIncoherente(receta: RecetaProfesionalInput): string | null {
  const nombre = (receta.nombre || '').toLowerCase()
  // Check for specific known dish names that have specific ingredients
  if (nombre.includes('mango sticky rice') || nombre.includes('mango pegajoso') || nombre.includes('arroz pegajoso mango')) {
    const ingredientes = receta.ingredientes || []
    const nombresIng = ingredientes.map(i => (i.nombre_libre || '').toLowerCase()).join(' ')
    // Expected ingredients: arroz glutinoso, leche de coco, azúcar, mango, sésamo
    // Suspicious if contains nata espesa or yemas de huevo
    if (/(nata espesa|yemas? de huevo|yema)/.test(nombresIng)) {
      return 'receta_semantica_incoherente'
    }
  }
  return null
}

// ── New quality‑gate helpers ──

function validarInstruccionesVacias(receta: RecetaProfesionalInput): string | null {
  const instr = receta.instrucciones
  if (!instr || instr.trim().length < 20) return 'instrucciones_vacias'
  return null
}

function validarMacrosFueraRango(receta: RecetaProfesionalInput): string | null {
  const kcal = n(receta.kcal)
  if (kcal <= 0) return null // already handled by sin_macros
  const tipo = (receta.tipo_plato || receta.categoria || '').toLowerCase()
  const maxPorTipo: Record<string, number> = {
    postre: 900,
    snack: 650,
    desayuno: 900,
    comida: 1100,
    cena: 1100,
  }
  // find first matching key
  const max = Object.entries(maxPorTipo).find(([key]) => tipo.includes(key))?.[1]
  if (max && kcal > max) return 'macros_fuera_rango'
  return null
}

function validarAlimentoCeroKcal(ing: IngredienteProfesionalInput): string | null {
  const kcal = ing.kcal_alimento ?? null
  if (kcal !== 0) return null
  const cantidad = n(ing.cantidad_gramos)
  if (cantidad <= 30) return null
  const nombre = normalizarStr(ing.nombre_libre || '')
  const alimento = normalizarStr(ing.nombre_alimento || '')
  // allowed zero‑kcal ingredients
  const permitidos = /^(agua|hielo|sal|vinagre|especia|edulcorante|gelatina 0|infusión|infusion)$/
  if (permitidos.test(nombre) || permitidos.test(alimento)) return null
  return 'alimento_cero_kcal'
}

function validarCantidadMuyPequena(ing: IngredienteProfesionalInput): string | null {
  const cantidad = n(ing.cantidad_gramos)
  if (cantidad >= 5) return null
  const nombre = normalizarStr(ing.nombre_libre || '')
  // only flag if it looks like a main ingredient (protein, cereal, legume, dairy, fruit, vegetable)
  const principal = /(pollo|ternera|cerdo|pescado|huevo|tofu|seitan|arroz|pasta|pan|avena|quinoa|legumbre|lenteja|garbanzo|alubia|leche|yogur|queso|requesón|fruta|verdura|hortaliza|espinaca|brócoli|zanahoria|tomate|cebolla|ajo|pimiento|calabacín|berenjena|patata|boniato|calabaza)/i
  if (!principal.test(nombre)) return null
  return 'cantidad_muy_pequena'
}

function validarPotenciadorExcesivo(ing: IngredienteProfesionalInput): string | null {
  const cantidad = n(ing.cantidad_gramos)
  if (cantidad <= 0) return null
  const nombre = normalizarStr(ing.nombre_libre || '')
  const alimento = normalizarStr(ing.nombre_alimento || '')
  const texto = nombre + ' ' + alimento
  // glutamato / msg
  if (/(glutamato|msg|umami)/.test(texto) && cantidad > 8) return 'potenciador_excesivo'
  // tabasco / sriracha
  if (/(tabasco|sriracha)/.test(texto) && cantidad > 20) return 'potenciador_excesivo'
  // salsa de soja
  if (/(salsa soja|soja|soya)/.test(texto) && cantidad > 50) return 'potenciador_excesivo'
  return null
}

function validarCantidadesPorDefecto(receta: RecetaProfesionalInput): string | null {
  const ingredientes = receta.ingredientes || []
  if (ingredientes.length < 3) return null
  const exactos100 = ingredientes.filter(i => n(i.cantidad_gramos) === 100).length
  if (exactos100 / ingredientes.length >= 0.8) return 'cantidades_por_defecto'
  return null
}

function validarCantidadAbsurda(ing: IngredienteProfesionalInput): string | null {
  const cantidad = n(ing.cantidad_gramos)
  if (cantidad > 2000) return 'cantidad_absurda'
  return null
}

function validarIngredientesDuplicados(receta: RecetaProfesionalInput): string | null {
  const ingredientes = receta.ingredientes || []
  const vistos = new Set<string>()
  for (const ing of ingredientes) {
    const nombre = normalizarStr(ing.nombre_libre || '')
    if (!nombre) continue
    // ignore sal/agua/hielo
    if (/^(sal|agua|hielo)$/.test(nombre)) continue
    if (vistos.has(nombre)) return 'ingredientes_duplicados'
    vistos.add(nombre)
  }
  return null
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
  let bloqueantes: string[] = []
  const avisos: string[] = []

  if (ingredientes.length === 0) bloqueantes.push('sin_ingredientes')
  if (ingredientes.some(i => !i.alimento_id)) bloqueantes.push('ingredientes_sin_alimento')
  if (ingredientes.some(i => n(i.cantidad_gramos) <= 0)) bloqueantes.push('cantidades_invalidas')
  if (!receta.porciones || receta.porciones <= 0) bloqueantes.push('porciones_invalidas')
  if (!receta.kcal || receta.kcal <= 0) bloqueantes.push('sin_macros')

  // New semantic and quantity checks
  for (const ing of ingredientes) {
    const sem = validarMatchSemantico(ing)
    if (sem) bloqueantes.push(sem)
    const cant = validarCantidadesSospechosas(ing)
    if (cant) bloqueantes.push(cant)
    const cero = validarAlimentoCeroKcal(ing)
    if (cero) bloqueantes.push(cero)
    const pequena = validarCantidadMuyPequena(ing)
    if (pequena) bloqueantes.push(pequena)
    const potenciador = validarPotenciadorExcesivo(ing)
    if (potenciador) bloqueantes.push(potenciador)
    const absurda = validarCantidadAbsurda(ing)
    if (absurda) bloqueantes.push(absurda)
  }
  const incoherente = validarRecetaSemanticaIncoherente(receta)
  if (incoherente) bloqueantes.push(incoherente)
  const instrVacias = validarInstruccionesVacias(receta)
  if (instrVacias) bloqueantes.push(instrVacias)
  const macrosFuera = validarMacrosFueraRango(receta)
  if (macrosFuera) bloqueantes.push(macrosFuera)
  const porDefecto = validarCantidadesPorDefecto(receta)
  if (porDefecto) bloqueantes.push(porDefecto)
  // Deduplicate
  bloqueantes = [...new Set(bloqueantes)]

  if (ingredientes.length > 0 && ingredientes.length < 3) avisos.push('pocos_ingredientes')
  if (!receta.descripcion) avisos.push('sin_descripcion')
  if (!receta.imagen_url) avisos.push('sin_imagen')
  if (!receta.url_origen) avisos.push('sin_origen')
  if (!receta.intolerancias || receta.intolerancias.length === 0) avisos.push('sin_intolerancias')
  const duplicados = validarIngredientesDuplicados(receta)
  if (duplicados) avisos.push(duplicados)
  // Deduplicate avisos
  avisos = [...new Set(avisos)]

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

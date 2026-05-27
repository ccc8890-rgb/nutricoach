import type { SupabaseClient } from '@supabase/supabase-js'

export type MomentoHabitual = 'desayuno' | 'media_manana' | 'comida' | 'merienda' | 'cena' | 'general'

export interface PlatoHabitualCliente {
  id?: string
  cliente_id?: string
  momento: MomentoHabitual
  texto_original: string
  plato_normalizado: string
  frecuencia: string
  importancia_adherencia: 'alta' | 'media' | 'baja'
  modificable: 'mantener_base' | 'ajustar_cantidades' | 'sustituible'
  estrategia: string
  ingredientes_clave: string[]
  preferencias_detectadas: string[]
  fuente: 'dia_tipico' | 'favoritos' | 'manual' | 'feedback'
}

type OnboardingHabitualInput = {
  dia_tipico?: string | null
  comidas_favoritas?: string | null
  alimentos_base?: string[] | null
}

const MOMENTOS: Array<{ key: MomentoHabitual; label: string; aliases: string[] }> = [
  { key: 'desayuno', label: 'desayuno', aliases: ['desayuno', 'por la mañana', 'mañana', 'cafe', 'café'] },
  { key: 'media_manana', label: 'media mañana', aliases: ['media mañana', 'almuerzo', 'a media mañana'] },
  { key: 'comida', label: 'comida', aliases: ['comida', 'como ', 'almuerzo', 'mediodia', 'mediodía'] },
  { key: 'merienda', label: 'merienda', aliases: ['merienda', 'tarde', 'snack'] },
  { key: 'cena', label: 'cena', aliases: ['cena', 'por la noche', 'noche'] },
]

const INGREDIENTES_CLAVE = [
  'cafe', 'café', 'leche', 'tostada', 'pan', 'tomate', 'jamon', 'jamón', 'pavo',
  'huevo', 'tortilla', 'yogur', 'skyr', 'avena', 'platano', 'plátano', 'arroz',
  'pasta', 'pollo', 'ternera', 'atun', 'atún', 'salmon', 'salmón', 'ensalada',
  'patata', 'boniato', 'legumbre', 'lentejas', 'garbanzos', 'pizza', 'burger',
  'hamburguesa', 'tacos', 'kebab', 'bocadillo', 'sandwich', 'sándwich',
]

function normalizar(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function limpiarTexto(texto: string) {
  return texto.replace(/\s+/g, ' ').trim()
}

function inferirMomento(texto: string): MomentoHabitual {
  const norm = normalizar(texto)
  const prioridadExplicita: MomentoHabitual[] = ['media_manana', 'merienda', 'cena', 'comida', 'desayuno']
  for (const key of prioridadExplicita) {
    const momento = MOMENTOS.find(m => m.key === key)
    if (momento && norm.includes(normalizar(momento.label))) return key
  }
  const match = MOMENTOS.find(m => m.aliases.some(alias => norm.includes(normalizar(alias))))
  return match?.key ?? 'general'
}

function extraerIngredientes(texto: string) {
  const norm = normalizar(texto)
  return Array.from(new Set(
    INGREDIENTES_CLAVE
      .filter(i => norm.includes(normalizar(i)))
      .map(i => normalizar(i))
      .map(i => i === 'cafe' ? 'café' : i)
  )).slice(0, 8)
}

function construirEstrategia(momento: MomentoHabitual, texto: string, ingredientes: string[]) {
  const norm = normalizar(texto)
  const estrategias: string[] = []

  if (ingredientes.includes('café') || norm.includes('cafe')) {
    estrategias.push('respetar café si no hay contraindicación')
  }
  if (norm.includes('tostada') || norm.includes('pan')) {
    estrategias.push('mantener base de pan/tostada y ajustar pan, aceite y proteína')
  }
  if (norm.includes('jamon') || norm.includes('pavo') || norm.includes('huevo')) {
    estrategias.push('conservar perfil salado alto en adherencia')
  }
  if (norm.includes('pizza') || norm.includes('burger') || norm.includes('tacos') || norm.includes('kebab')) {
    estrategias.push('crear versión chef healthy equivalente, no prohibir')
  }
  if (norm.includes('antes de entren')) {
    estrategias.push('priorizar digestibilidad y controlar grasa/fibra')
  }
  if (estrategias.length === 0) {
    estrategias.push('mantener identidad del plato y optimizar cantidades/proteína')
  }

  return estrategias.join('; ')
}

function platoDesdeTexto(texto: string, fuente: PlatoHabitualCliente['fuente']): PlatoHabitualCliente | null {
  const limpio = limpiarTexto(texto)
  if (limpio.length < 4) return null
  const momento = inferirMomento(limpio)
  const ingredientes = extraerIngredientes(limpio)
  const norm = normalizar(limpio)

  return {
    momento,
    texto_original: limpio.slice(0, 500),
    plato_normalizado: norm.slice(0, 160),
    frecuencia: fuente === 'dia_tipico' ? 'habitual' : 'preferido',
    importancia_adherencia: fuente === 'favoritos' ? 'alta' : momento === 'general' ? 'media' : 'alta',
    modificable: 'ajustar_cantidades',
    estrategia: construirEstrategia(momento, limpio, ingredientes),
    ingredientes_clave: ingredientes,
    preferencias_detectadas: ingredientes,
    fuente,
  }
}

function segmentarDiaTipico(texto: string) {
  const limpio = limpiarTexto(texto)
  if (!limpio) return []

  const cortes = limpio
    .replace(/\b(desayuno|media mañana|almuerzo|comida|merienda|cena)\b/gi, '||$1')
    .split('||')
    .map(s => limpiarTexto(s))
    .filter(Boolean)

  if (cortes.length <= 1) {
    return limpio
      .split(/[.;\n]/)
      .map(s => limpiarTexto(s))
      .filter(s => s.length > 5)
  }

  return cortes
}

export function extraerDietaHabitual(input: OnboardingHabitualInput): PlatoHabitualCliente[] {
  const platos: PlatoHabitualCliente[] = []

  for (const bloque of segmentarDiaTipico(input.dia_tipico ?? '')) {
    const plato = platoDesdeTexto(bloque, 'dia_tipico')
    if (plato) platos.push(plato)
  }

  const favoritos = (input.comidas_favoritas ?? '')
    .split(/[,;\n]/)
    .map(s => limpiarTexto(s))
    .filter(Boolean)

  for (const fav of favoritos) {
    const plato = platoDesdeTexto(fav, 'favoritos')
    if (plato) platos.push(plato)
  }

  const vistos = new Set<string>()
  return platos.filter(plato => {
    const key = `${plato.momento}:${plato.plato_normalizado}`
    if (vistos.has(key)) return false
    vistos.add(key)
    return true
  }).slice(0, 12)
}

export async function guardarDietaHabitualCliente(
  supabase: SupabaseClient,
  clienteId: string,
  input: OnboardingHabitualInput
) {
  const platos = extraerDietaHabitual(input)
  await supabase.from('dieta_habitual_cliente').delete().eq('cliente_id', clienteId).in('fuente', ['dia_tipico', 'favoritos'])
  if (platos.length === 0) return []

  const rows = platos.map(plato => ({
    cliente_id: clienteId,
    ...plato,
  }))

  const { data, error } = await supabase
    .from('dieta_habitual_cliente')
    .insert(rows)
    .select('*')

  if (error) throw error
  return (data ?? []) as PlatoHabitualCliente[]
}

export function formatearDietaHabitualParaPrompt(platos: PlatoHabitualCliente[]) {
  if (!platos.length) return 'No hay platos habituales declarados.'

  return platos.map(plato =>
    `- ${plato.momento}: "${plato.texto_original}" | estrategia: ${plato.estrategia} | ingredientes: ${plato.ingredientes_clave.join(', ') || 'sin detectar'}`
  ).join('\n')
}

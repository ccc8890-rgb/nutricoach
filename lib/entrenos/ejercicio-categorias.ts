// lib/entrenos/ejercicio-categorias.ts
// Organiza la biblioteca de ejercicios en pocas pestañas y grupos musculares para elegir con un clic (sin buscar).
// Infiere por el nombre cuando el dato de la biblioteca es pobre (hay ejercicios con grupo «general»).

export const PESTANAS_EJERCICIO = ['Calentamiento', 'Fuerza', 'Core', 'Cardio', 'Funcional'] as const
export type PestanaEjercicio = (typeof PESTANAS_EJERCICIO)[number]

export const MUSCULOS = ['Pecho', 'Espalda', 'Piernas y glúteos', 'Hombros', 'Brazos', 'Cuerpo completo'] as const
export type Musculo = (typeof MUSCULOS)[number]

/** Subgrupos de las disciplinas largas (Calentamiento y Cardio), por nombre. */
const SUBGRUPOS: Partial<Record<PestanaEjercicio, [string, RegExp][]>> = {
  Calentamiento: [
    ['Movilidad', /movilidad|mobility|apertura|yoga|pilates|tai chi|activacion/],
    ['Estiramientos', /estiramiento/],
    ['Foam y rodillo', /foam|rodillo/],
    ['Pedaleo', /pedaleo/],
    ['Trote y calma', /trote|calent|vuelta a la calma/],
  ],
  Cardio: [
    ['Suave y bajo impacto', /camin|paseo|senderismo|eliptica|escalera|stepper|estatica|natacion suave|aquagym|marcha nordica/],
    ['Carrera', /carrera|trote|correr|cinta|cuestas|intervalos|series run/],
    ['Bici', /pedaleo|bicicleta|ciclismo|sweet spot|over-under/],
    ['Remo y SkiErg', /skierg|remo|ergometro|assault/],
  ],
}

export function subgrupoDe(e: EjercicioBiblioteca, pestana: PestanaEjercicio): string | null {
  const reglas = SUBGRUPOS[pestana]
  if (!reglas) return null
  const n = norm(e.nombre)
  return reglas.find(([, re]) => re.test(n))?.[0] ?? 'Otros'
}

export interface EjercicioBiblioteca {
  id: string
  nombre: string
  tipo: string | null
  grupo_muscular: string | null
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const RE_CALENTAMIENTO = /pilates|tai chi|calent|vuelta a la calma|movilidad|estiramiento|activacion|pedaleo z1|foam|rodillo/
const RE_CORE = /plancha|abdominal|crunch|core|elevacion de piernas|russian twist|dead bug|bird dog|hollow|pallof|rueda|l-sit/
const RE_CARDIO = /skierg|pedaleo|bicicleta|ciclismo|ergometro|eliptica|carrera|trote|cinta|correr|assault|natacion|aquagym|marcha nordica|paseo|senderismo|escalera|stepper|intervalos|series run|over-under|sweet spot|cuestas/

export function pestanaDe(e: EjercicioBiblioteca): PestanaEjercicio {
  const n = norm(e.nombre)
  if (e.tipo === 'flexibilidad' || RE_CALENTAMIENTO.test(n)) return 'Calentamiento'
  if (e.grupo_muscular === 'Core' || RE_CORE.test(n)) return 'Core'
  if (e.tipo === 'cardio' || RE_CARDIO.test(n)) return 'Cardio'
  if (e.tipo === 'funcional') return 'Funcional'
  return 'Fuerza'
}

const GRUPO_A_MUSCULO: Record<string, Musculo> = {
  Pecho: 'Pecho',
  Espalda: 'Espalda',
  Piernas: 'Piernas y glúteos', 'Glúteos': 'Piernas y glúteos', Isquiotibiales: 'Piernas y glúteos', 'Cuádriceps': 'Piernas y glúteos', Gemelos: 'Piernas y glúteos', Aductores: 'Piernas y glúteos', Cadera: 'Piernas y glúteos',
  Hombros: 'Hombros', Trapecios: 'Hombros',
  'Bíceps': 'Brazos', 'Tríceps': 'Brazos', Antebrazos: 'Brazos',
  'Cuerpo completo': 'Cuerpo completo',
}

export function musculoDe(e: EjercicioBiblioteca): Musculo {
  const directo = e.grupo_muscular ? GRUPO_A_MUSCULO[e.grupo_muscular] : undefined
  if (directo) return directo
  const n = norm(e.nombre)
  if (/banca|press de pecho|press inclinado|aperturas|fondos|dips|flexion|pec deck|cruce de poleas/.test(n)) return 'Pecho'
  if (/remo|ring rows|dominada|pull-?up|muscle-?up|jalon|pull ?over|peso muerto convencional|face pull|superman/.test(n)) return 'Espalda'
  if (/sentadilla|squat|zancada|prensa|peso muerto|hip thrust|gluteo|step|extensiones? de cuadriceps|curl femoral|gemelo|puente|buenos dias|bulgara|abductor|aductor/.test(n)) return 'Piernas y glúteos'
  if (/press militar|elevacion lateral|elevaciones laterales|hombro|arnold|pajaro|encogimiento/.test(n)) return 'Hombros'
  if (/curl|triceps|biceps|martillo|frances|patada de triceps|antebrazo/.test(n)) return 'Brazos'
  return 'Cuerpo completo'
}

/** Quita duplicados por nombre (la biblioteca tiene alguno repetido), conservando el más usado. */
export function sinDuplicados(lista: EjercicioBiblioteca[], uso: Map<string, number>): EjercicioBiblioteca[] {
  const mejor = new Map<string, EjercicioBiblioteca>()
  for (const e of lista) {
    const k = norm(e.nombre).trim()
    const previo = mejor.get(k)
    if (!previo || (uso.get(e.id) ?? 0) > (uso.get(previo.id) ?? 0)) mejor.set(k, e)
  }
  return [...mejor.values()]
}

/** Valores por defecto al añadir: el cardio y la movilidad se miden en tiempo; el resto, series × repeticiones. */
export function porDefecto(e: EjercicioBiblioteca): { series: number; repeticiones: string } {
  const p = pestanaDe(e)
  if (/camin|paseo|senderismo|eliptica|natacion suave|aquagym|marcha nordica|estatica/.test(norm(e.nombre))) return { series: 1, repeticiones: '30 min' }
  if (p === 'Cardio' || (p === 'Calentamiento' && /trote|pedaleo|carrera|calent|vuelta/.test(norm(e.nombre)))) return { series: 1, repeticiones: '10 min' }
  if (p === 'Calentamiento') return { series: 2, repeticiones: '10' }
  if (/plancha/.test(norm(e.nombre))) return { series: 3, repeticiones: '30 s' }
  return { series: 3, repeticiones: '10' }
}

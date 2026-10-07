// Selección pura de recetas para una semana: sin repetir, franjas escasas primero y variedad de proteína.
// Las candidatas llegan ya filtradas y ordenadas por el motor (restricciones, verificadas, encaje de macros).
import { puntuarRecetaCompeticion, type ContextoRecetaCompeticion } from './receta-competicion'

export type CandidataSemana = {
  id: string; nombre: string; pre?: boolean; post?: boolean
  kcal?: number | null; proteinas?: number | null; carbohidratos?: number | null
  grasas?: number | null; fibra?: number | null; planningRoles?: string[] | null
}
// `momento`: la comida cae antes (pre) o después (post) del entrenamiento de ese día
export type Hueco = { dia: string; franja: string; momento?: 'pre' | 'post'; competicion?: ContextoRecetaCompeticion }
export type Asignacion = Hueco & { receta_id: string; repetida: boolean }

const PROTEINAS = ['pollo', 'pavo', 'ternera', 'cerdo', 'salmon', 'atun', 'merluza', 'bacalao', 'gamba', 'langostino', 'huevo', 'tofu', 'garbanzo', 'lenteja', 'skyr', 'yogur', 'queso']
// Cuántas candidatas de cabecera se miran para encontrar otra proteína sin sacrificar demasiado el encaje de macros
const VENTANA_VARIEDAD = 8
// Para no repetir proteína el mismo día se busca más lejos: es una petición explícita del coach
const VENTANA_MISMO_DIA = 30
// Solo reordena candidatas que ya están cerca por encaje base; evita rescatar un plato nutricionalmente absurdo del fondo.
const VENTANA_COMPETICION = 24
// Víspera / carga de hidratos: el encaje de macros contra un objetivo enorme deja recetas ideales (arroz, pasta) lejos de
// la cabecera, así que se mira todo el catálogo candidato y se penaliza poco la posición; la puntuación ya castiga grasa y fibra.
const VENTANA_VISPERA = 80
const PENALIZACION_POSICION = { vispera: 0.05, otras: 0.2 } as const

// Clave de las candidatas pedidas con el objetivo de un día de competición (p. ej. 'vispera:Comida')
export const claveCompeticion = (contexto: string, franja: string) => `${contexto}:${franja}`

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function claveProteina(nombre: string): string | null {
  const n = sinTildes(nombre)
  return PROTEINAS.find(p => n.includes(p)) ?? null
}

function preferirParaCompeticion(lista: CandidataSemana[], hueco: Hueco): CandidataSemana[] {
  if (!hueco.competicion || lista.length < 2) return lista
  const vispera = hueco.competicion === 'vispera'
  const cercanas = lista.slice(0, vispera ? VENTANA_VISPERA : VENTANA_COMPETICION)
    .map((receta, indice) => ({ receta, indice, score: puntuarRecetaCompeticion(receta, hueco.competicion!, hueco.franja) - indice * (vispera ? PENALIZACION_POSICION.vispera : PENALIZACION_POSICION.otras) }))
    .sort((a, b) => b.score - a.score || a.indice - b.indice)
    .map(x => x.receta)
  return [...cercanas, ...lista.slice(vispera ? VENTANA_VISPERA : VENTANA_COMPETICION)]
}

export function repartirSemanaSinRepetir(
  candidatasPorFranja: Record<string, CandidataSemana[]>,
  huecos: Hueco[],
  // Recetas ya usadas en otras semanas: se evitan igual que las de esta semana (solo se repiten si no queda otra)
  evitar?: Iterable<string>,
  // Candidatas de víspera/carrera/recuperación pedidas con el objetivo de ese día (hidratos altos); si faltan, se usan las de la franja
  candidatasCompeticion?: Record<string, CandidataSemana[]>,
): { asignaciones: Asignacion[]; sinCubrir: Hueco[] } {
  const usos = new Map<string, number>()
  for (const id of evitar ?? []) usos.set(id, 1)
  const ultimaClave = new Map<string, string | null>()
  const clavesFranja = new Map<string, Map<string, number>>()
  const clavesDia = new Map<string, Set<string>>()
  const resultado = new Map<Hueco, Asignacion>()
  const sinCubrir: Hueco[] = []

  const escasez = (franja: string) => candidatasPorFranja[franja]?.length ?? 0
  // Sort estable: dentro de una franja se mantiene el orden de días de la entrada
  const orden = [...huecos].sort((a, b) => escasez(a.franja) - escasez(b.franja))

  for (const hueco of orden) {
    const especifica = hueco.competicion ? candidatasCompeticion?.[claveCompeticion(hueco.competicion, hueco.franja)] : undefined
    const lista = especifica && especifica.length > 0 ? especifica : (candidatasPorFranja[hueco.franja] ?? [])
    if (lista.length === 0) { sinCubrir.push(hueco); continue }

    // Antes/después de entrenar se prefieren las recetas pensadas para ese momento (sin saltarse las reglas de variedad)
    const libresTodas = lista.filter(c => !usos.has(c.id))
    const adecuada = (c: CandidataSemana) => (hueco.momento === 'pre' ? c.pre : hueco.momento === 'post' ? c.post : false)
    const preferidasMomento = hueco.momento && libresTodas.some(adecuada) ? [...libresTodas.filter(adecuada), ...libresTodas.filter(c => !adecuada(c))] : libresTodas
    const libres = preferirParaCompeticion(preferidasMomento, hueco)
    let elegida: CandidataSemana
    let repetida = false
    if (libres.length > 0) {
      const previa = ultimaClave.get(hueco.franja) ?? null
      const conteo = clavesFranja.get(hueco.franja) ?? new Map<string, number>()
      const ventana = libres.slice(0, VENTANA_VARIEDAD)
      const delDia = clavesDia.get(hueco.dia) ?? new Set<string>()
      const sinRepetirEnElDia = (c: CandidataSemana) => { const k = claveProteina(c.nombre); return k == null || !delDia.has(k) }
      const distintaAlDiaAnterior = (c: CandidataSemana) => { const k = claveProteina(c.nombre); return k == null || (k !== previa && (conteo.get(k) ?? 0) < 2) }
      // Primero: otra proteína que las ya comidas ese día y que la del día anterior; si no hay, solo lo primero; si no, lo segundo
      const distinta = ventana.find(c => sinRepetirEnElDia(c) && distintaAlDiaAnterior(c))
        ?? libres.slice(0, VENTANA_MISMO_DIA).find(sinRepetirEnElDia)
        ?? ventana.find(distintaAlDiaAnterior)
      elegida = distinta ?? libres[0]
    } else {
      // Catálogo agotado para esta semana: la menos usada, y a igualdad la mejor ordenada
      elegida = lista.reduce((mejor, c) => ((usos.get(c.id) ?? 0) < (usos.get(mejor.id) ?? 0) ? c : mejor), lista[0])
      repetida = true
    }

    usos.set(elegida.id, (usos.get(elegida.id) ?? 0) + 1)
    const k = claveProteina(elegida.nombre)
    ultimaClave.set(hueco.franja, k)
    if (k) clavesDia.set(hueco.dia, (clavesDia.get(hueco.dia) ?? new Set<string>()).add(k))
    if (k) {
      const m = clavesFranja.get(hueco.franja) ?? new Map<string, number>()
      m.set(k, (m.get(k) ?? 0) + 1)
      clavesFranja.set(hueco.franja, m)
    }
    resultado.set(hueco, { ...hueco, receta_id: elegida.id, repetida })
  }

  // Salida en el orden original de los huecos
  return { asignaciones: huecos.flatMap(h => (resultado.has(h) ? [resultado.get(h)!] : [])), sinCubrir }
}

// lib/entrenos/macrociclo.ts
// Planificador determinista de la parte de carrera: calcula la ESTRUCTURA semana a semana (fases, volumen, descargas, tirada larga,
// calidad, reparto suave, fuerza y días) a partir de TODOS los parámetros del atleta. La IA ya no decide cuántas semanas, cuántos
// minutos ni cuántas sesiones: solo rellena el detalle de cada sesión dentro de esta estructura (y un validador lo comprueba).
//
// Principios (auditoría 10-10-2026):
//  - Ante datos que faltan, no se inventa: se usan supuestos conservadores, se declaran y se listan en `datosFaltantes`.
//  - Las condiciones de salud, las lesiones, la edad y la recuperación SIEMPRE recortan; nunca amplían.
//  - Las cifras son orientativas y se etiquetan con su origen (criterio de entrenador, referencia o estudio).
import { diasTaper, disciplinaConocida, perfilPrueba, type PerfilPrueba } from '@/lib/nutricion/competicion'
import { ritmosDesdeVdot, type Ritmos } from './ritmos'

export type Nivel = 'principiante' | 'intermedio' | 'avanzado'
export type FaseMacro = 'retorno' | 'base' | 'construccion' | 'especifica' | 'tapering' | 'carrera'
export type TipoSesionMacro = 'tirada' | 'rodaje' | 'tempo' | 'series' | 'ritmo_carrera' | 'strides'

export interface EntradaMacro {
  /** AAAA-MM-DD. */
  hoy: string
  nivel: string | null
  edad: number | null
  sexo: string | null
  /** Días a la semana que puede entrenar en total (carrera + fuerza). */
  diasDisponibles: number | null
  /** Días a la semana que correría; si no se indica se calcula. */
  diasCorrer: number | null
  vdot: number | null
  /** Media de minutos de carrera por semana en las últimas 4 semanas completas (reloj); null si no hay datos. */
  minutosSemanaActuales: number | null
  competicion: { fecha: string; disciplina: string; tiempoObjetivoMin: number | null; objetivo: string | null } | null
  lesiones: string[]
  restricciones: string | null
  recuperacion: string | null
  /** Texto libre de salud (anemia, hipertensión, diabetes…). */
  condicionesSalud: string | null
  /** Semanas seguidas sin correr de las que vuelve (0 si no hay parón reciente). */
  semanasParon: number
  /** Sesiones de fuerza o híbridas que ya tiene en su semana (no se suman más). */
  sesionesFuerzaFijas: number
}

export interface SesionMacro {
  tipo: TipoSesionMacro
  minutos: number
  /** 0 = lunes … 6 = domingo. */
  dia: number
}

export interface SemanaMacro {
  n: number
  /** Lunes de la semana (AAAA-MM-DD). */
  lunes: string
  fase: FaseMacro
  descarga: boolean
  minutos: number
  salidas: number
  /** Duración de la tirada larga. */
  tiradaMin: number
  /** % del tiempo objetivo en esfuerzo suave. */
  pctSuave: number
  fuerza: number
  sesiones: SesionMacro[]
  notas: string[]
}

export interface ResultadoMacro {
  semanasHastaCarrera: number | null
  semanas: SemanaMacro[]
  ritmos: Ritmos | null
  /** Parámetros que se han usado (ya normalizados) para que el coach vea con qué se ha calculado. */
  parametros: { nivel: Nivel; salidasSemana: number; volumenBase: number; volumenPico: number; crecimientoSemanal: number; descargaCada: number }
  avisos: string[]
  datosFaltantes: string[]
  supuestos: string[]
  /** Cada regla aplicada a este plan con su origen, para que el coach sepa qué es estudio, qué es libro de entrenador y qué es criterio. */
  fundamentos: Fundamento[]
}

export interface Fundamento {
  regla: string
  /** estudio = trabajo publicado verificable; libro = método de un entrenador (cifras de segunda mano); criterio = decisión de prudencia sin cifra publicada. */
  tipo: 'estudio' | 'libro' | 'criterio'
  fuente: string
}

// ───────────────────────── constantes (criterio de entrenador salvo indicación) ─────────────────────────

/** Volumen máximo orientativo por semana (minutos de carrera) según la prueba y el nivel. Referencias: Higdon (novel), Fitzgerald 80/20 niveles 1-2, Pfitzinger 18/55. */
const PICO_MIN: Record<PerfilPrueba | 'ultra' | 'general', Record<Nivel, number>> = {
  corta: { principiante: 150, intermedio: 240, avanzado: 330 },
  media: { principiante: 200, intermedio: 300, avanzado: 420 },
  larga: { principiante: 230, intermedio: 330, avanzado: 450 },
  muy_larga: { principiante: 270, intermedio: 390, avanzado: 540 },
  ultra: { principiante: 300, intermedio: 450, avanzado: 600 },
  general: { principiante: 150, intermedio: 240, avanzado: 330 },
}
/** Volumen semanal de partida cuando no hay datos del reloj. */
// Sin datos del reloj se parte de poco: a quien empieza o corre de forma irregular es peor pasarse que quedarse corto (las dos primeras semanas son de calibración).
const BASE_SUPUESTA: Record<Nivel, number> = { principiante: 45, intermedio: 120, avanzado: 200 }
/** Tope de la tirada larga por prueba (min). Daniels: 2 h 30 min; ultras: más tiempo de pie (criterio). */
const TIRADA_MAX: Record<PerfilPrueba | 'ultra' | 'general', number> = { corta: 75, media: 100, larga: 120, muy_larga: 150, ultra: 210, general: 90 }
/** Salidas por semana por defecto. */
const SALIDAS_DEFECTO: Record<Nivel, number> = { principiante: 3, intermedio: 4, avanzado: 5 }
const SALIDAS_MAX: Record<Nivel, number> = { principiante: 4, intermedio: 5, avanzado: 6 }
/** Minutos mínimos por semana con los que tiene sentido planificar. */
const MIN_VOLUMEN = 45
/** Duración mínima de cada tipo de sesión (min): si el volumen no da para tantas, se renuncia a sesiones, nunca se infla la semana. */
const MIN_TIRADA = 25
const MIN_RODAJE = 20
const MIN_CALIDAD = 35
/** Duración máxima razonable de un rodaje y de una sesión de calidad (con calentamiento y vuelta a la calma). */
const MAX_RODAJE = 100
const MAX_CALIDAD = 90
const minimoNecesario = (salidas: number, calidad: number) => MIN_TIRADA + calidad * MIN_CALIDAD + Math.max(0, salidas - 1 - calidad) * MIN_RODAJE
/** Horizonte máximo que se planifica de una vez. */
const MAX_SEMANAS = 20
/** Semanas del bloque cuando no hay competición. */
const SEMANAS_SIN_CARRERA = 8

const ultra = (d: string) => /ultra|trail_largo|ironman/.test(d)
const claseDePrueba = (c: EntradaMacro['competicion']): PerfilPrueba | 'ultra' | 'general' => {
  if (!c) return 'general'
  if (ultra(c.disciplina)) return 'ultra'
  return perfilPrueba(c.disciplina, c.tiempoObjetivoMin)
}

export function normalizarNivel(n: string | null | undefined): Nivel | null {
  const t = (n ?? '').toLowerCase()
  if (/princip|novel|inicia|beginner/.test(t)) return 'principiante'
  if (/avanz|advanced|elite|élite/.test(t)) return 'avanzado'
  if (/interm|medio|intermediate/.test(t)) return 'intermedio'
  return null
}

const sumarDias = (f: string, n: number) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const lunesDe = (f: string) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)
const redondea5 = (n: number) => Math.max(5, Math.round(n / 5) * 5)

/** Días de la semana (0 = lunes) para cada nº de salidas: calidad nunca seguida ni el día antes de la tirada; la tirada, en sábado. */
const PATRON_DIAS: Record<number, { tirada: number; calidad: number[]; faciles: number[] }> = {
  2: { tirada: 5, calidad: [2], faciles: [] },
  3: { tirada: 5, calidad: [1, 3], faciles: [] },
  4: { tirada: 5, calidad: [1, 3], faciles: [4] },
  5: { tirada: 5, calidad: [1, 3], faciles: [0, 4] },
  6: { tirada: 5, calidad: [1, 3], faciles: [0, 2, 4] },
}

/** Condiciones de salud que recortan el plan (texto libre → banderas). */
/** Busca un patrón ignorando las menciones negadas en su misma frase («sin diabetes», «no hipertensión», «descartada la anemia»). */
function afirma(texto: string, patron: RegExp): boolean {
  for (const m of texto.matchAll(new RegExp(patron.source, 'gu'))) {
    const inicio = Math.max(texto.lastIndexOf('.', m.index), texto.lastIndexOf(';', m.index), texto.lastIndexOf(',', m.index), texto.lastIndexOf('\n', m.index))
    const previo = texto.slice(inicio + 1, m.index)
    if (!/(^|[^\p{L}])(sin|no|ni|descart\p{L}*|ausencia de|niega|libre de)\s+([\p{L}\d]+\s+){0,3}$/u.test(previo)) return true
  }
  return false
}

export function banderasSalud(texto: string | null | undefined) {
  const t = (texto ?? '').toLowerCase()
  // Tensión por cifras: hipertensión desde 140/90; 130-139/85-89 es «normal-alta» (se vigila, no limita el plan).
  const ta = t.match(/(?:\bta|tensi[oó]n(?: arterial)?)\s*:?\s*(\d{2,3})\s*\/\s*(\d{2,3})/u)
  const sistolica = ta ? Number(ta[1]) : 0
  const diastolica = ta ? Number(ta[2]) : 0
  const hipertensionCifras = sistolica >= 140 || diastolica >= 90
  const elevadaCifras = !hipertensionCifras && (sistolica >= 130 || diastolica >= 85)
  return {
    anemia: afirma(t, /anemia|ferritina|ferrop[eé]nic|d[eé]ficit de hierro/),
    hipertension: hipertensionCifras || afirma(t, /hipertens|tensi[oó]n alta/),
    tensionElevada: elevadaCifras || afirma(t, /normal[-\s]alta/),
    diabetes: afirma(t, /diabet|prediabet/),
    cardiaco: afirma(t, /card[ií]ac|arritmia|coronari|infarto|soplo/),
  }
}

export function planificarMacrociclo(e: EntradaMacro): ResultadoMacro {
  const avisos: string[] = []
  const datosFaltantes: string[] = []
  const supuestos: string[] = []

  // ── Parámetros del atleta ────────────────────────────────────────────────
  let nivel = normalizarNivel(e.nivel)
  if (!nivel) { nivel = 'intermedio'; supuestos.push('Nivel no indicado: se asume intermedio.'); datosFaltantes.push('Nivel del atleta (principiante, intermedio o avanzado)') }
  const salud = banderasSalud(e.condicionesSalud)
  const veterano = e.edad !== null && e.edad >= 50
  const recuperacionBaja = /baja|lenta/.test((e.recuperacion ?? '').toLowerCase())
  const lesionado = e.lesiones.length > 0 || !!(e.restricciones && e.restricciones.trim())
  const prudente = nivel === 'principiante' || veterano || recuperacionBaja || lesionado || salud.anemia || salud.hipertension || salud.cardiaco

  const clase = claseDePrueba(e.competicion)
  const semanasMax = e.competicion ? Math.floor(diasEntre(e.hoy, e.competicion.fecha) / 7) : null
  if (e.competicion && semanasMax !== null && semanasMax < 0) {
    avisos.push('La competición ya pasó: no se planifica hacia ella.')
  }
  const comp = e.competicion && semanasMax !== null && semanasMax >= 0 ? e.competicion : null

  // La cuadrícula de semanas empieza el lunes de esta semana (de lunes a miércoles) o el lunes siguiente (de jueves en adelante): no se planifica una semana ya casi pasada.
  const lunesActual = lunesDe(e.hoy)
  const diaSemanaHoy = (new Date(`${e.hoy}T12:00:00Z`).getUTCDay() + 6) % 7
  const inicioPlan = diaSemanaHoy >= 3 ? sumarDias(lunesActual, 7) : lunesActual
  /** Semanas completas de preparación antes de la semana de la prueba (negativo si la prueba cae antes de que empiece la cuadrícula). */
  const semanasAntes = comp ? Math.floor(diasEntre(inicioPlan, comp.fecha) / 7) : null

  if (comp && !disciplinaConocida(comp.disciplina) && !ultra(comp.disciplina)) {
    avisos.push(`Tipo de prueba no reconocido («${comp.disciplina || 'sin tipo'}»): se trata como prueba corta, con menos volumen y sin reducción larga. Hay que indicar la distancia exacta (5K, 10K, media maratón, maratón, trail…).`)
    datosFaltantes.push('Tipo de prueba (5K, 10K, media maratón, maratón, trail, ultra, Hyrox…)')
  }

  // Crecimiento semanal: 10 % de referencia, más corto con cualquier factor de prudencia (criterio; Nielsen 2014: saltos > 30 % → más lesiones).
  const crecimientoBase = lesionado ? 0.05 : prudente ? 0.07 : nivel === 'avanzado' && !recuperacionBaja ? 0.1 : 0.08
  // Con anemia o déficit de hierro la carga casi no sube hasta que el médico confirme la recuperación (criterio de prudencia).
  const crecimiento = salud.anemia ? Math.min(crecimientoBase, 0.03) : crecimientoBase
  const descargaCada = nivel === 'principiante' || veterano || recuperacionBaja ? 3 : 4

  // Volumen de partida.
  let base: number
  // El dato real del reloj manda aunque sea bajo (con un mínimo para poder armar una semana); solo se supone si no hay dato.
  if (e.minutosSemanaActuales !== null) {
    base = Math.max(MIN_VOLUMEN, e.minutosSemanaActuales)
    if (e.minutosSemanaActuales < MIN_VOLUMEN) supuestos.push(`Corre solo ${e.minutosSemanaActuales} min por semana: por debajo del mínimo para armar un plan, se parte de ${MIN_VOLUMEN} min.`)
  }
  else {
    base = BASE_SUPUESTA[nivel]
    supuestos.push(`Sin volumen real en el reloj: se parte de ${base} min/semana (supuesto para nivel ${nivel}).`)
    datosFaltantes.push('Volumen real de carrera por semana (minutos o kilómetros de las últimas 4 semanas)')
  }
  const retorno = e.semanasParon > 0
  if (retorno) avisos.push(`Vuelve de ${e.semanasParon} semanas sin correr: las primeras semanas se reconstruyen con volumen reducido y solo carrera suave (Daniels).`)

  // Salidas por semana: las que pide, acotadas por nivel, días y lesiones; las sesiones de fuerza fijas ocupan días.
  const diasLibres = e.diasDisponibles !== null ? Math.max(2, e.diasDisponibles - Math.max(0, e.sesionesFuerzaFijas - 1)) : null
  let salidas = e.diasCorrer ?? SALIDAS_DEFECTO[nivel]
  salidas = Math.min(salidas, SALIDAS_MAX[nivel], diasLibres ?? 6)
  salidas = Math.max(2, Math.min(6, salidas))
  const salidasTope = Math.max(salidas, Math.min(SALIDAS_MAX[nivel], diasLibres ?? 6, 6))
  if (e.diasDisponibles === null) datosFaltantes.push('Días disponibles por semana')
  if (!e.vdot) datosFaltantes.push('VDOT o una marca reciente (5K/10K) para fijar los ritmos')

  const ritmos = e.vdot ? ritmosDesdeVdot(e.vdot) : null

  // ── Avisos de salud y de perfil ──────────────────────────────────────────
  if (salud.anemia) avisos.push('Anemia o déficit de hierro: se limita la calidad (sin series, solo tempo suave y progresivos), se sube el reparto suave y se pide que el médico confirme cuándo puede aumentar la intensidad. El volumen solo puede subir un 3 % por semana hasta normalizar la ferritina.')
  if (salud.hipertension) avisos.push('Tensión arterial alta: se evitan los esfuerzos máximos y las series intensas hasta que su médico lo valide.')
  if (salud.tensionElevada && !salud.hipertension) avisos.push('Tensión arterial en el límite alto (normal-alta): no limita el plan, pero conviene controlarla con su médico; ante mareo, dolor de cabeza fuerte o palpitaciones se para.')
  if (salud.diabetes) avisos.push('Diabetes o prediabetes: vigilar la glucosa en las sesiones largas y de calidad; ajustar con su médico.')
  if (salud.cardiaco) avisos.push('Condición cardiaca declarada: este plan no sustituye la valoración médica; no se programa calidad intensa sin autorización.')
  if (lesionado) avisos.push(`Lesiones o restricciones declaradas (${[...e.lesiones, ...(e.restricciones ? [e.restricciones] : [])].join('; ')}): crecimiento semanal reducido al 5 %, sin calidad intensa y sin pliometría hasta que se revisen.`)
  if (veterano) avisos.push('Mayor de 50 años: descarga cada 3 semanas, crecimiento de volumen más lento y más recuperación entre sesiones duras.')

  // ── Línea de tiempo ──────────────────────────────────────────────────────
  const llegaACarrera = comp !== null && semanasAntes! <= MAX_SEMANAS
  const semanasPlan = comp ? Math.max(1, Math.min(semanasAntes!, MAX_SEMANAS)) : SEMANAS_SIN_CARRERA
  if (comp && semanasAntes! > MAX_SEMANAS) avisos.push(`La competición está a ${semanasMax} semanas: se planifica el primer bloque de ${MAX_SEMANAS} y se recalcula más cerca de la fecha.`)
  if (comp && diasEntre(e.hoy, comp.fecha) < 14) avisos.push('Faltan menos de 2 semanas para la competición: solo cabe reducir la carga y llegar fresco; no se puede construir forma.')
  // La semana de la prueba cuenta como la última de la reducción: una reducción de 14 días son 1 semana previa + la de la carrera; la de 7-10 días es solo la de la carrera.
  const diaPrueba = comp ? (new Date(`${comp.fecha}T12:00:00Z`).getUTCDay() + 6) % 7 : null
  // Si la prueba cae de lunes a miércoles su semana casi no tiene días de preparación: la última semana previa hace de semana de la carrera.
  const pruebaAlInicio = diaPrueba !== null && diaPrueba <= 2
  const haySemanaCarrera = comp !== null && llegaACarrera && semanasAntes! >= 1 && !pruebaAlInicio
  const semanasTaper = llegaACarrera ? Math.min((diasTaper(comp!.disciplina) >= 14 ? 1 : 0) + (pruebaAlInicio ? 1 : 0), semanasPlan) : 0
  const previas = semanasPlan - semanasTaper

  // Reparto de fases sobre las semanas previas al tapering (base 40 %, construcción, específica 20 %; las pruebas cercanas se comprimen).
  const fases: FaseMacro[] = []
  if (!comp) {
    for (let i = 0; i < semanasPlan; i++) fases.push(i < semanasPlan / 2 ? 'base' : 'construccion')
  } else {
    const nBase = previas >= 8 ? Math.round(previas * 0.4) : previas >= 5 ? 2 : 0
    const nEspec = !llegaACarrera ? 0 : previas >= 5 ? Math.max(1, Math.round(previas * 0.2)) : previas >= 3 ? 1 : 0
    const nConstr = Math.max(0, previas - nBase - nEspec)
    for (let i = 0; i < nBase; i++) fases.push('base')
    for (let i = 0; i < nConstr; i++) fases.push('construccion')
    for (let i = 0; i < nEspec; i++) fases.push('especifica')
    for (let i = 0; i < semanasTaper; i++) fases.push('tapering')
  }
  const retornoN = retorno ? retornoSemanas(e.semanasParon) : 0
  for (let i = 0; i < Math.min(retornoN, fases.length); i++) if (fases[i] !== 'tapering') fases[i] = 'retorno'

  // ── Volumen: crecimiento gradual con descargas, tope por prueba y por tiempo disponible ──
  const picoTipico = PICO_MIN[clase][nivel]
  const semanasDeCarga = fases.filter(f => f !== 'tapering' && f !== 'carrera' && f !== 'retorno').length
  const alcanzable = base * Math.pow(1 + crecimiento, Math.max(0, semanasDeCarga - Math.floor(semanasDeCarga / descargaCada)))
  const pico = Math.max(base, Math.min(picoTipico, alcanzable))
  if (comp && alcanzable < picoTipico * 0.9 && semanasDeCarga > 0) {
    avisos.push(`En el tiempo disponible el volumen solo puede llegar a ~${Math.round(pico)} min/semana (lo habitual para esta prueba y nivel es ~${picoTipico}): el objetivo realista es llegar bien, no el volumen típico de un plan completo.`)
  }
  if (comp && nivel === 'principiante' && /maraton|trail_largo|ultra/.test(comp.disciplina) && semanasMax! < 16) {
    avisos.push('Primera preparación de una prueba muy larga con menos de 16 semanas: el riesgo de lesión es mayor; conviene valorar una distancia menor o un objetivo de simplemente terminar.')
  }

  const semanas: SemanaMacro[] = []
  /** Nivel de carga en el que está el atleta (el que se retoma tras una descarga). */
  let volumen = base
  const baseSupuesta = e.minutosSemanaActuales === null
  let cargaSeguidas = 0
  let previaFueDescarga = false

  for (let i = 0; i < fases.length; i++) {
    const fase = fases[i]
    const notas: string[] = []
    let descarga = false
    let v: number

    if (fase === 'tapering') {
      const reduccion = taperFactor(clase, i === fases.length - 1 && !haySemanaCarrera)
      v = Math.max(MIN_VOLUMEN, volumen * reduccion)
      notas.push(`Reducción previa a la carrera (~${Math.round((1 - reduccion) * 100)} % menos que en la semana de más carga) manteniendo la intensidad en 1-2 sesiones cortas y la frecuencia.`)
    } else if (fase === 'retorno') {
      v = volumenRetorno(base, i, retornoN, e.semanasParon)
      volumen = v
      notas.push('Vuelta tras el parón: solo carrera suave y sin series ni tempo (Daniels).')
      cargaSeguidas = 0
    } else {
      const siguienteEsTaper = fases[i + 1] === 'tapering'
      if (cargaSeguidas === descargaCada - 1 && i > 0 && !siguienteEsTaper && i < fases.length - 1) {
        descarga = true
        cargaSeguidas = 0
        v = volumen * 0.7
        notas.push('Semana de descarga (−30 %): se mantiene la frecuencia y una sesión de calidad corta.')
      } else {
        // Tras una descarga se retoma el nivel anterior sin subir; después se sube. Tras un parón se reincorpora más deprisa hasta el volumen habitual.
        const reincorporando = volumen < base * 0.99 && retorno
        const paso = reincorporando ? Math.max(crecimiento, 0.15) : crecimiento
        // Sin datos reales, las 2 primeras semanas no suben: primero se comprueba qué hace de verdad el atleta.
        const calibrando = baseSupuesta && i < 2
        if (calibrando) notas.push('Semana de calibración: no hay datos reales de carrera, se parte de una estimación y no se sube hasta ver qué hace de verdad.')
        const siguiente = previaFueDescarga || calibrando ? volumen : Math.min(pico, volumen * (1 + paso))
        v = reincorporando ? Math.min(siguiente, base) : siguiente
        volumen = v
        cargaSeguidas++
      }
    }
    previaFueDescarga = descarga
    const minutos = redondea5(v)
    const semana = construirSemana({ maxSalidas: salidasTope, n: i + 1, lunes: sumarDias(inicioPlan, i * 7), fase, descarga, minutos, salidas, clase, nivel, prudente, salud, lesionado, veterano, sesionesFuerzaFijas: e.sesionesFuerzaFijas, notas })
    // Si el volumen quedó limitado por las salidas, la carga de referencia pasa a ser la real (la descarga y el tapering se calculan sobre ella).
    if (!descarga && fase !== 'tapering' && semana.notas.some(n => n.startsWith('Volumen limitado'))) volumen = Math.min(volumen, semana.minutos)
    semanas.push(semana)
  }

  // Semana de la carrera, siempre al final del plan: rodajes muy suaves y cortos con unas pocas progresiones.
  if (haySemanaCarrera) {
    // La semana de la carrera lleva solo rodajes cortos con progresiones: una fracción del volumen máximo, sin contar la prueba (que ya es mucho esfuerzo).
    const fraccionCarrera: Record<string, number> = { corta: 0.45, media: 0.4, larga: 0.35, muy_larga: 0.3, ultra: 0.25, general: 0.45 }
    const vCarrera = Math.max(MIN_VOLUMEN, redondea5(volumen * (fraccionCarrera[clase] ?? 0.4)))
    semanas.push(construirSemana({ maxSalidas: salidasTope, n: semanas.length + 1, lunes: sumarDias(inicioPlan, semanas.length * 7), fase: 'carrera', descarga: false, minutos: vCarrera, salidas: Math.min(3, salidas, Math.max(2, diaPrueba! - 1)), diaCarrera: diaPrueba!, clase, nivel, prudente, salud, lesionado, veterano, sesionesFuerzaFijas: 0, notas: ['Semana de la carrera: rodajes muy suaves y cortos con unas pocas progresiones; descanso el día antes.'] }))
  }
  // Si la prueba cae esta misma semana (o antes de que empiece la cuadrícula) solo se prepara la competición.
  if (comp && semanasAntes! <= 0) {
    semanas.length = 0
    semanas.push(construirSemana({ maxSalidas: salidasTope, n: 1, lunes: semanasAntes! < 0 ? lunesActual : inicioPlan, fase: 'carrera', descarga: false, minutos: redondea5(base * 0.5), salidas: Math.min(3, salidas), clase, nivel, prudente, salud, lesionado, veterano, sesionesFuerzaFijas: 0, notas: ['Semana de la carrera: rodajes muy suaves y cortos con unas pocas progresiones; descanso el día antes.'] }))
  }

  if (semanas.some(x => x.notas.some(n => n.startsWith('Volumen limitado por el número de salidas')))) avisos.push('El volumen planificado no cabe en las salidas por semana disponibles con duraciones razonables: se limita el volumen en esas semanas. Para llegar al volumen típico de esta prueba hacen falta más salidas.')

  return {
    semanasHastaCarrera: comp ? semanasMax : null,
    semanas,
    ritmos,
    parametros: { nivel, salidasSemana: salidas, volumenBase: Math.round(base), volumenPico: Math.round(pico), crecimientoSemanal: crecimiento, descargaCada },
    avisos,
    datosFaltantes: [...new Set(datosFaltantes)],
    supuestos,
    fundamentos: fundamentosDe({ nivel, comp: comp ? { disciplina: comp.disciplina } : null, salud, lesionado, veterano, retorno, baseSupuesta, descargaCada, semanas, crecimiento, fuerza: semanas.some(x => x.fuerza > 0) }),
  }
}

/** Semanas de reconstrucción tras un parón (Daniels: hasta 4 semanas de parón, la mitad al 50 % y la mitad al 75 %). */
function retornoSemanas(semanasParon: number): number {
  return semanasParon <= 4 ? Math.max(1, Math.ceil(semanasParon / 2) * 2) : 5
}

function volumenRetorno(base: number, i: number, total: number, semanasParon: number): number {
  if (semanasParon > 4) return base * Math.min(1, 0.5 + 0.1 * i) // parón largo: 50 % y +10 puntos por semana
  return base * (i < total / 2 ? 0.5 : 0.75) // fórmula de Daniels: primera mitad al 50 %, segunda al 75 %
}

/** Factor sobre el pico en las semanas de reducción previa a la carrera (más suave en pruebas cortas). */
function taperFactor(clase: PerfilPrueba | 'ultra' | 'general', ultima: boolean): number {
  const t: Record<string, [number, number]> = { corta: [0.7, 0.65], media: [0.65, 0.55], larga: [0.55, 0.45], muy_larga: [0.55, 0.45], ultra: [0.6, 0.45], general: [0.7, 0.7] }
  return (t[clase] ?? t.general)[ultima ? 1 : 0]
}

interface ArgSemana {
  /** Máximo de salidas que admiten su nivel y sus días: si el volumen no cabe, se suben hasta aquí. */
  maxSalidas: number
  n: number; lunes: string; fase: FaseMacro; descarga: boolean; minutos: number; salidas: number
  clase: PerfilPrueba | 'ultra' | 'general'; nivel: Nivel; prudente: boolean
  /** Solo en la semana de la carrera: día de la prueba (0 = lunes … 6 = domingo). */
  diaCarrera?: number
  salud: ReturnType<typeof banderasSalud>; lesionado: boolean; veterano: boolean; sesionesFuerzaFijas: number; notas: string[]
}

function construirSemana(a: ArgSemana): SemanaMacro {
  const { fase, minutos, clase, nivel } = a
  let salidas = a.salidas

  // Calidad: cuántas sesiones y de qué tipo. Los factores de salud y las lesiones la recortan siempre.
  const sinIntensidad = a.lesionado || a.salud.cardiaco || a.salud.hipertension
  const sinSeries = sinIntensidad || a.salud.anemia
  let nCalidad = 0
  if (fase === 'base') nCalidad = nivel === 'avanzado' && salidas >= 4 ? 1 : 0
  else if (fase === 'construccion') nCalidad = nivel === 'principiante' ? 1 : salidas >= 4 ? 2 : 1
  else if (fase === 'especifica') nCalidad = nivel === 'principiante' ? 1 : salidas >= 4 ? 2 : 1
  else if (fase === 'tapering') nCalidad = salidas >= 3 ? 1 : 0
  if (a.descarga || a.salud.anemia) nCalidad = Math.min(nCalidad, 1)
  if (fase === 'retorno' || fase === 'carrera') nCalidad = 0
  if (sinIntensidad) nCalidad = Math.min(nCalidad, fase === 'base' ? 0 : 1)
  nCalidad = Math.min(nCalidad, Math.max(0, salidas - 2), PATRON_DIAS[Math.min(6, Math.max(2, salidas))].calidad.length)
  // Si el volumen no da para todas las sesiones con su duración mínima, primero se quita calidad y luego salidas.
  while (nCalidad > 0 && minimoNecesario(salidas, nCalidad) > minutos * 1.05) nCalidad--
  while (salidas > 2 && minimoNecesario(salidas, nCalidad) > minutos * 1.05) salidas--

  // Reparto objetivo de tiempo suave (criterio; pirámide en preparación, polarizado hacia la competición — Casado 2022).
  let pctSuave = fase === 'base' ? 90 : fase === 'construccion' ? 80 : fase === 'especifica' ? 78 : fase === 'tapering' ? 80 : 90
  if (a.prudente) pctSuave = Math.min(92, pctSuave + 5)
  if (a.descarga) pctSuave = Math.max(pctSuave, 88)
  if (nCalidad === 0) pctSuave = Math.max(pctSuave, 95)

  // Tirada larga: tope por prueba, por duración absoluta y por peso sobre el volumen semanal.
  const pesoTirada = salidas >= 5 ? 0.28 : salidas === 4 ? 0.34 : salidas === 3 ? 0.42 : 0.55
  let tirada = Math.min(TIRADA_MAX[clase], minutos * pesoTirada, 150 * (clase === 'ultra' ? 1.4 : 1))
  if (a.descarga) tirada = Math.min(tirada, minutos * 0.3)
  if (fase === 'tapering') tirada = Math.min(tirada, minutos * 0.35)
  tirada = Math.max(MIN_TIRADA, redondea5(tirada))

  // Calidad: minutos de trabajo = lo que queda fuera del reparto suave; tipos según fase.
  const minutosCalidad = nCalidad > 0 ? Math.max(8, Math.round(minutos * (100 - pctSuave) / 100)) : 0
  const tiposCalidad: TipoSesionMacro[] = []
  if (nCalidad > 0) {
    if (fase === 'base') tiposCalidad.push('strides')
    else if (fase === 'construccion') tiposCalidad.push('tempo', ...(sinSeries ? [] : ['series' as const]))
    else if (fase === 'especifica') tiposCalidad.push(clase === 'corta' || clase === 'media' ? 'series' : 'ritmo_carrera', 'tempo')
    else if (fase === 'tapering') tiposCalidad.push(sinSeries ? 'tempo' : 'series')
    if (sinSeries) for (let i = 0; i < tiposCalidad.length; i++) if (tiposCalidad[i] === 'series') tiposCalidad[i] = 'tempo'
    while (tiposCalidad.length < nCalidad) tiposCalidad.push(tiposCalidad[tiposCalidad.length - 1] ?? 'tempo')
    tiposCalidad.length = nCalidad
  }

  // Capacidad: si el volumen no cabe en las salidas con sus duraciones máximas, primero se suben las salidas y, si no basta, se limita el volumen.
  const capacidad = (sal: number, q: number) => TIRADA_MAX[clase] + q * MAX_CALIDAD + Math.max(0, sal - 1 - q) * MAX_RODAJE
  const capacidadReal = (sal: number) => {
    const q = Math.min(nCalidad, Math.max(0, sal - 2))
    const st = tiposCalidad.slice(0, q).filter(t => t === 'strides').length
    return capacidad(sal, q) - st * (MAX_CALIDAD - MAX_RODAJE)
  }
  while (capacidadReal(salidas) < minutos && salidas < a.maxSalidas && minimoNecesario(salidas + 1, nCalidad) <= minutos * 1.05) salidas++
  let minutosEfectivos = minutos
  if (capacidadReal(salidas) < minutos) { minutosEfectivos = Math.floor(capacidadReal(salidas) / 5) * 5; a.notas.push(`Volumen limitado por el número de salidas: con ${salidas} salidas no caben más de ~${minutosEfectivos} min por semana; para subir más hay que añadir salidas.`) }

  // Reparto de minutos: cada sesión tiene un valor ideal y un mínimo; se ajustan para que la semana sume el objetivo (nunca más).
  // La calidad incluye calentamiento y vuelta a la calma (≈ 2,2× el trabajo).
  const patron = PATRON_DIAS[Math.min(6, Math.max(2, salidas))]
  const faciles = Math.max(0, salidas - 1 - nCalidad)
  // Los «strides» (progresiones cortas dentro de un rodaje) se dimensionan como un rodaje, no como una sesión de calidad.
  const nStrides = tiposCalidad.filter(t => t === 'strides').length
  const nDuras = nCalidad - nStrides
  // El trabajo intenso de cada sesión se limita a ~12 % del volumen semanal y 40 min (Daniels: tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal); el resto de la sesión es calentamiento y vuelta a la calma.
  const trabajoPorSesion = nDuras > 0 ? Math.min(minutosCalidad / nDuras, 40, minutos * 0.12) : 0
  const idealCalidad = nDuras > 0 ? Math.max(MIN_CALIDAD, trabajoPorSesion * 2.2) : 0
  const nFaciles = faciles + nStrides
  const idealFacil = nFaciles > 0 ? Math.max(MIN_RODAJE, (minutosEfectivos - tirada - idealCalidad * nDuras) / nFaciles) : 0
  const partes: { tipo: TipoSesionMacro; ideal: number; min: number; dia: number }[] = [{ tipo: 'tirada', ideal: tirada, min: MIN_TIRADA, dia: patron.tirada }]
  tiposCalidad.forEach((t, i) => partes.push(t === 'strides' ? { tipo: t, ideal: idealFacil, min: MIN_RODAJE, dia: patron.calidad[i] } : { tipo: t, ideal: idealCalidad, min: MIN_CALIDAD, dia: patron.calidad[i] }))
  const diasFaciles = [...patron.faciles, ...patron.calidad.slice(nCalidad)].filter(d => !partes.some(x => x.dia === d))
  for (let i = 0; i < faciles; i++) partes.push({ tipo: 'rodaje', ideal: idealFacil, min: MIN_RODAJE, dia: diasFaciles[i] ?? diasFaciles[diasFaciles.length - 1] ?? 0 })
  const sumaIdeal = partes.reduce((a, x) => a + Math.max(x.ideal, x.min), 0)
  const sumaMin = partes.reduce((a, x) => a + x.min, 0)
  const f = sumaIdeal > minutosEfectivos ? Math.max(0, Math.min(1, (minutosEfectivos - sumaMin) / Math.max(1, sumaIdeal - sumaMin))) : 1
  const sesiones: SesionMacro[] = partes
    .map(x => ({ tipo: x.tipo, minutos: Math.min(x.tipo === 'tirada' ? TIRADA_MAX[clase] : x.tipo === 'rodaje' || x.tipo === 'strides' ? MAX_RODAJE : MAX_CALIDAD, Math.max(x.min, Math.floor((x.min + (Math.max(x.ideal, x.min) - x.min) * f) / 5) * 5)), dia: x.dia }))
    .sort((x, y) => x.dia - y.dia)

  // El redondeo a 5 y los topes pueden dejar la semana por debajo del objetivo: el sobrante se reparte de 5 en 5 entre las sesiones que admiten más.
  const tope = (t: TipoSesionMacro) => (t === 'tirada' ? TIRADA_MAX[clase] : t === 'rodaje' || t === 'strides' ? MAX_RODAJE : MAX_CALIDAD)
  let sobrante = minutosEfectivos - sesiones.reduce((s, x) => s + x.minutos, 0)
  while (sobrante >= 5) {
    const candidata = sesiones.filter(x => x.minutos + 5 <= tope(x.tipo)).sort((x, y) => x.minutos - y.minutos)[0]
    if (!candidata) break
    candidata.minutos += 5
    sobrante -= 5
  }
  // Semana de la carrera: sin sesión el día antes ni el de la prueba; la más larga, lo más lejos posible de la prueba.
  if (a.fase === 'carrera' && a.diaCarrera !== undefined && a.diaCarrera >= 3) {
    const libres = [0, 1, 2, 3, 4, 5, 6].filter(d => d < a.diaCarrera! - 1)
    const orden = [...sesiones].sort((x, y) => y.minutos - x.minutos)
    orden.forEach((x, i) => { x.dia = libres[Math.min(libres.length - 1, Math.round((i * (libres.length - 1)) / Math.max(1, orden.length - 1)))] })
    sesiones.sort((x, y) => x.dia - y.dia)
  }
  const total = sesiones.reduce((s, x) => s + x.minutos, 0)
  // Fuerza: 2 sesiones (Blagrove 2018; Balsalobre 2016), 1 en el tapering y ninguna en la semana de carrera; si ya tiene fijas, las suyas.
  let fuerza = a.sesionesFuerzaFijas > 0 ? a.sesionesFuerzaFijas : fase === 'carrera' ? 0 : fase === 'tapering' ? 1 : a.fase === 'retorno' ? 1 : 2
  if (a.sesionesFuerzaFijas === 0 && (a.lesionado)) fuerza = Math.min(fuerza, 1)

  return { n: a.n, lunes: a.lunes, fase, descarga: a.descarga, minutos: total, salidas: sesiones.length, tiradaMin: tirada, pctSuave, fuerza, sesiones, notas: a.notas }
}

/** Reglas realmente aplicadas a este plan y su origen. Los DOI de los estudios están verificados en la base de conocimiento (scripts/verificar-doi-reglas.ts). */
function fundamentosDe(a: { nivel: Nivel; comp: { disciplina: string } | null; salud: ReturnType<typeof banderasSalud>; lesionado: boolean; veterano: boolean; retorno: boolean; baseSupuesta: boolean; descargaCada: number; semanas: SemanaMacro[]; crecimiento: number; fuerza: boolean }): Fundamento[] {
  const f: Fundamento[] = []
  f.push({ regla: `Volumen: sube como máximo ~${Math.round(a.crecimiento * 100)} % por semana, nunca más de un 30 % de golpe`, tipo: 'estudio', fuente: 'Nielsen 2014 (saltos de más del 30 % se asocian a más lesiones). La cifra del 5-10 % es criterio de prudencia, no del estudio.' })
  f.push({ regla: `Semana de descarga cada ${a.descargaCada} semanas (−30 %)`, tipo: 'libro', fuente: 'Fitzgerald (80/20: cada 3 semanas), Pfitzinger, Daniels. La cifra exacta del −30 % es práctica habitual, no de un estudio.' })
  f.push({ regla: 'La mayor parte del tiempo en intensidad suave; la calidad se limita (≤ 2 sesiones, nunca seguidas ni el día antes de la tirada)', tipo: 'estudio', fuente: 'Casado et al. 2022 (revisión sistemática, corredores de élite: reparto piramidal/polarizado). Los límites por sesión son criterio de entrenador.' })
  f.push({ regla: 'Tirada larga con tope por prueba y por peso sobre la semana (≤ 150 min en general)', tipo: 'libro', fuente: 'Daniels (≤ 25 % del kilometraje y ≤ 2 h 30 min; cifras de segunda mano †). Con pocas salidas se tolera más peso.' })
  if (a.semanas.some(x => x.sesiones.some(y => ['tempo', 'series', 'ritmo_carrera'].includes(y.tipo)))) f.push({ regla: 'Trabajo intenso por sesión ≤ ~12 % del volumen semanal y ≤ 40 min', tipo: 'libro', fuente: 'Daniels (tempo ≤ 10 %, intervalos ≤ 8 % del kilometraje semanal; †).' })
  if (a.comp) f.push({ regla: 'Reducción previa a la prueba (2 semanas en pruebas largas, 1 en cortas; semana de la carrera lo más ligera)', tipo: 'estudio', fuente: 'Mujika & Padilla 2003 y Bosquet 2007 (reducir volumen ~40-60 % manteniendo la intensidad). Pfitzinger usa 3 semanas en maratón.' })
  if (a.retorno) f.push({ regla: 'Vuelta tras un parón: la mitad de los días perdidos al 50 % y la otra mitad al 75 %, solo carrera suave', tipo: 'libro', fuente: 'Daniels (†); con parones largos se reconstruye por completo.' })
  if (a.fuerza) f.push({ regla: 'Fuerza: 2 sesiones por semana (1 en la reducción, ninguna la semana de la carrera)', tipo: 'estudio', fuente: 'Blagrove 2018 y Balsalobre 2016 (fuerza y economía de carrera).' })
  if (a.salud.anemia) f.push({ regla: 'Anemia / déficit de hierro: volumen +3 %/semana y 1 sesión de calidad', tipo: 'criterio', fuente: 'Prudencia: no hay una cifra publicada para esto; el médico decide cuándo subir.' })
  if (a.salud.hipertension || a.salud.cardiaco) f.push({ regla: 'Sin series ni esfuerzos máximos hasta valoración médica', tipo: 'criterio', fuente: 'Prudencia ante condición cardiovascular declarada.' })
  if (a.lesionado) f.push({ regla: 'Lesión o restricción: crecimiento 5 %, sin series ni pliometría', tipo: 'criterio', fuente: 'Prudencia; lo revisa el fisioterapeuta o el coach.' })
  if (a.veterano) f.push({ regla: 'Mayor de 50: descarga cada 3 semanas y crecimiento más lento', tipo: 'criterio', fuente: 'Prudencia (más recuperación); sin cifra publicada.' })
  if (a.baseSupuesta) f.push({ regla: 'Sin datos del reloj: volumen de partida estimado por nivel y 2 semanas sin subir', tipo: 'criterio', fuente: 'Supuesto declarado: se corrige con lo que haga de verdad en las primeras semanas.' })
  return f
}

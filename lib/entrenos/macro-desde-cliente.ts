// lib/entrenos/macro-desde-cliente.ts
// Traduce los datos reales de un cliente (ficha, perfil de atleta, competición, onboarding y entrenos del reloj) a la entrada del
// planificador de macrociclo. Función pura: no inventa nada; lo que falta se devuelve en `faltan` para que el coach lo vea.
import { esCarrera } from '../rendimiento/carga'
import { disciplinaConocida } from '../nutricion/competicion'
import type { EntradaMacro } from './macrociclo'

export interface DatosClienteMacro {
  hoy: string
  cliente: { nivel: string | null; edad: number | null; sexo: string | null }
  perfil: {
    nivel: string | null
    vdot: number | string | null
    dias_disponibles: number | string | null
    patron_lesiones: unknown
    restricciones_temporales: string | null
    capacidad_recuperacion: string | null
  } | null
  /** Competición activa más próxima registrada en `competiciones`. */
  competicion: { fecha_competicion: string; disciplina: string | null; tiempo_objetivo_min: number | null; objetivo: string | null } | null
  /** Datos del onboarding (condiciones de salud y, si no hay competición registrada, la que declaró). */
  onboarding: { condiciones_salud: string | null; fecha_competicion: string | null; tipo_competicion: string | null } | null
  entrenos: { fecha: string; tipo: string | null; duracion_s: number | null }[]
  sesionesFuerzaFijas: number
}

export interface ResultadoEntradaMacro {
  entrada: EntradaMacro
  /** Datos que no estaban y que el coach debería completar para que el plan sea más preciso. */
  faltan: string[]
  /** Decisiones tomadas por falta de dato o por inconsistencia entre fuentes. */
  supuestos: string[]
}

const DIA = 86_400_000
const dias = (a: string, b: string) => Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / DIA)
const lunesDe = (f: string) => { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }

/**
 * Convierte el texto libre del onboarding («Maratón Valencia», «media maratón», «trail 50 km») en la disciplina que entiende el motor.
 * Devuelve '' si no se reconoce: es preferible avisar que adivinar la distancia.
 */
export function disciplinaCanonica(texto: string | null | undefined): string {
  const t = (texto ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!t) return ''
  if (/^[a-z0-9_]+$/.test(t) && disciplinaConocida(t)) return t
  if (/media\s*maraton|half|\bhm\b|\b21\s*k|21[.,]1/.test(t)) return 'running_hm'
  if (/maraton|marathon|\b42\s*k/.test(t)) return 'running_maraton'
  if (/\b10\s*k|10[.,]?000|\b10\s*km/.test(t)) return 'running_10k'
  if (/\b5\s*k\b|5[.,]?000|\b5\s*km/.test(t)) return 'running_5k'
  if (/hyrox/.test(t)) return 'hyrox'
  if (/crossfit/.test(t)) return 'crossfit'
  if (/ironman|70\.?3|medio\s*iron/.test(t)) return /70\.?3|medio/.test(t) ? 'triatlon_70_3' : 'ironman'
  if (/ultra/.test(t)) return 'ultra'
  if (/trail/.test(t)) {
    const km = t.match(/(\d{2,3})\s*(k|km)\b/)
    if (!km) return ''
    return Number(km[1]) >= 40 ? 'trail_largo' : 'trail_corto'
  }
  return ''
}

function lesionesDe(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(x => (typeof x === 'string' ? x : typeof x === 'object' && x ? String((x as Record<string, unknown>).zona ?? (x as Record<string, unknown>).descripcion ?? (x as Record<string, unknown>).nombre ?? '') : ''))
    .map(t => t.trim())
    .filter(Boolean)
}

/** Minutos de carrera de las últimas `n` semanas completas (lunes a domingo, sin la semana en curso). [0] = la más reciente. */
export function minutosPorSemana(entrenos: DatosClienteMacro['entrenos'], hoy: string, n = 12): number[] {
  const lunesActual = lunesDe(hoy)
  const semanas = Array<number>(n).fill(0)
  for (const e of entrenos) {
    if (!esCarrera(e.tipo) || !e.duracion_s || e.fecha >= lunesActual) continue
    const k = Math.floor((dias(e.fecha, lunesActual) - 1) / 7)
    if (k >= 0 && k < n) semanas[k] += e.duracion_s / 60
  }
  return semanas.map(x => Math.round(x))
}

export interface AnalisisVolumen {
  /** Volumen habitual del que parte el plan: media de las semanas con carrera, ignorando una semana suelta en cero (enfermedad, viaje). null si no hay datos. */
  minutos: number | null
  semanasConDatos: number
  /** Semanas de parón de las que vuelve (0 si no hay parón reciente). Incluye las primeras semanas ya de vuelta: el retorno aún no ha acabado. */
  semanasParon: number
  nota: string | null
}

/**
 * Interpreta el historial semanal (semanas[0] = la más reciente):
 *  - Una semana suelta en cero no cambia el volumen habitual (enfermedad o viaje).
 *  - Dos o más semanas seguidas en cero con carrera antes son un parón (Daniels: el retorno se reconstruye); el volumen de partida es el de antes del parón.
 *  - Si lleva 2 semanas o menos de vuelta tras un parón, el retorno sigue vigente.
 */
export function analizarVolumen(semanas: number[], diasDesdeUltimaCarrera: number | null): AnalisisVolumen {
  const hayAlgo = semanas.some(x => x > 0)
  if (!hayAlgo) return { minutos: null, semanasConDatos: 0, semanasParon: diasDesdeUltimaCarrera !== null && diasDesdeUltimaCarrera >= 14 ? Math.floor(diasDesdeUltimaCarrera / 7) : 0, nota: null }
  // Bloque de ≥ 2 semanas en cero reciente (dentro de las últimas 8) con carrera antes.
  let inicio = 0
  while (inicio < semanas.length && semanas[inicio] === 0) inicio++
  // `inicio` = semanas en cero al final (parón en curso). Si no hay, buscamos un bloque ya terminado.
  const bloqueEnCurso = inicio >= 2
  let bloque = 0, vueltaHace = 0
  if (!bloqueEnCurso) {
    for (let k = 0; k < Math.min(8, semanas.length); k++) {
      if (semanas[k] === 0) {
        let l = 0
        while (k + l < semanas.length && semanas[k + l] === 0) l++
        if (l >= 2 && semanas.slice(k + l).some(x => x > 0)) { bloque = l; vueltaHace = k; break }
        k += l - 1
      }
    }
  }
  const previas = (desde: number) => semanas.slice(desde, desde + 4).filter(x => x > 0)
  const media = (v: number[]) => (v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null)
  if (bloqueEnCurso) {
    const previo = media(previas(inicio))
    const semanasParon = Math.max(inicio, diasDesdeUltimaCarrera !== null ? Math.floor(diasDesdeUltimaCarrera / 7) : 0)
    return { minutos: previo, semanasConDatos: previas(inicio).length, semanasParon, nota: `Lleva ${semanasParon} semanas sin correr${previo ? `; antes corría ~${previo} min/semana` : ''}.` }
  }
  if (bloque > 0 && vueltaHace <= 2) {
    const previo = media(previas(vueltaHace + bloque))
    return { minutos: previo, semanasConDatos: previas(vueltaHace + bloque).length, semanasParon: bloque, nota: `Volvió hace ${vueltaHace} semanas tras ${bloque} sin correr${previo ? ` (antes ~${previo} min/semana)` : ''}: el retorno sigue vigente.` }
  }
  const ult4 = semanas.slice(0, 4)
  const con = ult4.filter(x => x > 0)
  const ceros = ult4.length - con.length
  // Una semana suelta en cero no cuenta; con más ceros se promedian todas (el atleta corre de forma irregular).
  const m = ceros <= 1 ? media(con) : media(ult4)
  return { minutos: m, semanasConDatos: con.length, semanasParon: 0, nota: ceros === 1 ? 'Una semana sin correr en las últimas 4 (enfermedad o viaje): no se rebaja el volumen habitual por ella.' : null }
}

export function construirEntradaMacro(d: DatosClienteMacro): ResultadoEntradaMacro {
  const faltan: string[] = []
  const supuestos: string[] = []

  // Nivel: el del perfil de atleta manda; si no hay, el de la ficha del cliente.
  let nivel = d.perfil?.nivel ?? null
  if (!nivel && d.cliente.nivel) { nivel = d.cliente.nivel; supuestos.push(`Nivel «${nivel}» tomado de la ficha del cliente (el perfil de atleta no lo tiene).`) }
  if (!nivel) faltan.push('Nivel del atleta (principiante / intermedio / avanzado)')
  if (!d.perfil) faltan.push('Perfil de atleta (días disponibles, lesiones, recuperación, VDOT)')
  if (d.cliente.edad == null) faltan.push('Edad')

  const vdot = d.perfil?.vdot != null && d.perfil.vdot !== '' ? Number(d.perfil.vdot) : null
  if (!vdot) faltan.push('VDOT o tiempo reciente de 5K/10K (los ritmos del plan salen de aquí)')

  const diasDisponibles = d.perfil?.dias_disponibles != null && d.perfil.dias_disponibles !== '' ? Number(d.perfil.dias_disponibles) : null
  if (diasDisponibles == null && d.perfil) faltan.push('Días disponibles por semana')

  // Competición: la registrada manda; si solo la declaró en el onboarding, se usa y se avisa de que hay que registrarla.
  let competicion: EntradaMacro['competicion'] = null
  if (d.competicion) {
    competicion = { fecha: d.competicion.fecha_competicion, disciplina: disciplinaCanonica(d.competicion.disciplina) || (d.competicion.disciplina ?? ''), tiempoObjetivoMin: d.competicion.tiempo_objetivo_min, objetivo: d.competicion.objetivo }
  } else if (d.onboarding?.fecha_competicion && d.onboarding.fecha_competicion >= d.hoy) {
    const canonica = disciplinaCanonica(d.onboarding.tipo_competicion)
    competicion = { fecha: d.onboarding.fecha_competicion, disciplina: canonica || (d.onboarding.tipo_competicion ?? ''), tiempoObjetivoMin: null, objetivo: null }
    if (!canonica) faltan.push(`Tipo de prueba exacto: «${d.onboarding.tipo_competicion ?? 'sin tipo'}» no se reconoce (5K, 10K, media maratón, maratón, trail con km…)`)
    supuestos.push(`La prueba (${d.onboarding.tipo_competicion ?? 'sin tipo'}, ${d.onboarding.fecha_competicion}) viene del onboarding: no está registrada en Competiciones.`)
  } else {
    faltan.push('Competición objetivo (fecha y distancia): sin ella el plan es de mejora general de 8 semanas')
  }

  const ultima = d.entrenos.filter(e => esCarrera(e.tipo)).map(e => e.fecha).sort().pop()
  const analisis = analizarVolumen(minutosPorSemana(d.entrenos, d.hoy), ultima ? dias(ultima, d.hoy) : null)
  const { minutos, semanasConDatos, semanasParon } = analisis
  if (minutos === null) faltan.push('Datos de carrera del reloj (últimas semanas): el volumen de partida es una suposición por nivel')
  else if (semanasConDatos < 3 && semanasParon === 0) supuestos.push(`Volumen actual calculado con solo ${semanasConDatos} de las 4 últimas semanas con carrera.`)
  if (analisis.nota) supuestos.push(analisis.nota)

  return {
    entrada: {
      hoy: d.hoy,
      nivel,
      edad: d.cliente.edad,
      sexo: d.cliente.sexo,
      diasDisponibles,
      diasCorrer: null,
      vdot,
      minutosSemanaActuales: minutos,
      competicion,
      lesiones: lesionesDe(d.perfil?.patron_lesiones),
      restricciones: d.perfil?.restricciones_temporales ?? null,
      recuperacion: d.perfil?.capacidad_recuperacion ?? null,
      condicionesSalud: d.onboarding?.condiciones_salud ?? null,
      semanasParon,
      sesionesFuerzaFijas: d.sesionesFuerzaFijas,
    },
    faltan,
    supuestos,
  }
}

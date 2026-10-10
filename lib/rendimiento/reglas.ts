// lib/rendimiento/reglas.ts
// Motor de reglas de entrenamiento de carrera: decide QUÉ proponer cuando los datos lo justifican.
// Es determinista (misma entrada, misma salida), con condiciones y cifras a la vista y los estudios que lo respaldan por DOI.
// La IA no decide si una regla se cumple: solo puede explicar, priorizar y matizar lo que el motor ya ha dicho.
import { formatearRitmo } from '@/lib/entrenos/ritmos'
import type { ClaveMetrica, Direccion } from './seguimiento'
import type { EstadoAtleta } from './estado'

export type Riesgo = 'bajo' | 'medio' | 'alto'

/** Estudios de la base de conocimiento (por DOI) en los que se apoyan las reglas. */
export const DOI = {
  SEILER_2010: '10.1123/ijspp.5.3.276',
  STOGGL_2014: '10.3389/fphys.2014.00033',
  JAMNICK_2020: '10.1007/s40279-020-01322-8',
  FOSTER_1998: '10.1097/00005768-199807000-00023',
  MAUNDER_2021: '10.1007/s40279-021-01459-0',
  BLAGROVE_2018: '10.1007/s40279-017-0835-7',
  BALSALOBRE_2016: '10.1519/JSC.0000000000001316',
  RONNESTAD_2014: '10.1111/sms.12104',
  BOSQUET_2007: '10.1249/mss.0b013e31806010e0',
  MUJIKA_2003: '10.1249/01.MSS.0000074448.73931.11',
  NIELSEN_2014: '10.2519/jospt.2014.5164',
  FOKKEMA_2021: '10.1111/sms.13725',
} as const

export interface PropuestaRegla {
  regla: string
  sesion: string
  cambio: string
  razon: string
  riesgo: Riesgo
  metrica_objetivo?: ClaveMetrica
  direccion?: Direccion
  dois: string[]
  /** 0-1: cuánta carga de datos hay detrás (tiempo con pulso, número de carreras…). */
  datos: number
  /** 0-1: si la situación se repite en las dos últimas ventanas (no es un día malo). */
  persistencia: number
  /** 1 = urgente, 10 = rutinaria. */
  prioridad: number
}

export interface ResultadoReglas {
  propuestas: PropuestaRegla[]
  /** Avisos que explican por qué no se propone algo (datos insuficientes, etc.). */
  notas: string[]
}

/** Mínimo de carreras con pulso en 6 semanas para que el motor proponga cambios. */
export const MIN_CARRERAS = 6

const r0 = (n: number) => Math.round(n)
const acota = (n: number) => Math.min(1, Math.max(0, n))
const tiene = (e: EstadoAtleta, codigo: string) => e.alertas.includes(codigo)

export function evaluarReglas(e: EstadoAtleta): ResultadoReglas {
  const propuestas: PropuestaRegla[] = []
  const notas: string[] = []

  if (e.carreras6sem < MIN_CARRERAS) {
    notas.push(`Solo ${e.carreras6sem} carreras con pulso en las últimas 6 semanas: el motor necesita al menos ${MIN_CARRERAS} para proponer cambios con fiabilidad.`)
  }
  const hayDatos = e.carreras6sem >= MIN_CARRERAS
  const sobrecarga = tiene(e, 'rampa_alta') || tiene(e, 'fatiga_alta') || tiene(e, 'llega_cansado')
  const c = e.carga

  // R2 — Sobrecarga: manda sobre todo lo demás.
  if (sobrecarga && c) {
    propuestas.push({
      regla: 'sobrecarga',
      sesion: 'general',
      cambio: 'Semana de descarga: bajar el volumen un 30-40 % y dejar solo una sesión de calidad corta. No subir la carga hasta que la frescura vuelva por encima de -20.',
      razon: `Forma ${c.ctl}, fatiga ${c.atl}, frescura ${c.tsb}, subida de forma de ${c.rampa7} puntos en 7 días (por encima de ~8 o con frescura bajo -30 aumenta el riesgo de sobrecarga).`,
      riesgo: 'bajo',
      metrica_objetivo: 'carga_semana',
      direccion: 'baja',
      dois: [DOI.FOSTER_1998],
      datos: 1,
      persistencia: c.tsb < -30 ? 1 : 0.7,
      prioridad: 1,
    })
  }

  // R6 — Tapering ante una competición cercana.
  if (e.diasCompeticion !== null && e.diasCompeticion >= 0 && e.diasCompeticion <= 14) {
    const fuerte = e.diasCompeticion <= 7
    propuestas.push({
      regla: 'tapering',
      sesion: 'general',
      cambio: `Faltan ${e.diasCompeticion} días: reducir el volumen semanal ${fuerte ? 'un 50-60 %' : 'un 40 %'} respecto a la semana de más carga, manteniendo la intensidad en 1-2 sesiones de calidad cortas y la frecuencia de entrenos.`,
      razon: 'En el tapering lo que mejora el rendimiento es bajar el volumen sin perder intensidad ni frecuencia (metaanálisis de Bosquet y revisión de Mujika y Padilla).',
      riesgo: 'bajo',
      metrica_objetivo: 'carga_semana',
      direccion: 'baja',
      dois: [DOI.BOSQUET_2007, DOI.MUJIKA_2003],
      datos: 1,
      persistencia: 1,
      prioridad: 2,
    })
  }

  // R1 — Demasiado poco tiempo realmente suave.
  const ir = e.intensidad
  let reparto = false
  if (hayDatos && !sobrecarga && e.limitesFc && ir.valoracion !== 'sin_datos' && ir.minutos >= 180 && ir.pctSuave < 65) {
    reparto = true
    const previo = e.intensidadPrevia.valoracion !== 'sin_datos' ? e.intensidadPrevia.pctSuave : null
    const ritmoE = e.ritmos ? ` Con el VDOT ${e.vdot} el ritmo fácil de referencia es ${formatearRitmo(e.ritmos.E)}/km, y se va más lento si el pulso lo pide (calor, fatiga).` : ''
    propuestas.push({
      regla: 'reparto_suave',
      sesion: 'general',
      cambio: `Hasta nueva orden, los rodajes y la tirada larga se hacen con el pulso por debajo de ${e.limitesFc.suaveHasta} ppm; manda el pulso, no el ritmo.${ritmoE} Las sesiones de calidad se mantienen. Objetivo: llegar al 75 % del tiempo en suave en 6-8 semanas.`,
      razon: `Últimas 4 semanas: ${ir.pctSuave} % suave, ${ir.pctMedia} % medio y ${ir.pctDura} % duro (${r0(ir.minutos / 60 * 10) / 10} h con pulso)${previo !== null ? `; las 8 anteriores, ${previo} % suave` : ''}. En corredores de resistencia suele funcionar alrededor del 75-80 % suave.${e.deriva.media !== null && e.deriva.media >= 8 ? ` La deriva cardiaca media es ${e.deriva.media.toFixed(1)} % (referencia <5 %), coherente con rodajes demasiado fuertes.` : ''}`,
      riesgo: 'bajo',
      metrica_objetivo: 'pct_suave',
      dois: [DOI.SEILER_2010, DOI.STOGGL_2014, DOI.JAMNICK_2020],
      datos: acota(ir.minutos / 600),
      persistencia: previo !== null && previo < 65 ? 1 : 0.6,
      prioridad: ir.pctSuave < 40 ? 3 : 4,
    })
  }

  // R3 — Deriva alta sin que el reparto ya lo cubra.
  if (hayDatos && !reparto && !sobrecarga && e.deriva.media !== null && e.deriva.n >= 4 && e.deriva.media >= 10) {
    propuestas.push({
      regla: 'deriva_alta',
      sesion: 'general',
      cambio: 'En los rodajes de más de 40 minutos, bajar el ritmo unos 10-15 s/km hasta que la deriva cardiaca baje del 5 %.',
      razon: `Deriva cardiaca media de ${e.deriva.media.toFixed(1)} % en las últimas ${e.deriva.n} carreras continuas: el pulso sube mucho en la segunda mitad para el mismo ritmo (referencia <5 %).`,
      riesgo: 'bajo',
      metrica_objetivo: 'deriva',
      dois: [DOI.MAUNDER_2021],
      datos: acota(e.deriva.n / 6),
      persistencia: 0.8,
      prioridad: 5,
    })
  }

  // R4 — Series y tempo que no salen en el ritmo previsto.
  if (hayDatos && e.ejecucion.repsEvaluadas >= 8 && e.ejecucion.repsLentas / e.ejecucion.repsEvaluadas >= 0.5) {
    propuestas.push({
      regla: 'ejecucion_lenta',
      sesion: 'general',
      cambio: `Revisar los ritmos objetivo de las series y el tempo antes de exigir más: comprobar si el VDOT (${e.vdot ?? 'sin dato'}) sigue siendo correcto y si falta recuperación entre sesiones duras. Si se confirma, ampliar el rango 5-8 s/km hacia el lado lento.`,
      razon: `${e.ejecucion.repsLentas} de ${e.ejecucion.repsEvaluadas} repeticiones de las últimas 4 semanas salieron más lentas que el rango previsto, en ${e.ejecucion.sesionesEvaluadas} sesiones.`,
      riesgo: 'medio',
      dois: [],
      datos: acota(e.ejecucion.repsEvaluadas / 20),
      persistencia: 0.8,
      prioridad: 5,
    })
  }

  // R5 — Fuerza para correr mejor.
  if (hayDatos && !sobrecarga && e.carrerasPorSemana >= 2.5 && e.fuerzaEnPlan === 0 && e.fuerza28d < 4) {
    propuestas.push({
      regla: 'fuerza',
      sesion: 'general',
      cambio: 'Añadir 2 sesiones de fuerza a la semana de 30-40 minutos (sentadilla, peso muerto rumano, zancadas, gemelo y pliometría ligera), a 48 horas de la sesión de calidad más exigente.',
      razon: `Corre ${e.carrerasPorSemana} veces por semana y no hay fuerza en el plan ni registrada (${e.fuerza28d} sesiones en 4 semanas). La fuerza mejora la economía de carrera y el rendimiento en corredores entrenados.`,
      riesgo: 'medio',
      metrica_objetivo: 'eficiencia',
      dois: [DOI.BLAGROVE_2018, DOI.BALSALOBRE_2016, DOI.RONNESTAD_2014],
      datos: 0.8,
      persistencia: 0.8,
      prioridad: 6,
    })
  } else if (hayDatos && e.fuerzaEnPlan > 0 && e.fuerza28d < e.fuerzaEnPlan * 2) {
    propuestas.push({
      regla: 'fuerza_sin_registro',
      sesion: 'general',
      cambio: 'Confirmar si las sesiones de fuerza o híbridas del plan se están haciendo y registrando con el reloj; sin registro no se puede medir su carga ni su efecto.',
      razon: `El plan tiene ${e.fuerzaEnPlan} sesiones de fuerza o híbridas por semana y el reloj solo registra ${e.fuerza28d} en las últimas 4 semanas.`,
      riesgo: 'bajo',
      dois: [],
      datos: 0.6,
      persistencia: 0.8,
      prioridad: 8,
    })
  }

  // R7 — Poca variación entre días.
  if (hayDatos && !sobrecarga && tiene(e, 'monotonia') && c?.monotonia != null) {
    propuestas.push({
      regla: 'monotonia',
      sesion: 'general',
      cambio: 'Marcar más la diferencia entre días: que los días fáciles sean realmente fáciles y los duros se concentren en 2 por semana.',
      razon: `Monotonía ${c.monotonia} (por encima de 2 hay poca variación entre días, lo que se asocia a más riesgo de enfermedad y sobreentrenamiento con carga alta).`,
      riesgo: 'bajo',
      dois: [DOI.FOSTER_1998],
      datos: 0.8,
      persistencia: 0.7,
      prioridad: 6,
    })
  }

  // R9 — Pulso en reposo alto.
  if (tiene(e, 'rhr_alto')) {
    propuestas.push({
      regla: 'pulso_reposo',
      sesion: 'general',
      cambio: 'Dos o tres días de intensidad baja (o descanso) y vigilar sueño y síntomas; reevaluar si el pulso en reposo no vuelve a su base.',
      razon: 'El pulso en reposo está claramente por encima de su base: posible fatiga acumulada o inicio de enfermedad.',
      riesgo: 'bajo',
      dois: [],
      datos: 0.7,
      persistencia: 0.6,
      prioridad: 3,
    })
  }

  // R8 — Margen para progresar: condiciones estrictas.
  if (hayDatos && e.carreras6sem >= 10 && !sobrecarga && c && c.rampa7 < 3 && c.tsb >= -10 && c.tsb <= 8 &&
      ir.valoracion !== 'sin_datos' && ir.pctSuave >= 70 && e.deriva.media !== null && e.deriva.media < 6 && e.deriva.n >= 3 &&
      (e.diasCompeticion === null || e.diasCompeticion > 21)) {
    propuestas.push({
      regla: 'progresion',
      sesion: 'general',
      cambio: 'Hay margen para subir el volumen de carrera un 5-10 % esta semana, alargando la tirada larga o un rodaje (no la intensidad).',
      razon: `Reparto sólido (${ir.pctSuave} % suave), deriva baja (${e.deriva.media.toFixed(1)} %), frescura ${c.tsb} y subida de forma de solo ${c.rampa7}. Las progresiones graduales se toleran mejor que los saltos grandes.`,
      riesgo: 'medio',
      metrica_objetivo: 'km_semana',
      direccion: 'sube',
      dois: [DOI.NIELSEN_2014, DOI.FOKKEMA_2021],
      datos: 0.9,
      persistencia: 0.8,
      prioridad: 7,
    })
  }

  propuestas.sort((a, b) => a.prioridad - b.prioridad)
  return { propuestas, notas }
}

/** Qué tan fiable es una evidencia según el diseño del estudio (0-1). Sin estudios: criterio de entrenador. */
export const PESO_EVIDENCIA: Record<string, number> = { meta_analisis: 1, revision_sistematica: 0.85, rct: 0.7, estudio_observacional: 0.5, opinion_experto: 0.35 }

export interface Fiabilidad {
  valor: number
  nivel: 'alta' | 'media' | 'baja'
  motivos: string[]
}

/**
 * Fiabilidad calculada con criterios visibles: cantidad de datos, calidad de la evidencia que respalda la propuesta y si la situación
 * persiste. No usa la confianza que declara el modelo.
 */
export function calcularFiabilidad(p: { datos: number; persistencia: number; nivelesEvidencia: string[]; origen: 'regla' | 'ia' }): Fiabilidad {
  const evidencia = p.nivelesEvidencia.length ? Math.max(...p.nivelesEvidencia.map(n => PESO_EVIDENCIA[n] ?? 0.35)) : 0.2
  const bruto = 0.35 * acota(p.datos) + 0.35 * evidencia + 0.3 * acota(p.persistencia)
  const valor = Math.round(acota(p.origen === 'ia' ? Math.min(bruto * 0.85, 0.8) : bruto) * 100) / 100
  const motivos = [
    p.datos >= 0.7 ? 'datos suficientes' : p.datos >= 0.4 ? 'datos justos' : 'pocos datos',
    p.nivelesEvidencia.length ? `respaldo de estudios (${p.nivelesEvidencia.length})` : 'sin estudios que lo respalden (criterio de entrenador)',
    p.persistencia >= 0.8 ? 'la situación se repite' : 'situación reciente, aún sin repetirse',
    ...(p.origen === 'ia' ? ['propuesta de la IA: no deriva de una regla verificable'] : []),
  ]
  return { valor, nivel: valor >= 0.7 ? 'alta' : valor >= 0.5 ? 'media' : 'baja', motivos }
}

/** «Segura» = se puede aprobar de un vistazo: riesgo bajo, fiabilidad suficiente y de una regla del motor. */
export function esSegura(p: { riesgo: Riesgo; fiabilidad: Fiabilidad; origen: 'regla' | 'ia' }): boolean {
  return p.origen === 'regla' && p.riesgo === 'bajo' && p.fiabilidad.valor >= 0.6
}

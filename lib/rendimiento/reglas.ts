// lib/rendimiento/reglas.ts
// Motor de reglas de entrenamiento de carrera: decide QUÉ proponer cuando los datos lo justifican.
// Es determinista (misma entrada, misma salida), con condiciones y cifras a la vista y los estudios que lo respaldan por DOI.
// La IA no decide si una regla se cumple: solo puede explicar, priorizar y matizar lo que el motor ya ha dicho.
//
// Principios de diseño (auditoría del 10-10-2026):
//  - Ante la duda, no proponer: sin datos suficientes, con lesiones declaradas o tras un parón el motor se calla o es más prudente.
//  - Las reglas que añaden carga (fuerza, progresión) nunca son «seguras» y respetan nivel, días disponibles, lesiones y recuperación.
//  - Los umbrales que son criterio de entrenador (no de un estudio) se dicen como tales.
import { formatearRitmo } from '@/lib/entrenos/ritmos'
import { diasTaper, perfilPrueba, type PerfilPrueba } from '@/lib/nutricion/competicion'
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
  MEEUSEN_2013: '10.1249/MSS.0b013e318279a10a',
  SOLIGARD_2016: '10.1136/bjsports-2016-096581',
  MUJIKA_DESENTRENO_2000: '10.2165/00007256-200030030-00001',
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
  /** Advertencias para el coach (lesiones declaradas, umbrales estimados…). */
  avisos?: string[]
}

export interface ResultadoReglas {
  propuestas: PropuestaRegla[]
  /** Avisos que explican por qué no se propone algo (datos insuficientes, falta de días, etc.). */
  notas: string[]
}

/** Mínimo de carreras con pulso en 6 semanas para que el motor proponga cambios. */
export const MIN_CARRERAS = 6

const r0 = (n: number) => Math.round(n)
const acota = (n: number) => Math.min(1, Math.max(0, n))
const tiene = (e: EstadoAtleta, codigo: string) => e.alertas.includes(codigo)

/** Reducción de volumen del tapering según la duración de la prueba: orientativa en pruebas cortas, respaldada por la literatura en las largas. */
const REDUCCION_TAPER: Record<PerfilPrueba, { general: string; ultima: string }> = {
  corta: { general: '25-35 %', ultima: '30-40 %' },
  media: { general: '30-40 %', ultima: '40-50 %' },
  larga: { general: '40-50 %', ultima: '50-60 %' },
  muy_larga: { general: '40-55 %', ultima: '50-60 %' },
}

export function evaluarReglas(e: EstadoAtleta): ResultadoReglas {
  const propuestas: PropuestaRegla[] = []
  const notas: string[] = []

  if (e.carreras6sem < MIN_CARRERAS) {
    notas.push(`Solo ${e.carreras6sem} carreras con pulso en las últimas 6 semanas: el motor necesita al menos ${MIN_CARRERAS} para proponer cambios con fiabilidad.`)
  }
  const hayDatos = e.carreras6sem >= MIN_CARRERAS
  const sobrecarga = tiene(e, 'rampa_alta') || tiene(e, 'fatiga_alta') || tiene(e, 'llega_cansado')
  const c = e.carga
  const p = e.perfil
  const principiante = /princip|novel|inicia|beginner/i.test(p.nivel ?? '')
  const lesiones = [...p.lesiones, ...(p.restricciones ? [p.restricciones] : [])]
  const limitado = lesiones.length > 0
  const recuperacionBaja = /baja|lenta/i.test(p.recuperacion ?? '')
  if (limitado) notas.push(`Hay lesiones o restricciones declaradas en el perfil (${lesiones.join('; ')}): el motor no propone aumentos de carga sin que las revises y marca como «alto» el riesgo de añadir fuerza.`)
  if (e.retorno) notas.push('El atleta viene de un parón reciente: el motor solo propone una vuelta gradual y no sube carga.')

  // Vuelta tras un parón: manda sobre todo lo que añada carga.
  if (e.retorno && !sobrecarga) {
    propuestas.push({
      regla: 'retorno',
      sesion: 'general',
      cambio: 'Vuelta gradual: durante 2-3 semanas, el 50-70 % del volumen que hacía antes, solo carrera suave (sin series ni tempo) y con un día libre entre salidas. Después, subir como máximo un 10 % por semana y reintroducir la calidad de forma progresiva.',
      razon: 'Ha estado al menos 2 semanas seguidas sin correr y lleva menos de 4 semanas de vuelta. Tras una pausa el sistema cardiovascular se readapta antes que tendones y huesos; los saltos grandes de volumen se asocian a más lesiones, sobre todo en corredores noveles.',
      riesgo: 'bajo',
      metrica_objetivo: 'km_semana',
      direccion: 'sube',
      dois: [DOI.MUJIKA_DESENTRENO_2000, DOI.NIELSEN_2014],
      datos: 0.8,
      persistencia: 1,
      prioridad: 3,
      avisos: ['Los porcentajes (50-70 %, +10 %/semana) son criterio de entrenador: los estudios respaldan la prudencia, no esas cifras exactas.'],
    })
  }

  // Sobrecarga: manda sobre todo lo demás.
  if (sobrecarga && c) {
    propuestas.push({
      regla: 'sobrecarga',
      sesion: 'general',
      cambio: 'Semana de descarga: bajar el volumen un 30-40 % y dejar solo una sesión de calidad corta. No subir la carga hasta que la frescura vuelva por encima de -20.',
      razon: `Forma ${c.ctl}, fatiga ${c.atl}, frescura ${c.tsb}, subida de forma de ${c.rampa7} puntos en 7 días (por encima de ~8 o con frescura bajo -30 aumenta el riesgo de sobrecarga).`,
      riesgo: 'bajo',
      metrica_objetivo: 'carga_semana',
      direccion: 'baja',
      dois: [DOI.SOLIGARD_2016, DOI.MEEUSEN_2013, DOI.FOSTER_1998],
      datos: 1,
      persistencia: c.tsb < -30 ? 1 : 0.7,
      prioridad: 1,
      avisos: ['Los umbrales (subida de forma >8, frescura < -30) son convenciones de TrainingPeaks pensadas para atletas con más forma acumulada; con poca carga base son menos sensibles.'],
    })
  }

  // Tapering: ventana y profundidad según la prueba.
  const comp = e.competicion ?? (e.diasCompeticion !== null ? { dias: e.diasCompeticion, disciplina: '', tiempoObjetivoMin: null } : null)
  if (comp && comp.dias >= 0 && comp.dias <= diasTaper(comp.disciplina)) {
    const perfilP = perfilPrueba(comp.disciplina, comp.tiempoObjetivoMin)
    const rango = comp.dias <= 7 ? REDUCCION_TAPER[perfilP].ultima : REDUCCION_TAPER[perfilP].general
    propuestas.push({
      regla: 'tapering',
      sesion: 'general',
      cambio: `Faltan ${comp.dias} días: reducir el volumen semanal un ${rango} respecto a la semana de más carga, manteniendo la intensidad en 1-2 sesiones de calidad cortas y la frecuencia de entrenos.`,
      razon: `La reducción del volumen manteniendo intensidad y frecuencia es lo que mejora el rendimiento antes de competir; en pruebas largas el óptimo está en torno a 2 semanas y un 40-60 % menos de volumen (Bosquet; Mujika y Padilla), y en pruebas cortas el tapering es más breve y suave.`,
      riesgo: 'bajo',
      metrica_objetivo: 'carga_semana',
      direccion: 'baja',
      dois: [DOI.BOSQUET_2007, DOI.MUJIKA_2003],
      datos: 1,
      persistencia: 1,
      prioridad: 2,
      avisos: perfilP === 'corta' || perfilP === 'media' ? ['En pruebas cortas y medias las cifras de reducción son orientativas: la literatura se centra sobre todo en pruebas largas.'] : undefined,
    })
  }

  // Demasiado poco tiempo realmente suave.
  const ir = e.intensidad
  let reparto = false
  if (hayDatos && !sobrecarga && !e.retorno && e.limitesFc && ir.valoracion !== 'sin_datos' && ir.minutos >= 180 && ir.pctSuave < 65) {
    reparto = true
    const previo = e.intensidadPrevia.valoracion !== 'sin_datos' ? e.intensidadPrevia.pctSuave : null
    const ideal = r0(e.limitesFc.mediaHasta * 0.85)
    const ritmoE = e.ritmos ? ` Con el VDOT ${e.vdot} el ritmo fácil de referencia es ${formatearRitmo(e.ritmos.E)}/km, y se va más lento si el pulso lo pide (calor, fatiga).` : ''
    const derivaBaja = e.deriva.media !== null && e.deriva.n >= 3 && e.deriva.media < 6
    const derivaAlta = e.deriva.media !== null && e.deriva.n >= 3 && e.deriva.media >= 8
    propuestas.push({
      regla: 'reparto_suave',
      sesion: 'general',
      cambio: `En los rodajes y la tirada larga, llevar el pulso por debajo de ${e.limitesFc.suaveHasta} ppm y, en la mayoría, por debajo de ${ideal} ppm. Control práctico: poder hablar en frases completas. Manda el pulso, no el ritmo.${ritmoE}${principiante ? ' Si hace falta, alternar caminar y correr para no pasar de ese pulso.' : ''} Las sesiones de calidad se mantienen. Objetivo: llegar al 75 % del tiempo en suave en 6-8 semanas.`,
      razon: `Últimas 4 semanas: ${ir.pctSuave} % suave, ${ir.pctMedia} % medio y ${ir.pctDura} % duro (${r0(ir.minutos / 60 * 10) / 10} h con pulso)${previo !== null ? `; las 8 anteriores, ${previo} % suave` : ''}. En corredores de resistencia suele funcionar alrededor del 75-80 % suave, aunque la ventaja sobre otros repartos es moderada y varía entre personas.${derivaBaja ? ` Su deriva cardiaca es baja (${e.deriva.media!.toFixed(1)} %): tolera bien esos ritmos, así que es una oportunidad de optimizar el reparto y no un problema de fatiga.` : ''}${derivaAlta ? ` La deriva cardiaca media es ${e.deriva.media!.toFixed(1)} % (referencia orientativa <5 %), coherente con rodajes demasiado fuertes.` : ''}`,
      riesgo: 'bajo',
      metrica_objetivo: 'pct_suave',
      dois: [DOI.SEILER_2010, DOI.STOGGL_2014, DOI.JAMNICK_2020],
      datos: acota(ir.minutos / 600),
      persistencia: previo !== null && previo < 65 ? 1 : 0.6,
      prioridad: derivaBaja ? 5 : ir.pctSuave < 40 ? 3 : 4,
      avisos: [`El pulso de umbral (${e.limitesFc.mediaHasta} ppm) es el que mide el reloj; los límites del 90 % y el 85 % del umbral son aproximaciones de zona (Friel) y varían entre personas. Conviene confirmarlos con la prueba del habla.`],
    })
  }

  // Deriva alta sin que el reparto ya lo cubra (calculada sin los primeros 10 minutos).
  if (hayDatos && !reparto && !sobrecarga && !e.retorno && e.deriva.media !== null && e.deriva.n >= 4 && e.deriva.media >= 10) {
    propuestas.push({
      regla: 'deriva_alta',
      sesion: 'general',
      cambio: 'En los rodajes de más de 40 minutos, bajar el ritmo unos 10-15 s/km hasta que la deriva cardiaca baje del 5 %.',
      razon: `Deriva cardiaca media de ${e.deriva.media.toFixed(1)} % en las últimas ${e.deriva.n} carreras continuas, sin contar los primeros 10 minutos: el pulso sube mucho en la segunda mitad para el mismo ritmo (referencia orientativa <5 %, criterio de desacoplamiento Pa:Hr).`,
      riesgo: 'bajo',
      metrica_objetivo: 'deriva',
      dois: [DOI.MAUNDER_2021],
      datos: acota(e.deriva.n / 6),
      persistencia: 0.8,
      prioridad: 5,
      avisos: ['Calor, desnivel y deshidratación también elevan la deriva: comprobar que las condiciones de esas carreras eran comparables.'],
    })
  }

  // Series y tempo que no salen en el ritmo previsto.
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
      avisos: ['El calor, el desnivel o una semana de mucha carga también retrasan las repeticiones: la causa puede no ser el VDOT.'],
    })
  }

  // Fuerza para correr mejor: respeta días disponibles, lesiones y recuperación.
  const hayDiasParaFuerza = p.diasDisponibles === null || p.diasDisponibles >= Math.ceil(e.carrerasPorSemana) + 2
  if (hayDatos && !sobrecarga && !e.retorno && e.carrerasPorSemana >= 2.5 && e.fuerzaEnPlan === 0 && e.fuerza28d < 4) {
    if (!hayDiasParaFuerza) {
      notas.push(`No se propone fuerza: el atleta tiene ${p.diasDisponibles} días disponibles y ya corre ${e.carrerasPorSemana} veces por semana; haría falta integrarla en días de carrera.`)
    } else {
      propuestas.push({
        regla: 'fuerza',
        sesion: 'general',
        cambio: `Añadir 2 sesiones de fuerza a la semana de 30-40 minutos (sentadilla, peso muerto rumano, zancadas, gemelo y pliometría ligera), a 48 horas de la sesión de calidad más exigente.${limitado ? ` Antes de empezar, revisar contraindicaciones por: ${lesiones.join('; ')}.` : ''}`,
        razon: `Corre ${e.carrerasPorSemana} veces por semana y no hay fuerza en el plan ni registrada (${e.fuerza28d} sesiones en 4 semanas). La fuerza mejora la economía de carrera y el rendimiento en corredores entrenados.${recuperacionBaja ? ' Su capacidad de recuperación es baja: empezar con 1 sesión.' : ''}`,
        riesgo: limitado ? 'alto' : 'medio',
        metrica_objetivo: 'eficiencia',
        dois: [DOI.BLAGROVE_2018, DOI.BALSALOBRE_2016, DOI.RONNESTAD_2014],
        datos: 0.8,
        persistencia: 0.8,
        prioridad: 6,
        avisos: limitado ? ['Hay lesiones o restricciones en el perfil: la pliometría y la carga pesada pueden estar contraindicadas.'] : undefined,
      })
    }
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

  // Poca variación entre días.
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

  // Pulso en reposo alto.
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

  // Margen para progresar: condiciones estrictas y nada de subir carga con limitaciones, parón, mala recuperación o señales de fatiga.
  if (hayDatos && e.carreras6sem >= 10 && !sobrecarga && !e.retorno && !limitado && !recuperacionBaja && !principiante &&
      !tiene(e, 'salto_semanal') && !tiene(e, 'rhr_alto') && !tiene(e, 'monotonia') &&
      c && c.rampa7 < 3 && c.tsb >= -10 && c.tsb <= 8 &&
      ir.valoracion !== 'sin_datos' && ir.pctSuave >= 70 && e.deriva.media !== null && e.deriva.media < 6 && e.deriva.n >= 3 &&
      (e.competicion === null && (e.diasCompeticion === null || e.diasCompeticion > 21) || (e.competicion !== null && e.competicion.dias > 21))) {
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
      avisos: ['La cifra del 5-10 % es criterio de entrenador: la evidencia sobre un porcentaje «seguro» de subida es débil (Nielsen: los saltos de más del 30 % se asociaron a más lesiones).'],
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
 * persiste. No usa la confianza que declara el modelo. La evidencia es la media de los dos mejores estudios (no el mejor solo),
 * para que un único estudio fuerte no tape a otros débiles.
 */
export function calcularFiabilidad(p: { datos: number; persistencia: number; nivelesEvidencia: string[]; origen: 'regla' | 'ia' }): Fiabilidad {
  const pesos = p.nivelesEvidencia.map(n => PESO_EVIDENCIA[n] ?? 0.35).sort((a, b) => b - a).slice(0, 2)
  const evidencia = pesos.length ? pesos.reduce((a, b) => a + b, 0) / pesos.length : 0.2
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

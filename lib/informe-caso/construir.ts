// lib/informe-caso/construir.ts
// Informe del caso para que el COACH explique la situación de un cliente (chat, WhatsApp, llamada). Función pura: plantillas con datos reales.
// Regla: cada número de los textos viene de los datos; lo que no se sabe va a «loQueNoSe», nunca se rellena.
import { etiquetaDecision, glosarSiglas, porQueResumen, resumirPropuesta, titularDe } from '@/lib/rendimiento/presentacion'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

export type Escenario = 'alerta' | 'propuesta_bloque' | 'ajustes' | 'sin_cambios'

export const ETIQUETA_ESCENARIO: Record<Escenario, string> = {
  alerta: 'Hay una alerta que hablar', propuesta_bloque: 'Hay un siguiente bloque propuesto', ajustes: 'Hay ajustes propuestos', sin_cambios: 'Sin cambios: seguir con el plan',
}

export interface DecisionInforme {
  cambio: string; razon: string
  /** `regla` = motor de reglas (frases en infinitivo, dirigidas al atleta); `ia` = añadida por el modelo (escrita para el coach). */
  origen?: 'regla' | 'ia'
  segura?: boolean; riesgo?: 'bajo' | 'medio' | 'alto'; fiabilidad?: { nivel: 'alta' | 'media' | 'baja' }; estudios?: unknown[]; confianza?: number
}

export interface DatosInforme {
  nombre: string
  atleta: {
    hayDatos: boolean
    minutosCarreraSemana: number | null; salidasSemana: number | null; pctSuave: number | null
    forma: number | null; fatiga: number | null; frescura: number | null
    /** Sesiones con ritmos previstos en las últimas 4 semanas (calidad, tiradas y rodajes estructurados) y cuántas se hicieron (null si no hay datos). */
    sesionesConRitmoPrevistas: number | null; sesionesConRitmoHechas: number | null
    retorno: boolean; vdot: number | null; fuerzaRegistrada: number; fuerzaEnPlan: number; alertasAltas: string[]
  }
  plan: { nombre: string; semanaActual: number | null; semanasTotales: number | null; diasRestantes: number | null } | null
  analisis: { resumen?: string; alerta_prioritaria?: string | null; decisiones?: DecisionInforme[]; preguntas_al_coach?: string[] } | null
  propuesta: PayloadPlanEntrenoIA | null
}

export interface InformeCaso {
  cliente: string
  escenario: Escenario
  situacion: { titulo: string; datos: { etiqueta: string; valor: string }[] }
  plan: string | null
  cambios: string[]
  porQue: { texto: string; origen: string }[]
  loQueNoSe: string[]
  mensaje: string
  guion: { paso: string; texto: string }[]
  /** Para hacerle al cliente. */
  preguntas: string[]
  /** Dudas del análisis que decide el coach antes de hablar (no son para el cliente). */
  preguntasCoach: string[]
}

const MAX_MENSAJE = 700
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const limpiar = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Frases enteras hasta un tope de caracteres (la primera sola puede ser un diagnóstico sin la acción). */
function primerasFrases(texto: string, max: number): string {
  const t = limpiar(texto)
  // Se parte en un punto seguido de espacio: «3.5» y «-1.3» no se cortan.
  const frases = t.split(/(?<=[.!?])\s+/).map(f => f.trim()).filter(Boolean)
  let salida = ''
  for (const f of frases) {
    const union = salida ? `${salida} ${f}` : f
    if (union.length > max) {
      // La frase no cabe entera: se queda la parte antes de «:» o «;» (la acción sin su detalle) si cabe.
      const parte = f.split(/[:;]/)[0].trim().replace(/[.!?]+$/, '')
      if (salida && parte && parte !== f.replace(/[.!?]+$/, '') && `${salida} ${parte}`.length <= max) salida = `${salida} ${parte}.`
      break
    }
    salida = union
  }
  if (salida) return salida
  const corte = t.slice(0, max - 1)
  return `${corte.slice(0, corte.lastIndexOf(' ') > max * 0.5 ? corte.lastIndexOf(' ') : corte.length).trimEnd()}…`
}

/** Decisiones escritas para el coach («Confirmar si…»): no van en el mensaje al cliente. */
const minusculaInicial = (t: string) => t.replace(/^([A-ZÁÉÍÓÚÑ])([a-záéíóúñ])/, (_m, a: string, b: string) => `${a.toLowerCase()}${b}`)
const dirigidaAlCoach = (cambio: string) => /^\s*(confirmar|comprobar|revisar|preguntar|valorar|verificar|decidir)\b/i.test(cambio)
const ORDEN_ETIQUETA = { seguro: 0, mirar: 1, revisar: 2 } as const
const SIGLAS_INTERNAS = /\b(CTL|ATL|TSB|ACWR|VDOT|RPE)\b/

/**
 * Qué decisiones se pueden proponer al cliente: solo las del motor de reglas (frases en infinitivo, para el atleta), sin siglas internas,
 * sin tercera persona con su nombre y sin nada que pida revisión previa del coach.
 */
function paraElCliente(x: DecisionInforme, nombrePila: string): boolean {
  if (x.origen !== 'regla' || dirigidaAlCoach(x.cambio)) return false
  // Se mira solo lo que irá en el mensaje, no el texto entero.
  const fragmento = primerasFrases(x.cambio, 170)
  if (SIGLAS_INTERNAS.test(fragmento)) return false
  if (nombrePila && fragmento.toLowerCase().split(/[^a-záéíóúñ]+/i).includes(nombrePila.toLowerCase())) return false
  return etiquetaDecision(x) !== 'revisar'
}
const pilaDe = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? ''

function escenarioDe(d: DatosInforme): Escenario {
  if (d.analisis?.alerta_prioritaria || d.atleta.alertasAltas.length > 0) return 'alerta'
  if (d.propuesta) return 'propuesta_bloque'
  if ((d.analisis?.decisiones?.length ?? 0) > 0) return 'ajustes'
  return 'sin_cambios'
}

function datosSituacion(a: DatosInforme['atleta'], plan: DatosInforme['plan']) {
  const datos: { etiqueta: string; valor: string }[] = []
  if (a.minutosCarreraSemana) datos.push({ etiqueta: 'Carrera', valor: `${a.minutosCarreraSemana} min por semana${a.salidasSemana ? ` en ${fmt(a.salidasSemana)} salidas` : ''}` })
  if (a.pctSuave != null) datos.push({ etiqueta: 'Tiempo en suave', valor: `${Math.round(a.pctSuave)} %` })
  if (a.forma != null && a.fatiga != null) datos.push({ etiqueta: 'Forma y fatiga', valor: `forma ${fmt(a.forma)}, fatiga ${fmt(a.fatiga)}${a.frescura != null ? `, frescura ${fmt(a.frescura)}` : ''}` })
  if (a.sesionesConRitmoPrevistas && a.sesionesConRitmoPrevistas > 0) datos.push({ etiqueta: 'Sesiones con ritmos', valor: `${a.sesionesConRitmoHechas ?? 0} de ${a.sesionesConRitmoPrevistas} hechas` })
  if (plan?.semanaActual && plan.semanasTotales) datos.push({ etiqueta: 'Plan', valor: `semana ${plan.semanaActual} de ${plan.semanasTotales}` })
  return datos
}

function loQueNoSe(d: DatosInforme): string[] {
  const l: string[] = []
  if (!d.atleta.hayDatos) l.push('No hay entrenos recientes del reloj: no puedo valorar su carga ni su cumplimiento.')
  if (d.atleta.fuerzaEnPlan > 0 && d.atleta.fuerzaRegistrada === 0) l.push(`El plan tiene ${d.atleta.fuerzaEnPlan} sesiones de fuerza o híbridas por semana y no hay ninguna registrada: no sé si las hace.`)
  if (d.atleta.vdot == null) l.push('Sin VDOT: los ritmos de referencia no están calculados.')
  if (!d.plan) l.push('No tiene un plan de entreno activo.')
  if (!d.analisis) l.push('Todavía no hay un análisis de rendimiento.')
  return l
}

function lineaDatos(a: DatosInforme['atleta']): string {
  const partes: string[] = []
  if (a.minutosCarreraSemana) partes.push(`estás corriendo unos ${a.minutosCarreraSemana} minutos por semana${a.salidasSemana ? ` en ${fmt(a.salidasSemana)} salidas` : ''}`)
  if (a.pctSuave != null) partes.push(`el ${Math.round(a.pctSuave)} % del tiempo lo haces a ritmo suave`)
  return partes.length ? `Ahora mismo ${partes.join(' y ')}.` : ''
}

function lineaCumplimiento(a: DatosInforme['atleta']): string {
  return a.sesionesConRitmoPrevistas && a.sesionesConRitmoPrevistas > 0 ? `De las ${a.sesionesConRitmoPrevistas} sesiones con ritmos previstas has hecho ${a.sesionesConRitmoHechas ?? 0}.` : ''
}

function mensajeDe(d: DatosInforme, escenario: Escenario): string {
  const saludo = pilaDe(d.nombre) ? `Hola ${pilaDe(d.nombre)}` : 'Hola,'
  const datos = lineaDatos(d.atleta)
  const paraCliente = (d.analisis?.decisiones ?? []).filter(x => paraElCliente(x, pilaDe(d.nombre))).sort((a, b) => ORDEN_ETIQUETA[etiquetaDecision(a)] - ORDEN_ETIQUETA[etiquetaDecision(b)])
  let m: string
  if (escenario === 'alerta') {
    // El texto de la alerta está escrito para el coach (siglas, tercera persona): al cliente solo se le adelanta que quieres hablarlo.
    m = `${saludo}, he visto algo en tus datos de entrenamiento que prefiero comentarte contigo antes de seguir con el plan tal cual. ¿Te va bien una llamada corta hoy o mañana?`
  } else if (escenario === 'propuesta_bloque' && d.propuesta) {
    const r = resumirPropuesta(d.propuesta)
    const carrera = r.queCambia.find(c => c.startsWith('Carrera') && !c.includes('sin datos'))
    const detalle = d.propuesta.fase_bloque ? ` (${d.propuesta.fase_bloque}` + (d.propuesta.duracion_semanas ? `, ${d.propuesta.duracion_semanas} semanas)` : ')') : ''
    const apertura = d.propuesta.modo === 'siguiente_bloque' && d.plan ? `ya se acerca el final de tu bloque actual y te he preparado el siguiente bloque${detalle}` : `te he preparado tu primer bloque de entrenamiento${detalle}`
    m = `${saludo}, ${apertura}. ${datos} ${carrera ? `${carrera.replace('Carrera: ', 'En carrera pasaríamos ')}.` : ''} Es una propuesta: si algo no te encaja, lo ajustamos. ¿Lo hablamos cuando te venga bien?`
  } else if (escenario === 'ajustes' && paraCliente.length > 0) {
    const ajustes = paraCliente.slice(0, 2).map(x => primerasFrases(x.cambio, 170).replace(/[.]+$/, '')).map((t, i) => (i === 0 ? t : minusculaInicial(t))).join('. Además, ')
    m = `${saludo}, he revisado tus últimos entrenamientos. ${datos} Te propongo ${paraCliente.length === 1 ? 'un ajuste' : 'estos ajustes'}: ${ajustes}. ¿Te parece bien que lo probemos estas semanas?`
  } else {
    m = `${saludo}, te escribo para contarte cómo va tu entrenamiento. ${datos} ${lineaCumplimiento(d.atleta)} Por ahora no cambiamos nada: seguimos con tu plan${d.plan?.semanaActual && d.plan.semanasTotales ? ` (semana ${d.plan.semanaActual} de ${d.plan.semanasTotales})` : ''}. Si notas algo raro o tienes dudas, dímelo.`
  }
  m = limpiar(m)
  return m.length <= MAX_MENSAJE ? m : `${m.slice(0, MAX_MENSAJE - 1).replace(/\s+\S*$/, '')}…`
}

export function construirInformeCaso(entrada: DatosInforme): InformeCaso {
  // Una decisión sin texto no se puede presentar: se descarta en lugar de tumbar el informe.
  const decisiones = (entrada.analisis?.decisiones ?? []).filter(x => x && typeof x.cambio === 'string' && x.cambio.trim()).map(x => ({ ...x, razon: typeof x.razon === 'string' ? x.razon : '' }))
  const d: DatosInforme = { ...entrada, analisis: entrada.analisis ? { ...entrada.analisis, decisiones } : null }
  const escenario = escenarioDe(d)

  let cambios: string[]
  if (escenario === 'alerta') cambios = [`Pendiente de hablarlo: ${titularDe(d.analisis?.alerta_prioritaria || d.atleta.alertasAltas[0] || '', 160)}`]
  else if (escenario === 'propuesta_bloque' && d.propuesta) { const r = resumirPropuesta(d.propuesta); cambios = [r.titular, ...r.queCambia] }
  else if (escenario === 'ajustes') cambios = decisiones.slice(0, 3).map(x => glosarSiglas(primerasFrases(x.cambio, 170)))
  else cambios = ['Nada cambia por ahora: sigue con el plan actual.']

  const porQue: { texto: string; origen: string }[] = []
  if (escenario === 'propuesta_bloque' && d.propuesta) {
    for (const f of resumirPropuesta(d.propuesta).fundamentos.slice(0, 3)) porQue.push({ texto: f.regla, origen: `${f.tipo}: ${f.fuente}` })
  } else {
    for (const x of decisiones.slice(0, 3)) porQue.push({ texto: glosarSiglas(titularDe(x.razon, 200)), origen: porQueResumen(x) })
  }

  const noSe = loQueNoSe(d)
  const datos = datosSituacion(d.atleta, d.plan)
  const pide: Record<Escenario, string> = {
    alerta: 'Que te cuente cómo se encuentra antes de decidir nada.',
    propuesta_bloque: 'Que valore el nuevo bloque y te diga si algo no le encaja antes de empezarlo.',
    ajustes: 'Que pruebe el cambio estas semanas y te cuente cómo le sienta.',
    sin_cambios: noSe.some(x => x.includes('fuerza')) ? 'Que siga el plan y registre sus sesiones, también las de fuerza, con el reloj.' : 'Que siga el plan y registre sus sesiones con el reloj.',
  }
  const preguntas = [
    '¿Cómo has dormido y cómo notas las piernas?',
    '¿Alguna molestia o dolor?',
    ...(noSe.some(x => x.includes('fuerza')) ? ['¿Estás haciendo las sesiones de fuerza o híbridas? ¿Las registras en el reloj?'] : []),
  ]
  const preguntasCoach = (d.analisis?.preguntas_al_coach ?? []).filter((p, i, a) => a.indexOf(p) === i)

  const guion = [
    { paso: 'Abrir', texto: 'Pregúntale cómo se ha sentido estos días: energía, sueño y molestias.' },
    { paso: 'Cómo va', texto: datos.length ? datos.map(x => `${x.etiqueta}: ${x.valor}`).join('. ') + '.' : 'No hay datos recientes del reloj: pregúntale directamente cómo van los entrenos.' },
    { paso: 'Qué cambia', texto: cambios.join(' ') },
    { paso: 'Por qué', texto: porQue.length ? porQue.slice(0, 2).map(p => `${p.texto} (${p.origen})`).join(' ') : 'Explícale que mantener el plan es lo que dicen sus datos.' },
    { paso: 'Qué le pides', texto: pide[escenario] },
    { paso: 'Cerrar', texto: 'Acordad cuándo volvéis a hablar, por ejemplo tras su próxima sesión importante.' },
  ]

  return {
    cliente: d.nombre.trim(),
    escenario,
    situacion: { titulo: ETIQUETA_ESCENARIO[escenario], datos },
    plan: d.plan ? `${d.plan.nombre}${d.plan.semanaActual && d.plan.semanasTotales ? ` · semana ${d.plan.semanaActual} de ${d.plan.semanasTotales}` : ''}` : null,
    cambios,
    porQue,
    loQueNoSe: noSe,
    mensaje: mensajeDe(d, escenario),
    guion,
    preguntas,
    preguntasCoach,
  }
}

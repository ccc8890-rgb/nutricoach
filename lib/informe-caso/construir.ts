// lib/informe-caso/construir.ts
// Informe del caso para que el COACH explique la situación de un cliente (chat, WhatsApp, llamada). Función pura: plantillas con datos reales.
// Regla: cada número de los textos viene de los datos; lo que no se sabe va a «loQueNoSe», nunca se rellena.
import { glosarSiglas, porQueResumen, resumirPropuesta, titularDe } from '@/lib/rendimiento/presentacion'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

export type Escenario = 'alerta' | 'propuesta_bloque' | 'ajustes' | 'sin_cambios'

export const ETIQUETA_ESCENARIO: Record<Escenario, string> = {
  alerta: 'Hay una alerta que hablar', propuesta_bloque: 'Hay un siguiente bloque propuesto', ajustes: 'Hay ajustes propuestos', sin_cambios: 'Sin cambios: seguir con el plan',
}

export interface DecisionInforme {
  cambio: string; razon: string
  segura?: boolean; riesgo?: 'bajo' | 'medio' | 'alto'; fiabilidad?: { nivel: 'alta' | 'media' | 'baja' }; estudios?: unknown[]; confianza?: number
}

export interface DatosInforme {
  nombre: string
  atleta: {
    hayDatos: boolean
    minutosCarreraSemana: number | null; salidasSemana: number | null; pctSuave: number | null
    forma: number | null; fatiga: number | null; frescura: number | null
    sesionesEvaluadas: number | null; sesionesSaltadas: number | null
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
  preguntas: string[]
}

const MAX_MENSAJE = 700
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',')
const limpiar = (t: string) => t.replace(/\s+/g, ' ').trim()
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
  if (a.sesionesEvaluadas && a.sesionesEvaluadas > 0) datos.push({ etiqueta: 'Sesiones de calidad', valor: `${a.sesionesEvaluadas - (a.sesionesSaltadas ?? 0)} de ${a.sesionesEvaluadas} hechas` })
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
  return a.sesionesEvaluadas && a.sesionesEvaluadas > 0 ? `De las ${a.sesionesEvaluadas} sesiones de calidad previstas has hecho ${a.sesionesEvaluadas - (a.sesionesSaltadas ?? 0)}.` : ''
}

function mensajeDe(d: DatosInforme, escenario: Escenario, cambios: string[]): string {
  const saludo = pilaDe(d.nombre) ? `Hola ${pilaDe(d.nombre)}` : 'Hola,'
  const datos = lineaDatos(d.atleta)
  let m: string
  if (escenario === 'alerta') {
    const alerta = d.analisis?.alerta_prioritaria || d.atleta.alertasAltas[0] || ''
    m = `${saludo}, he visto algo en tus datos que quiero comentarte: ${titularDe(alerta, 200).replace(/[.]+$/, '')}. Prefiero que lo hablemos antes de seguir con el plan tal cual. ¿Te va bien una llamada corta hoy o mañana?`
  } else if (escenario === 'propuesta_bloque' && d.propuesta) {
    const r = resumirPropuesta(d.propuesta)
    const carrera = r.queCambia.find(c => c.startsWith('Carrera') && !c.includes('sin datos'))
    m = `${saludo}, ya se acerca el final de tu bloque actual y te he preparado el siguiente bloque${d.propuesta.fase_bloque ? ` (${d.propuesta.fase_bloque}` + (d.propuesta.duracion_semanas ? `, ${d.propuesta.duracion_semanas} semanas)` : ')') : ''}. ${datos} ${carrera ? `${carrera.replace('Carrera: ', 'En carrera pasaríamos ')}.` : ''} Es una propuesta: si algo no te encaja, lo ajustamos. ¿Lo hablamos cuando te venga bien?`
  } else if (escenario === 'ajustes') {
    const ajustes = cambios.slice(0, 2).map(c => c.replace(/[.]+$/, '')).join('; ')
    m = `${saludo}, he revisado tus últimos entrenamientos. ${datos} Te propongo ${cambios.length === 1 ? 'un ajuste' : 'estos ajustes'}: ${ajustes}. ¿Te parece bien que lo probemos estas semanas?`
  } else {
    m = `${saludo}, te escribo para contarte cómo va tu entrenamiento. ${datos} ${lineaCumplimiento(d.atleta)} Por ahora no cambiamos nada: seguimos con tu plan${d.plan?.semanaActual && d.plan.semanasTotales ? ` (semana ${d.plan.semanaActual} de ${d.plan.semanasTotales})` : ''}. Si notas algo raro o tienes dudas, dímelo.`
  }
  m = limpiar(m)
  return m.length <= MAX_MENSAJE ? m : `${m.slice(0, MAX_MENSAJE - 1).replace(/\s+\S*$/, '')}…`
}

export function construirInformeCaso(d: DatosInforme): InformeCaso {
  const escenario = escenarioDe(d)
  const decisiones = d.analisis?.decisiones ?? []

  let cambios: string[]
  if (escenario === 'alerta') cambios = [`Pendiente de hablarlo: ${titularDe(d.analisis?.alerta_prioritaria || d.atleta.alertasAltas[0] || '', 160)}`]
  else if (escenario === 'propuesta_bloque' && d.propuesta) { const r = resumirPropuesta(d.propuesta); cambios = [r.titular, ...r.queCambia] }
  else if (escenario === 'ajustes') cambios = decisiones.slice(0, 3).map(x => glosarSiglas(titularDe(x.cambio, 150)))
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
    ...(d.analisis?.preguntas_al_coach ?? []),
  ].filter((p, i, a) => a.indexOf(p) === i)

  const guion = [
    { paso: 'Abrir', texto: 'Pregúntale cómo se ha sentido estos días: energía, sueño y molestias.' },
    { paso: 'Cómo va', texto: datos.length ? datos.map(x => `${x.etiqueta}: ${x.valor}`).join('. ') + '.' : 'No hay datos recientes del reloj: pregúntale directamente cómo van los entrenos.' },
    { paso: 'Qué cambia', texto: cambios.join(' ') },
    { paso: 'Por qué', texto: porQue.length ? porQue.map(p => `${p.texto} (${p.origen})`).join(' ') : 'Explícale que mantener el plan es lo que dicen sus datos.' },
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
    mensaje: mensajeDe(d, escenario, cambios),
    guion,
    preguntas,
  }
}

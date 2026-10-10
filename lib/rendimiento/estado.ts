// lib/rendimiento/estado.ts
// Foto del atleta que consume el motor de reglas: solo números ya calculados, sin texto libre ni IA.
import type { PanelRendimiento } from './panel'
import type { ResumenCarga } from './pmc'
import type { ResumenIntensidad } from './intensidad'
import type { AlertaRendimiento } from './alertas'
import type { EjecucionSesion } from './ejecucion'
import { deporteDe } from './deportes'
import { ritmosDesdeVdot, type Ritmos } from '@/lib/entrenos/ritmos'

export interface EstadoAtleta {
  hoy: string
  /** Carreras con datos de pulso en las últimas 6 semanas: por debajo de este mínimo no se proponen cambios. */
  carreras6sem: number
  fcUmbral: number | null
  vdot: number | null
  ritmos: Ritmos | null
  carga: ResumenCarga | null
  intensidad: ResumenIntensidad
  intensidadPrevia: ResumenIntensidad
  limitesFc: { suaveHasta: number; mediaHasta: number } | null
  deriva: { media: number | null; n: number }
  eficiencia: { ultimas3: number | null; previas3: number | null }
  /** Sesiones de fuerza registradas por el reloj en las últimas 4 semanas. */
  fuerza28d: number
  /** Sesiones del plan activo que son de fuerza o híbridas. */
  fuerzaEnPlan: number
  /** Carreras por semana (media de las últimas 4 semanas completas) y km por semana. */
  carrerasPorSemana: number
  kmPorSemana: number
  /** Minutos de carrera por semana (media de las últimas 4 semanas completas). */
  minutosCarreraPorSemana: number
  /** Repeticiones de series/tempo de las últimas 4 semanas: cuántas salieron más lentas que el rango previsto. */
  ejecucion: { repsEvaluadas: number; repsLentas: number; sesionesEvaluadas: number; sesionesSaltadas: number }
  diasCompeticion: number | null
  /** Próxima competición: la disciplina y el tiempo objetivo deciden la duración y la profundidad del tapering. */
  competicion: { dias: number; disciplina: string; tiempoObjetivoMin: number | null } | null
  /** Requisitos del atleta: lo que el motor debe respetar antes de proponer. */
  perfil: PerfilAtleta
  /** Vuelve de un parón: 2+ semanas seguidas sin correr y menos de 4 semanas de actividad desde entonces. */
  retorno: boolean
  /** Semanas completas que duró ese parón (0 si no hay retorno). */
  semanasParon: number
  /** Salida más larga de las últimas 4 semanas y lo que pesa sobre el volumen semanal medio. */
  tiradaLarga: { minutos: number; pctSemana: number } | null
  /** Semanas completas seguidas sin una semana de descarga (carga ≤75 % de la media de las 3 anteriores); null si hay pocos datos. */
  semanasSinDescarga: number | null
  /** El plan activo está en una semana o bloque de descarga. */
  enDescarga: boolean
  /** Para contrastar con los entrenadores: % del tiempo por debajo del techo fácil de Daniels (≤79 % del pulso máximo). */
  suaveDaniels: { techo: number; pct: number } | null
  alertas: string[]
}

export interface PerfilAtleta {
  nivel: string | null
  diasDisponibles: number | null
  /** Lesiones previas o activas declaradas en el perfil. */
  lesiones: string[]
  restricciones: string | null
  recuperacion: string | null
}

export interface EntradaEstado {
  hoy: string
  panel: PanelRendimiento
  fcUmbral: number | null
  vdot: number | null
  diasCompeticion: number | null
  competicion?: { dias: number; disciplina: string; tiempoObjetivoMin: number | null } | null
  perfil?: Partial<PerfilAtleta>
  ejecucion: EjecucionSesion[]
  nombresSesionesPlan: string[]
  alertas: AlertaRendimiento[]
}

/** Ventana (días) de las carreras que cuentan para la deriva y para la eficiencia aeróbica. */
export const VENTANA_DERIVA_DIAS = 42
export const VENTANA_EFICIENCIA_DIAS = 56

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)
const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000)

/** Semanas del último parón (2 o más seguidas sin correr) si el atleta ha vuelto hace menos de 4 semanas; 0 si no hay retorno. */
export function semanasDeParon(semanasConSesiones: number[]): number {
  const s = semanasConSesiones
  let fin = -1
  for (let i = 0; i < s.length - 1; i++) if (s[i] === 0 && s[i + 1] === 0) fin = i + 1
  if (fin < 0) return 0
  while (fin + 1 < s.length && s[fin + 1] === 0) fin++
  let ini = fin
  while (ini - 1 >= 0 && s[ini - 1] === 0) ini--
  const desde = s.slice(fin + 1)
  return desde.some(n => n > 0) && desde.length < 4 ? fin - ini + 1 : 0
}

/** Semanas completas: 2 o más seguidas sin correr y menos de 4 con actividad desde entonces. */
export function vuelveDeParon(semanasConSesiones: number[]): boolean {
  return semanasDeParon(semanasConSesiones) > 0
}

/**
 * Semanas completas seguidas, hasta hoy, sin una semana de descarga (carga ≤75 % de la media de las 3 anteriores).
 * Una semana vacía también corta la racha. Devuelve null si hay menos de 4 semanas con actividad que comparar.
 */
export function semanasSeguidasSinDescarga(tss: number[], sesiones: number[]): number | null {
  if (tss.length < 4 || tss.filter((_, i) => sesiones[i] > 0).length < 4) return null
  let racha = 0
  for (let i = tss.length - 1; i >= 0; i--) {
    const previas = tss.slice(Math.max(0, i - 3), i)
    const media = previas.length ? previas.reduce((a, b) => a + b, 0) / previas.length : 0
    const descarga = sesiones[i] === 0 || (media > 0 && tss[i] <= 0.75 * media)
    if (descarga && i > 0) break
    racha++
  }
  return racha
}

export function construirEstado(e: EntradaEstado): EstadoAtleta {
  const { panel, hoy } = e
  const running = panel.deportes.find(d => d.deporte === 'running')
  const fuerza = panel.deportes.find(d => d.deporte === 'fuerza')

  const carreras6sem = (running?.entrenos ?? []).filter(x => diasEntre(x.fecha, hoy) <= 42 && x.fc_media).length
  const fuerza28d = (fuerza?.entrenos ?? []).filter(x => diasEntre(x.fecha, hoy) <= 28 && deporteDe(x.tipo) === 'fuerza').length

  // Últimas 4 semanas completas (la última de panel.semanas puede estar en curso).
  const completas = panel.semanas.length > 1 ? panel.semanas.slice(0, -1) : panel.semanas
  // Últimas 8 semanas completas de carrera (la semana en curso no cuenta).
  const ult8 = running?.semanas.length ? running.semanas.slice(-9, -1) : []
  const ult4 = running?.semanas.length ? running.semanas.slice(-5, -1) : completas.slice(-4)
  const carrerasPorSemana = ult4.length ? Math.round((ult4.reduce((a, s) => a + s.sesiones, 0) / ult4.length) * 10) / 10 : 0
  const longitudes = (running?.entrenos ?? []).filter(x => diasEntre(x.fecha, hoy) <= 28 && x.duracion_s).map(x => x.duracion_s! / 60)
  const masLarga = longitudes.length ? Math.round(Math.max(...longitudes)) : null
  const minutosCarreraPorSemana = ult4.length ? Math.round(ult4.reduce((a, s) => a + s.minutos, 0) / ult4.length) : 0
  const kmPorSemana = ult4.length ? Math.round((ult4.reduce((a, s) => a + s.km, 0) / ult4.length) * 10) / 10 : 0

  // Solo datos recientes: una deriva o una eficiencia de hace meses no describe al atleta de hoy.
  const derivas = panel.deriva.filter(d => diasEntre(d.fecha, hoy) <= VENTANA_DERIVA_DIAS).slice(-5).map(d => d.derivaPct)
  const ef = panel.eficiencia.filter(p => diasEntre(p.fecha, hoy) <= VENTANA_EFICIENCIA_DIAS).map(p => p.valor)

  const ejec = e.ejecucion.filter(s => diasEntre(s.fechaPrevista, hoy) <= 28)
  let repsEvaluadas = 0
  let repsLentas = 0
  for (const s of ejec) for (const r of s.cumplimiento?.reps ?? []) if (r.estado !== 'sin_objetivo') { repsEvaluadas++; if (r.estado === 'lenta') repsLentas++ }

  return {
    hoy,
    carreras6sem,
    fcUmbral: e.fcUmbral,
    vdot: e.vdot,
    ritmos: e.vdot ? ritmosDesdeVdot(e.vdot) : null,
    carga: panel.resumen,
    intensidad: panel.intensidad.reciente,
    intensidadPrevia: panel.intensidad.previo,
    limitesFc: panel.intensidad.limites,
    deriva: { media: media(derivas), n: derivas.length },
    eficiencia: { ultimas3: ef.length >= 6 ? media(ef.slice(-3)) : null, previas3: ef.length >= 6 ? media(ef.slice(-6, -3)) : null },
    fuerza28d,
    fuerzaEnPlan: e.nombresSesionesPlan.filter(n => /fuerza|h[ií]brid|gym|gimnasio/i.test(n)).length,
    carrerasPorSemana,
    kmPorSemana,
    minutosCarreraPorSemana,
    ejecucion: { repsEvaluadas, repsLentas, sesionesEvaluadas: ejec.filter(s => s.cumplimiento).length, sesionesSaltadas: ejec.filter(s => s.estado === 'saltada').length },
    diasCompeticion: e.diasCompeticion,
    competicion: e.competicion ?? null,
    perfil: { nivel: e.perfil?.nivel ?? null, diasDisponibles: e.perfil?.diasDisponibles ?? null, lesiones: e.perfil?.lesiones ?? [], restricciones: e.perfil?.restricciones?.trim() || null, recuperacion: e.perfil?.recuperacion ?? null },
    retorno: vuelveDeParon(ult8.map(s => s.sesiones)),
    semanasParon: semanasDeParon(ult8.map(s => s.sesiones)),
    tiradaLarga: masLarga !== null && minutosCarreraPorSemana > 0 ? { minutos: masLarga, pctSemana: Math.round((masLarga / minutosCarreraPorSemana) * 100) } : null,
    semanasSinDescarga: semanasSeguidasSinDescarga(completas.slice(-8).map(s => s.tss), completas.slice(-8).map(s => s.sesiones)),
    enDescarga: e.nombresSesionesPlan.some(n => /descarga|deload/i.test(n)),
    suaveDaniels: panel.intensidad.suaveDaniels ?? null,
    alertas: e.alertas.map(a => a.codigo),
  }
}

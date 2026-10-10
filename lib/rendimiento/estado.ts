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
  /** Repeticiones de series/tempo de las últimas 4 semanas: cuántas salieron más lentas que el rango previsto. */
  ejecucion: { repsEvaluadas: number; repsLentas: number; sesionesEvaluadas: number; sesionesSaltadas: number }
  diasCompeticion: number | null
  /** Próxima competición: la disciplina y el tiempo objetivo deciden la duración y la profundidad del tapering. */
  competicion: { dias: number; disciplina: string; tiempoObjetivoMin: number | null } | null
  /** Requisitos del atleta: lo que el motor debe respetar antes de proponer. */
  perfil: PerfilAtleta
  /** Vuelve de un parón: 2+ semanas seguidas sin correr y menos de 4 semanas de actividad desde entonces. */
  retorno: boolean
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

/** Semanas completas: 2 o más seguidas sin correr y menos de 4 con actividad desde entonces. */
export function vuelveDeParon(semanasConSesiones: number[]): boolean {
  const s = semanasConSesiones
  let fin = -1
  for (let i = 0; i < s.length - 1; i++) if (s[i] === 0 && s[i + 1] === 0) fin = i + 1
  if (fin < 0) return false
  while (fin + 1 < s.length && s[fin + 1] === 0) fin++
  const desde = s.slice(fin + 1)
  return desde.some(n => n > 0) && desde.length < 4
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
    ejecucion: { repsEvaluadas, repsLentas, sesionesEvaluadas: ejec.filter(s => s.cumplimiento).length, sesionesSaltadas: ejec.filter(s => s.estado === 'saltada').length },
    diasCompeticion: e.diasCompeticion,
    competicion: e.competicion ?? null,
    perfil: { nivel: e.perfil?.nivel ?? null, diasDisponibles: e.perfil?.diasDisponibles ?? null, lesiones: e.perfil?.lesiones ?? [], restricciones: e.perfil?.restricciones?.trim() || null, recuperacion: e.perfil?.recuperacion ?? null },
    retorno: vuelveDeParon(ult8.map(s => s.sesiones)),
    alertas: e.alertas.map(a => a.codigo),
  }
}

// lib/entrenos/objetivos-anuales.ts
// Objetivos del año (carreras confirmadas o posibles, con prioridad A/B/C) → fase de cada semana y fase del siguiente bloque.
// Criterio de entrenador (no cifras de un estudio): se planifica hacia atrás desde cada objetivo A/B: afinado → resistencia → fuerza → base,
// con recuperación tras la prueba. Las C son hitos: no cambian la periodización. Una prueba «posible» planifica igual que una confirmada
// (el atleta quiere estar listo para esas fechas, la haga o no) pero no toca la dieta.
import { diasTaper } from '@/lib/nutricion/competicion'
import { lunesDe, sumarDias, diferenciaDias } from './calendario-ajustes'

export type PrioridadObjetivo = 'A' | 'B' | 'C'
export type EstadoObjetivo = 'confirmada' | 'posible'
export interface ObjetivoAnual { nombre: string; fecha: string; prioridad: PrioridadObjetivo; estado: EstadoObjetivo; disciplina?: string | null }
export type FaseAnual = 'base' | 'fuerza' | 'resistencia' | 'afinado' | 'carrera' | 'recuperacion' | 'mantenimiento'
export interface TramoAnual { desde: string; hasta: string; fase: FaseAnual; semanas: number; objetivo: string | null }

/** Semanas de cada fase hacia un objetivo según su prioridad (A = pico completo, B = mini-pico). */
const SEMANAS: Record<'A' | 'B', { resistencia: number; fuerza: number; recuperacion: number }> = {
  A: { resistencia: 6, fuerza: 6, recuperacion: 2 },
  B: { resistencia: 3, fuerza: 3, recuperacion: 1 },
}
/** Más allá de estas semanas de un objetivo, el atleta está en mantenimiento (forma general), no en preparación específica. */
const SEMANAS_BASE_MAX = 26

export const normalizarPrioridad = (x: unknown): PrioridadObjetivo => (x === 'B' || x === 'C' ? x : 'A')
export const normalizarEstado = (x: unknown): EstadoObjetivo => (x === 'posible' ? 'posible' : 'confirmada')

/** Objetivo que manda en la planificación: el próximo A o B (confirmado o posible). Las C no. */
export function objetivoPrincipal(objetivos: ObjetivoAnual[], hoy: string): ObjetivoAnual | null {
  return [...objetivos].filter(o => o.prioridad !== 'C' && o.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null
}

function faseSemana(lunes: string, objetivos: ObjetivoAnual[]): { fase: FaseAnual; objetivo: string | null } {
  const orden = objetivos.filter(o => o.prioridad !== 'C').sort((a, b) => a.fecha.localeCompare(b.fecha))
  // ¿Estamos en la recuperación de una prueba reciente?
  for (const o of orden) {
    const semanasDesde = Math.floor(diferenciaDias(lunesDe(o.fecha), lunes) / 7)
    if (semanasDesde >= 1 && semanasDesde <= SEMANAS[o.prioridad as 'A' | 'B'].recuperacion) return { fase: 'recuperacion', objetivo: o.nombre }
  }
  const siguiente = orden.find(o => lunesDe(o.fecha) >= lunes)
  if (!siguiente) return { fase: 'mantenimiento', objetivo: null }
  const semanasHasta = Math.floor(diferenciaDias(lunes, lunesDe(siguiente.fecha)) / 7)
  const cfg = SEMANAS[siguiente.prioridad as 'A' | 'B']
  const taper = siguiente.prioridad === 'A' ? Math.max(1, Math.ceil(diasTaper(siguiente.disciplina ?? '') / 7)) : 1
  if (semanasHasta === 0) return { fase: 'carrera', objetivo: siguiente.nombre }
  if (semanasHasta <= taper) return { fase: 'afinado', objetivo: siguiente.nombre }
  if (semanasHasta <= taper + cfg.resistencia) return { fase: 'resistencia', objetivo: siguiente.nombre }
  if (semanasHasta <= taper + cfg.resistencia + cfg.fuerza) return { fase: 'fuerza', objetivo: siguiente.nombre }
  if (semanasHasta <= SEMANAS_BASE_MAX) return { fase: 'base', objetivo: siguiente.nombre }
  return { fase: 'mantenimiento', objetivo: siguiente.nombre }
}

/** Fase de cada semana desde la de `hoy`, agrupadas en tramos. */
export function planificarAnio(objetivos: ObjetivoAnual[], hoy: string, semanas = 52): TramoAnual[] {
  const tramos: TramoAnual[] = []
  for (let i = 0; i < semanas; i++) {
    const lunes = sumarDias(lunesDe(hoy), i * 7)
    const { fase, objetivo } = faseSemana(lunes, objetivos)
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.fase === fase && ultimo.objetivo === objetivo) { ultimo.hasta = sumarDias(lunes, 6); ultimo.semanas++ }
    else tramos.push({ desde: lunes, hasta: sumarDias(lunes, 6), fase, semanas: 1, objetivo })
  }
  return tramos
}

export type FaseBloque = 'Base' | 'Fuerza' | 'Resistencia' | 'Deload'
const FASE_BLOQUE: Record<FaseAnual, FaseBloque> = {
  base: 'Base', mantenimiento: 'Base', fuerza: 'Fuerza', resistencia: 'Resistencia', afinado: 'Deload', carrera: 'Deload', recuperacion: 'Deload',
}
/** Fase del bloque híbrido (Base/Fuerza/Resistencia/Deload) que toca para una fecha según los objetivos del año; null si no hay ningún objetivo A/B. */
export function faseDeBloqueSegunObjetivos(objetivos: ObjetivoAnual[], fecha: string): FaseBloque | null {
  if (!objetivos.some(o => o.prioridad !== 'C')) return null
  return FASE_BLOQUE[faseSemana(lunesDe(fecha), objetivos).fase]
}

export function textoObjetivos(objetivos: ObjetivoAnual[], hoy: string): string {
  const prox = [...objetivos].filter(o => o.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (!prox.length) return ''
  const lineas = prox.map(o => `- ${o.fecha} · ${o.nombre} · prioridad ${o.prioridad} · ${o.estado === 'posible' ? 'POSIBLE (se prepara igual por si se hace)' : 'confirmada'}`)
  const tramos = planificarAnio(objetivos, hoy, 26).slice(0, 6).map(t => `${t.fase} ${t.semanas} sem${t.objetivo ? ` → ${t.objetivo}` : ''}`).join(' · ')
  return `\n## OBJETIVOS DEL AÑO (el plan debe llevar al atleta en forma a esas fechas)\n${lineas.join('\n')}\n- Fases previstas desde hoy: ${tramos}.\n`
}

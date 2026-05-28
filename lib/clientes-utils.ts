// lib/clientes-utils.ts
import type React from 'react'

export type TipoMembresia = 'trimestral' | 'semestral' | 'anual'
export type Filtro = 'todos' | 'atencion' | 'nuevos' | 'riesgo' | 'sin_checkin' | 'activos'
export type FiltroAlta = 'mes' | 'trimestre' | null
export type SortKey = 'checkin' | 'nombre' | 'membresia_caduca' | 'score_adherencia' | 'deuda_atencion'

export type ClienteRow = {
  id: string
  activo: boolean
  objetivo?: string
  nivel?: string
  peso_inicial?: number | null
  fecha_proxima_revision?: string | null
  revisado_por_coach?: boolean | null
  tipo_membresia?: TipoMembresia | null
  fecha_inicio_membresia?: string | null
  fecha_fin_membresia?: string | null
  profile?: { nombre?: string; apellidos?: string; email?: string }
  // computed from parallel queries
  dias_sin_checkin?: number
  ultimo_checkin?: string | null
  tareas_ia_pendientes?: number
  tiene_dieta_activa?: boolean
  tiene_entreno_activo?: boolean
  chats_sin_leer?: number
  comidas_hecha_7d?: number
  sesiones_completadas_7d?: number
  tiene_peso_7d?: boolean
  interacciones_coach_7d?: number
  // computed from util functions
  score_adherencia?: number
  es_predictor_baja?: boolean
  deuda_atencion?: number
}

export type ToolbarCounts = {
  total: number
  atencion: number
  nuevos: number
  riesgo: number
  sin_checkin: number
  activos: number
  caduca_pronto: number
  chats_sin_leer: number
  revisiones_proximas: number
}

export function nombreCliente(c: ClienteRow): string {
  return [c.profile?.nombre, c.profile?.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
}

export function diasHastaCaducidad(c: ClienteRow): number | null {
  if (!c.fecha_fin_membresia) return null
  return Math.floor((new Date(c.fecha_fin_membresia).getTime() - Date.now()) / 86_400_000)
}

export function calcularScoreAdherencia(c: ClienteRow): number {
  const dias = c.dias_sin_checkin ?? 999
  const checkInScore = dias <= 4 ? 100 : Math.max(0, 100 - ((dias - 4) / 10) * 100)
  const comidasScore = Math.min(100, ((c.comidas_hecha_7d ?? 0) / 21) * 100)
  const entrenoScore = Math.min(100, ((c.sesiones_completadas_7d ?? 0) / 3) * 100)
  const pesoScore = c.tiene_peso_7d ? 100 : 0
  return Math.round(checkInScore * 0.4 + comidasScore * 0.3 + entrenoScore * 0.2 + pesoScore * 0.1)
}

export function esPredictorBaja(c: ClienteRow): boolean {
  const cad = diasHastaCaducidad(c)
  const señales = [
    (c.score_adherencia ?? 100) < 40,
    cad !== null && cad <= 30,
    (c.chats_sin_leer ?? 0) > 0 && (c.interacciones_coach_7d ?? 0) === 0,
    (c.dias_sin_checkin ?? 0) > 10,
  ]
  return señales.filter(Boolean).length >= 2
}

export function calcularDeudaAtencion(c: ClienteRow): number {
  const urgencia =
    (c.dias_sin_checkin ?? 0) * 2 +
    (c.tareas_ia_pendientes ?? 0) * 3 +
    (c.chats_sin_leer ?? 0) * 2
  return urgencia / Math.max(c.interacciones_coach_7d ?? 0, 1)
}

export type EstadoTone = 'danger' | 'warning' | 'success' | 'muted' | 'info'
export type EstadoCliente = { label: string; tone: EstadoTone }

export function getEstadoCliente(c: ClienteRow): EstadoCliente {
  if (c.revisado_por_coach === false) return { label: 'Revisar plan', tone: 'info' }
  if ((c.tareas_ia_pendientes ?? 0) > 0) return { label: 'IA pendiente', tone: 'warning' }
  if ((c.dias_sin_checkin ?? 0) > 10) return { label: 'Riesgo', tone: 'danger' }
  if ((c.dias_sin_checkin ?? 0) > 4) return { label: 'Sin check-in', tone: 'warning' }
  if (c.activo) return { label: 'Activo', tone: 'success' }
  return { label: 'Inactivo', tone: 'muted' }
}

export function estadoStyle(tone: EstadoTone): React.CSSProperties {
  if (tone === 'danger') return { background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.24)' }
  if (tone === 'warning') return { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(201,169,110,0.24)' }
  if (tone === 'success') return { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(48,209,88,0.2)' }
  if (tone === 'info') return { background: 'rgba(129,140,248,0.1)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }
  return { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

export function scoreColor(score: number): string {
  if (score >= 70) return 'var(--success)'
  if (score >= 40) return 'var(--warning)'
  return 'var(--error)'
}

export function checkinColor(dias: number): string {
  if (dias <= 4) return 'var(--success)'
  if (dias <= 10) return 'var(--warning)'
  return 'var(--error)'
}

export function aplicarFiltros(
  clientes: ClienteRow[],
  filtro: Filtro,
  busqueda: string,
  caducaPronte: boolean,
  filtroAlta: FiltroAlta,
  filtroRevisiones: boolean,
  filtroChats: boolean,
): ClienteRow[] {
  const q = busqueda.toLowerCase()
  const hoy = Date.now()

  return clientes.filter(c => {
    // búsqueda
    const texto = `${c.profile?.nombre ?? ''} ${c.profile?.apellidos ?? ''} ${c.profile?.email ?? ''}`.toLowerCase()
    if (q && !texto.includes(q)) return false

    // filtro estado (exclusivo)
    if (filtro === 'atencion' && !(c.revisado_por_coach === false || (c.tareas_ia_pendientes ?? 0) > 0 || (c.dias_sin_checkin ?? 0) > 4)) return false
    if (filtro === 'nuevos' && c.revisado_por_coach !== false) return false
    if (filtro === 'riesgo' && (c.dias_sin_checkin ?? 0) <= 10) return false
    if (filtro === 'sin_checkin' && (c.dias_sin_checkin ?? 0) <= 4) return false
    if (filtro === 'activos' && !c.activo) return false

    // filtros adicionales (acumulativos)
    if (caducaPronte) {
      const d = diasHastaCaducidad(c)
      if (d === null || d > 30) return false
    }
    if (filtroAlta === 'mes') {
      if (!c.fecha_inicio_membresia) return false
      const inicio = new Date(c.fecha_inicio_membresia).getTime()
      if (hoy - inicio > 30 * 86_400_000) return false
    }
    if (filtroAlta === 'trimestre') {
      if (!c.fecha_inicio_membresia) return false
      const inicio = new Date(c.fecha_inicio_membresia).getTime()
      if (hoy - inicio > 90 * 86_400_000) return false
    }
    if (filtroRevisiones) {
      if (!c.fecha_proxima_revision) return false
      const dias = Math.floor((new Date(c.fecha_proxima_revision).getTime() - hoy) / 86_400_000)
      if (dias < 0 || dias > 14) return false
    }
    if (filtroChats && (c.chats_sin_leer ?? 0) === 0) return false

    return true
  })
}

export function aplicarSort(clientes: ClienteRow[], sort: SortKey): ClienteRow[] {
  return [...clientes].sort((a, b) => {
    if (sort === 'nombre') return nombreCliente(a).localeCompare(nombreCliente(b))
    if (sort === 'membresia_caduca') {
      const da = diasHastaCaducidad(a) ?? 9999
      const db = diasHastaCaducidad(b) ?? 9999
      return da - db
    }
    if (sort === 'score_adherencia') return (a.score_adherencia ?? 0) - (b.score_adherencia ?? 0)
    if (sort === 'deuda_atencion') return (b.deuda_atencion ?? 0) - (a.deuda_atencion ?? 0)
    // checkin (default)
    return (b.dias_sin_checkin ?? 0) - (a.dias_sin_checkin ?? 0)
  })
}

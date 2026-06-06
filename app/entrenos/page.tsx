'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  CheckCircle,
  Barbell,
  Lightning,
  MagnifyingGlass,
  SealWarning,
  Target,
  Trophy,
  UserFocus,
  Warning,
} from '@phosphor-icons/react'
import type { CommandCenterRow, CommandCenterEstado, CommandCenterTono } from '@/lib/training/command-center'
import TrainingRoomPanel from '@/components/training/TrainingRoomPanel'
import { useCachedFetch } from '@/lib/useCachedFetch'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const HOY_IDX = (new Date().getDay() + 6) % 7

interface CommandCenterStats {
  total: number
  requiere_accion: number
  fatiga: number
  revision_ia: number
  progreso: number
  sin_actividad: number
}

const DEFAULT_STATS: CommandCenterStats = {
  total: 0,
  requiere_accion: 0,
  fatiga: 0,
  revision_ia: 0,
  progreso: 0,
  sin_actividad: 0,
}

function diasDesde(fecha: string | null): string {
  if (!fecha) return 'Sin registro'
  const base = new Date(`${fecha}T12:00:00`)
  const diff = Math.floor((Date.now() - base.getTime()) / 86_400_000)
  if (diff <= 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff <= 30) return `Hace ${diff}d`
  return '+30d'
}

function estadoConfig(estado: CommandCenterEstado, tono: CommandCenterTono) {
  if (estado === 'fatiga') {
    return {
      label: 'Riesgo de carga',
      short: 'Riesgo',
      icon: Warning,
      bg: 'var(--semantic-alert-bg)',
      color: 'var(--semantic-alert)',
      border: 'var(--semantic-alert-border)',
    }
  }
  if (estado === 'revision_ia') {
    return {
      label: 'IA pendiente',
      short: 'IA',
      icon: Brain,
      bg: 'var(--semantic-warn-bg)',
      color: 'var(--semantic-warn)',
      border: 'var(--semantic-warn-border)',
    }
  }
  if (estado === 'sin_actividad') {
    return {
      label: 'Reactivar cliente',
      short: 'Reactivar',
      icon: SealWarning,
      bg: 'var(--semantic-warn-bg)',
      color: 'var(--semantic-warn)',
      border: 'var(--semantic-warn-border)',
    }
  }
  if (estado === 'progreso') {
    return {
      label: 'Progreso detectado',
      short: 'Progreso',
      icon: Trophy,
      bg: 'var(--semantic-active-bg)',
      color: 'var(--semantic-active)',
      border: 'var(--semantic-active-border)',
    }
  }
  return {
    label: tono === 'ok' ? 'OK' : 'Estable',
    short: 'Estable',
    icon: CheckCircle,
    bg: 'var(--semantic-info-bg)',
    color: 'var(--semantic-info)',
    border: 'var(--semantic-info-border)',
  }
}

function initials(c: CommandCenterRow) {
  return `${c.nombre?.[0] ?? ''}${c.apellidos?.[0] ?? ''}`.toUpperCase() || 'NC'
}

function adherenceLabel(value: number | null) {
  if (value === null) return 'Sin objetivo'
  return `${value}%`
}

function clampPct(value: number | null, fallback = 0) {
  if (value === null) return fallback
  return Math.max(0, Math.min(100, value))
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        ))}
      </div>
      <div className="min-h-[540px] animate-pulse rounded-[28px] border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-36 animate-pulse rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  )
}

export default function EntrenosPage() {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | CommandCenterEstado | 'accion'>('todos')
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null)

  const fetchCommandCenter = useCallback(async () => {
    const res = await fetch('/api/entrenos/command-center')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error cargando Training Workspace')
    return {
      clientes: data.clientes ?? [],
      stats: data.stats ?? DEFAULT_STATS,
    } as { clientes: CommandCenterRow[]; stats: CommandCenterStats }
  }, [])

  const { data, loading, error } = useCachedFetch('entrenos-command-center', fetchCommandCenter, { ttl: 20_000 })
  const clientes = useMemo(() => data?.clientes ?? [], [data])
  const stats = data?.stats ?? DEFAULT_STATS

  const filtrados = useMemo(() => {
    return clientes.filter(c => {
      const q = busqueda.toLowerCase()
      const matchesSearch = `${c.nombre} ${c.apellidos} ${c.plan_nombre} ${c.accion_principal} ${c.razon}`
        .toLowerCase()
        .includes(q)
      if (!matchesSearch) return false
      if (filtro === 'todos') return true
      if (filtro === 'accion') return c.requiere_accion
      return c.estado === filtro
    })
  }, [clientes, busqueda, filtro])

  const seleccionado = useMemo(() => {
    return filtrados.find(c => c.cliente_id === selectedClienteId) ?? filtrados[0] ?? null
  }, [filtrados, selectedClienteId])

  const estadoSeleccionado = seleccionado ? estadoConfig(seleccionado.estado, seleccionado.tono) : null
  const EstadoIcon = estadoSeleccionado?.icon ?? CheckCircle
  const iaPendiente = (seleccionado?.tareas_pendientes.length ?? 0) > 0

  return (
    <div className="px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1320px] space-y-5">
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatButton label="Planes activos" value={stats.total} active={filtro === 'todos'} onClick={() => setFiltro('todos')} />
          <StatButton label="Acción hoy" value={stats.requiere_accion} tone="warn" active={filtro === 'accion'} onClick={() => setFiltro('accion')} />
          <StatButton label="Fatiga" value={stats.fatiga} tone="alert" active={filtro === 'fatiga'} onClick={() => setFiltro('fatiga')} />
          <StatButton label="IA pendiente" value={stats.revision_ia} tone="warn" active={filtro === 'revision_ia'} onClick={() => setFiltro('revision_ia')} />
          <StatButton label="Progreso" value={stats.progreso} tone="ok" active={filtro === 'progreso'} onClick={() => setFiltro('progreso')} />
        </section>

        <section
          className="rounded-[28px] border p-3 sm:p-4"
          style={{
            borderColor: 'var(--border)',
            background: 'linear-gradient(135deg, var(--surface), var(--bg-subtle))',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
                Operate cockpit
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: 'var(--text)' }}>
                Prioridad real del coach
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Clientes ordenados por riesgo, IA pendiente, adherencia, carga y progreso. El objetivo no es mirar listas, es decidir la siguiente acción.
              </p>
            </div>
            <div className="relative">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                className="input search-input w-full"
                placeholder="Buscar cliente, plan o acción"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ['todos', 'Todos'],
              ['accion', 'Acción'],
              ['fatiga', 'Fatiga'],
              ['revision_ia', 'IA'],
              ['sin_actividad', 'Reactivar'],
              ['progreso', 'Progreso'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFiltro(value as typeof filtro)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-transform active:scale-[0.98]"
                style={{
                  background: filtro === value ? 'var(--text)' : 'var(--bg)',
                  color: filtro === value ? 'var(--bg)' : 'var(--text-secondary)',
                  border: `1px solid ${filtro === value ? 'var(--text)' : 'var(--border)'}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : error ? (
            <div className="rounded-3xl px-6 py-10" style={{ background: 'var(--semantic-alert-bg)', border: '1px solid var(--semantic-alert-border)' }}>
              <p className="font-semibold" style={{ color: 'var(--semantic-alert)' }}>No se ha podido cargar Training Workspace</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="rounded-3xl px-6 py-16 text-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>No hay clientes en esta vista</p>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Cambia el filtro, ajusta la búsqueda o crea un plan activo para empezar a priorizar acciones.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
              <aside className="space-y-2 xl:max-h-[680px] xl:overflow-y-auto xl:pr-1">
                {filtrados.map((c, i) => (
                  <PriorityClientButton
                    key={c.plan_id}
                    cliente={c}
                    index={i}
                    selected={seleccionado?.cliente_id === c.cliente_id}
                    onClick={() => setSelectedClienteId(c.cliente_id)}
                  />
                ))}
              </aside>

              {seleccionado && estadoSeleccionado && (
                <article
                  className="min-h-[560px] rounded-[28px] border p-4 sm:p-5"
                  style={{ borderColor: estadoSeleccionado.border, background: 'var(--bg)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className="flex h-14 w-14 items-center justify-center rounded-2xl border text-sm font-semibold"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
                      >
                        {initials(seleccionado)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                          {seleccionado.nombre} {seleccionado.apellidos}
                        </p>
                        <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {seleccionado.plan_nombre}
                        </p>
                      </div>
                    </div>
                    <div
                      className="inline-flex w-fit items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold"
                      style={{ background: estadoSeleccionado.bg, color: estadoSeleccionado.color, borderColor: estadoSeleccionado.border }}
                    >
                      <EstadoIcon size={17} weight="duotone" />
                      {estadoSeleccionado.label}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Signal label="Adherencia" value={adherenceLabel(seleccionado.adherencia_7d_pct)} pct={clampPct(seleccionado.adherencia_7d_pct)} />
                    <Signal label="Carga" value={String(seleccionado.carga_score)} pct={Math.min(100, Math.round(seleccionado.carga_score / 7))} danger={seleccionado.estado === 'fatiga'} />
                    <Signal label="RPE" value={seleccionado.rpe_media_7d !== null ? seleccionado.rpe_media_7d.toFixed(1) : '--'} pct={Math.round(((seleccionado.rpe_media_7d ?? 0) / 10) * 100)} danger={(seleccionado.rpe_media_7d ?? 0) >= 8.5} />
                    <Signal label="PRs" value={String(seleccionado.pr_count_7d)} pct={Math.min(100, seleccionado.pr_count_7d * 25)} active={seleccionado.pr_count_7d > 0} />
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl border p-2" style={{ borderColor: estadoSeleccionado.border, background: estadoSeleccionado.bg, color: estadoSeleccionado.color }}>
                          <Target size={18} weight="duotone" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                            Siguiente mejor acción
                          </p>
                          <h3 className="mt-1 text-xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
                            {seleccionado.accion_principal}
                          </h3>
                          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {seleccionado.razon}
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
                        Semana actual
                      </p>
                      <div className="mt-4 flex items-end justify-between gap-2">
                        {DIAS.map((d, idx) => (
                          <div key={d} className="flex flex-1 flex-col items-center gap-2">
                            <div
                              className="h-20 w-full rounded-full border"
                              style={{
                                borderColor: idx === HOY_IDX ? 'var(--border-strong)' : 'var(--border)',
                                background: seleccionado.dots[idx]
                                  ? 'linear-gradient(180deg, var(--semantic-active), var(--semantic-active-bg))'
                                  : idx === HOY_IDX
                                    ? 'var(--semantic-info-bg)'
                                    : 'var(--bg)',
                              }}
                            />
                            <span className="text-[10px] font-semibold" style={{ color: idx === HOY_IDX ? 'var(--text)' : 'var(--text-muted)' }}>
                              {d}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>

                  <div className="mt-4">
                    <TrainingRoomPanel cliente={seleccionado} />
                  </div>

                  <section className="mt-4 rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Contexto operativo</p>
                        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {seleccionado.sesiones_7d} sesiones en 7 días · {seleccionado.sesiones_28d} en 28 días · última sesión: {diasDesde(seleccionado.ultima_fecha)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/clientes/${seleccionado.cliente_id}`} className="btn-secondary inline-flex items-center gap-2 text-sm">
                          <UserFocus size={16} /> Cliente
                        </Link>
                        <Link href={`/entrenos/${seleccionado.plan_id}`} className="btn-primary inline-flex items-center gap-2 text-sm">
                          Abrir plan <ArrowRight size={16} />
                        </Link>
                      </div>
                    </div>
                  </section>
                </article>
              )}

              {seleccionado && estadoSeleccionado && (
                <aside className="space-y-3">
                  <ActionCard
                    title="Decisión IA"
                    icon={<Brain size={18} weight="duotone" />}
                    tone={iaPendiente ? 'warn' : 'neutral'}
                    body={iaPendiente
                      ? seleccionado.tareas_pendientes[0]?.propuesta || 'Hay una recomendación pendiente de revisión.'
                      : 'Sin decisiones críticas pendientes. Mantén seguimiento de adherencia y próxima sesión.'}
                    href="/entrenos/brain-ia"
                    cta={iaPendiente ? 'Revisar bandeja' : 'Abrir Brain'}
                  />
                  <ActionCard
                    title="Sesión y carga"
                    icon={<Barbell size={18} weight="duotone" />}
                    tone={seleccionado.estado === 'fatiga' ? 'alert' : 'neutral'}
                    body={seleccionado.estado === 'fatiga'
                      ? 'Revisa intensidad y volumen antes de progresar la siguiente sesión.'
                      : 'Carga semanal dentro de rango operativo. Revisa progresión si el RPE acompaña.'}
                    href={`/entrenos/${seleccionado.plan_id}`}
                    cta="Abrir plan"
                  />
                  <ActionCard
                    title="Comunicación"
                    icon={<Lightning size={18} weight="duotone" />}
                    tone={seleccionado.estado === 'sin_actividad' ? 'warn' : 'neutral'}
                    body={seleccionado.estado === 'sin_actividad'
                      ? 'Prioriza mensaje o ajuste de fricción antes de añadir carga.'
                      : 'Prepara feedback breve si hay PR, fatiga o sesiones completadas.'}
                    href={`/clientes/${seleccionado.cliente_id}`}
                    cta="Abrir cliente"
                  />
                </aside>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function StatButton({ label, value, active, tone = 'neutral', onClick }: {
  label: string
  value: number
  active?: boolean
  tone?: 'neutral' | 'warn' | 'alert' | 'ok'
  onClick: () => void
}) {
  const color = tone === 'alert'
    ? 'var(--semantic-alert)'
    : tone === 'warn'
      ? 'var(--semantic-warn)'
      : tone === 'ok'
        ? 'var(--semantic-active)'
        : 'var(--text)'

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-3xl border px-4 py-3 text-left transition-transform active:scale-[0.98]"
      style={{
        borderColor: active ? 'var(--border-strong)' : 'var(--border)',
        background: active ? 'var(--surface-elevated)' : 'var(--surface)',
      }}
    >
      <p className="font-data text-3xl font-semibold leading-none" style={{ color }}>{value}</p>
      <p className="mt-1 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </button>
  )
}

function PriorityClientButton({ cliente, selected, index, onClick }: {
  cliente: CommandCenterRow
  selected: boolean
  index: number
  onClick: () => void
}) {
  const config = estadoConfig(cliente.estado, cliente.tono)
  const Icon = config.icon

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99]"
      style={{
        animation: `fadeIn 0.2s var(--ease-out-strong) ${Math.min(index, 8) * 30}ms both`,
        borderColor: selected ? config.border : 'var(--border)',
        background: selected ? 'var(--bg)' : 'var(--surface)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-semibold" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
            {initials(cliente)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>
              {cliente.nombre} {cliente.apellidos}
            </p>
            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--text-muted)' }}>{cliente.plan_nombre}</p>
          </div>
        </div>
        <span className="rounded-full border p-1.5" style={{ borderColor: config.border, background: config.bg, color: config.color }}>
          <Icon size={14} weight="duotone" />
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: config.color }}>{config.short}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{cliente.accion_principal}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <MiniMetric label="Adh" value={cliente.adherencia_7d_pct !== null ? `${cliente.adherencia_7d_pct}%` : '--'} />
        <MiniMetric label="RPE" value={cliente.rpe_media_7d !== null ? cliente.rpe_media_7d.toFixed(1) : '--'} />
        <MiniMetric label="IA" value={String(cliente.tareas_pendientes.length)} />
        <MiniMetric label="7d" value={String(cliente.sesiones_7d)} />
      </div>
    </button>
  )
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data text-sm font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

function Signal({ label, value, pct, danger, active }: {
  label: string
  value: string
  pct: number
  danger?: boolean
  active?: boolean
}) {
  const color = danger ? 'var(--semantic-alert)' : active ? 'var(--semantic-active)' : 'var(--text)'

  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data mt-1 text-2xl font-semibold leading-none" style={{ color }}>{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--bg)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function ActionCard({ title, icon, body, href, cta, tone }: {
  title: string
  icon: React.ReactNode
  body: string
  href: string
  cta: string
  tone: 'neutral' | 'warn' | 'alert'
}) {
  const color = tone === 'alert'
    ? 'var(--semantic-alert)'
    : tone === 'warn'
      ? 'var(--semantic-warn)'
      : 'var(--text)'

  return (
    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-2">
        <span className="rounded-xl border p-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)', color }}>
          {icon}
        </span>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color }}>
        {cta} <ArrowRight size={15} />
      </Link>
    </section>
  )
}

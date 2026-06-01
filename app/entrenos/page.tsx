'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Dumbbell,
  Plus,
  Search,
  Trophy,
} from 'lucide-react'
import type { CommandCenterRow, CommandCenterEstado, CommandCenterTono } from '@/lib/training/command-center'

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
      label: 'Fatiga',
      icon: AlertTriangle,
      bg: 'var(--semantic-alert-bg)',
      color: 'var(--semantic-alert)',
      border: 'var(--semantic-alert-border)',
    }
  }
  if (estado === 'revision_ia') {
    return {
      label: 'Revisar IA',
      icon: Brain,
      bg: 'var(--semantic-warning-bg)',
      color: 'var(--semantic-warning)',
      border: 'var(--semantic-warning-border)',
    }
  }
  if (estado === 'sin_actividad') {
    return {
      label: 'Reactivar',
      icon: Activity,
      bg: 'var(--semantic-warning-bg)',
      color: 'var(--semantic-warning)',
      border: 'var(--semantic-warning-border)',
    }
  }
  if (estado === 'progreso') {
    return {
      label: 'Progreso',
      icon: Trophy,
      bg: 'var(--semantic-active-bg)',
      color: 'var(--semantic-active)',
      border: 'var(--semantic-active-border)',
    }
  }
  return {
    label: tono === 'ok' ? 'OK' : 'Estable',
    icon: CheckCircle2,
    bg: 'var(--semantic-info-bg)',
    color: 'var(--semantic-info)',
    border: 'var(--semantic-info-border)',
  }
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div
          key={i}
          className="glass-card p-4"
          style={{ animation: `fadeIn 0.2s var(--ease-out-strong) ${i * 30}ms both` }}
        >
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl animate-pulse" style={{ background: 'var(--border-strong)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 rounded-full animate-pulse" style={{ background: 'var(--border-strong)' }} />
              <div className="h-2.5 w-48 rounded-full animate-pulse" style={{ background: 'var(--border)' }} />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map(n => (
              <div key={n} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EntrenosPage() {
  const [clientes, setClientes] = useState<CommandCenterRow[]>([])
  const [stats, setStats] = useState<CommandCenterStats>({
    total: 0,
    requiere_accion: 0,
    fatiga: 0,
    revision_ia: 0,
    progreso: 0,
    sin_actividad: 0,
  })
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | CommandCenterEstado | 'accion'>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/entrenos/command-center')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error cargando Training OS')
        setClientes(data.clientes ?? [])
        setStats(data.stats ?? stats)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error cargando Training OS')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    return clientes.filter(c => {
      const matchesSearch = `${c.nombre} ${c.apellidos} ${c.plan_nombre} ${c.accion_principal}`
        .toLowerCase()
        .includes(busqueda.toLowerCase())
      if (!matchesSearch) return false
      if (filtro === 'todos') return true
      if (filtro === 'accion') return c.requiere_accion
      return c.estado === filtro
    })
  }, [clientes, busqueda, filtro])

  return (
    <div className="px-4 py-5 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] mb-2" style={{ color: 'var(--text-muted)' }}>
            Training OS 2.0
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-none" style={{ color: 'var(--text)' }}>
            Command Center
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Clientes ordenados por prioridad real: fatiga, IA pendiente, adherencia, PRs y última actividad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/entrenos/brain-ia" className="btn-secondary flex items-center gap-2 text-sm">
            <Brain size={15} /> Inbox IA
          </Link>
          <Link href="/entrenos/nueva" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nuevo plan
          </Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 mb-5">
        {[
          { label: 'Planes activos', value: stats.total, tone: 'neutro' },
          { label: 'Requieren acción', value: stats.requiere_accion, tone: 'atencion' },
          { label: 'Fatiga', value: stats.fatiga, tone: 'critico' },
          { label: 'IA pendiente', value: stats.revision_ia, tone: 'atencion' },
          { label: 'Progreso', value: stats.progreso, tone: 'ok' },
        ].map(item => {
          const color = item.tone === 'critico'
            ? 'var(--semantic-alert)'
            : item.tone === 'atencion'
              ? 'var(--semantic-warning)'
              : item.tone === 'ok'
                ? 'var(--semantic-active)'
                : 'var(--text)'
          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.label === 'Requieren acción') setFiltro('accion')
                else if (item.label === 'Fatiga') setFiltro('fatiga')
                else if (item.label === 'IA pendiente') setFiltro('revision_ia')
                else if (item.label === 'Progreso') setFiltro('progreso')
                else setFiltro('todos')
              }}
              className="rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.98]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <p className="text-2xl font-semibold leading-none" style={{ color }}>{item.value}</p>
              <p className="text-[11px] mt-1 font-medium" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
            </button>
          )
        })}
      </section>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center mb-5">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[
            ['todos', 'Todos'],
            ['accion', 'Acción'],
            ['fatiga', 'Fatiga'],
            ['revision_ia', 'IA'],
            ['sin_actividad', 'Sin actividad'],
            ['progreso', 'Progreso'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFiltro(value as typeof filtro)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all"
              style={{
                background: filtro === value ? 'var(--accent)' : 'var(--surface)',
                color: filtro === value ? 'var(--bg)' : 'var(--text-secondary)',
                border: `1px solid ${filtro === value ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input search-input w-full"
            placeholder="Buscar cliente, plan o acción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="rounded-2xl px-6 py-10" style={{ background: 'var(--semantic-alert-bg)', border: '1px solid var(--semantic-alert-border)' }}>
          <p className="font-semibold" style={{ color: 'var(--semantic-alert)' }}>No se ha podido cargar el Command Center</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl px-6 py-14 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            No hay clientes en esta vista
          </p>
          <p className="text-xs mt-2 max-w-sm mx-auto" style={{ color: 'var(--text-muted)' }}>
            Cambia el filtro, ajusta la búsqueda o crea un plan activo para empezar a priorizar acciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtrados.map((c, i) => {
            const config = estadoConfig(c.estado, c.tono)
            const EstadoIcon = config.icon
            const initials = `${c.nombre[0] ?? ''}${c.apellidos[0] ?? ''}`.toUpperCase()
            const iaPendiente = c.tareas_pendientes.length > 0
            return (
              <article
                key={c.plan_id}
                className="glass-card p-4 transition-all duration-200"
                style={{
                  animation: `fadeIn 0.24s var(--ease-out-strong) ${Math.min(i, 8) * 35}ms both`,
                  borderColor: c.requiere_accion ? config.border : 'var(--border)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-semibold flex-shrink-0"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}
                    >
                      {initials || 'NC'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                        {c.nombre} {c.apellidos}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{c.plan_nombre}</p>
                    </div>
                  </div>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-semibold inline-flex items-center gap-1"
                    style={{ background: config.bg, color: config.color, border: `1px solid ${config.border}` }}
                  >
                    <EstadoIcon size={12} />
                    {config.label}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>
                        Próxima acción
                      </p>
                      <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text)' }}>{c.accion_principal}</p>
                      <p className="mt-1 text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                        {c.razon}
                      </p>
                    </div>
                    <Link
                      href={iaPendiente ? '/entrenos/brain-ia' : `/entrenos/${c.plan_id}`}
                      className="shrink-0 rounded-xl p-2 transition-transform active:scale-[0.96]"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      aria-label="Abrir acción"
                    >
                      {iaPendiente ? <Brain size={16} /> : <ArrowRight size={16} />}
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 my-4">
                  <Metric label="Carga" value={String(c.carga_score)} danger={c.estado === 'fatiga'} />
                  <Metric label="RPE" value={c.rpe_media_7d !== null ? c.rpe_media_7d.toFixed(1) : '--'} danger={(c.rpe_media_7d ?? 0) >= 8.5} />
                  <Metric label="PRs" value={String(c.pr_count_7d)} active={c.pr_count_7d > 0} />
                  <Metric label="IA" value={String(c.tareas_pendientes.length)} warning={iaPendiente} />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center justify-center gap-1">
                    {DIAS.map((d, idx) => (
                      <div key={d} className="flex flex-col items-center gap-0.5">
                        <span className="text-[8px]" style={{ color: 'var(--text-muted)', opacity: idx === HOY_IDX ? 1 : 0.5 }}>{d}</span>
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: c.dots[idx] ? 'var(--semantic-active)' : idx === HOY_IDX ? 'var(--semantic-info-bg)' : 'var(--border)',
                            boxShadow: c.dots[idx] ? '0 0 0 3px var(--semantic-active-bg)' : 'none',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {c.adherencia_7d_pct !== null ? `${c.adherencia_7d_pct}% adherencia` : 'sin objetivo'}
                  </span>
                </div>

                <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <span className="inline-flex items-center gap-1"><Dumbbell size={12} /> {c.sesiones_7d} sesiones / 7d</span>
                  <span className="inline-flex items-center gap-1"><Activity size={12} /> {diasDesde(c.ultima_fecha)}</span>
                  <Link href={`/entrenos/${c.plan_id}`} className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--text)' }}>
                    Plan <ArrowUpRight size={12} />
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Metric({ label, value, danger, active, warning }: {
  label: string
  value: string
  danger?: boolean
  active?: boolean
  warning?: boolean
}) {
  const color = danger
    ? 'var(--semantic-alert)'
    : active
      ? 'var(--semantic-active)'
      : warning
        ? 'var(--semantic-warning)'
        : 'var(--text)'
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="font-data text-2xl leading-none mt-1" style={{ color }}>{value}</p>
    </div>
  )
}

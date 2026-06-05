'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Brain,
  CalendarBlank,
  CheckCircle,
  ClipboardText,
  CreditCard,
  CurrencyEur,
  ForkKnife,
  Lightning,
  ListChecks,
  Pulse,
  Receipt,
  Repeat,
  Trophy,
  UserPlus,
  Users,
  Warning,
} from '@phosphor-icons/react'

type Severity = 'critica' | 'alta' | 'media' | 'baja'
type Tab = 'command' | 'negocio'

type TodayAction = {
  id: string
  tipo: string
  title: string
  cliente_id: string | null
  cliente_nombre: string
  detail: string
  meta: string
  severity: Severity
  href: string
  cta: string
}

type ClienteRiesgo = {
  cliente_id: string
  cliente_nombre: string
  riesgo: 'alto' | 'medio' | 'bajo'
  score: number
  signals: string[]
  accion: string
  href: string
}

type InboxIa = {
  id: string
  tipo: string
  agente: string
  prioridad: number
  propuesta: string | null
  cliente_id: string | null
  cliente_nombre: string
  href: string
  created_at: string
}

type Competicion = {
  id: string
  nombre: string
  disciplina: string | null
  fecha_competicion: string
  dias: number
  estado: 'hoy' | 'race_week' | 'tapering' | 'normal'
  cliente_id: string
  cliente_nombre: string
}

type CommandData = {
  hoy: TodayAction[]
  clientes_riesgo: ClienteRiesgo[]
  inbox_ia: InboxIa[]
  operacion: {
    clientes_activos: number
    planes_nutricion_activos: number
    planes_entreno_activos: number
    checkins_pendientes: number
    revisiones_7d: number
    revisiones_30d: number
    membresias_30d: number
    respuestas_pendientes: number
  }
  competiciones: Competicion[]
  timestamp: string
}

type CosteCliente = {
  cliente_id: string
  nombre: string
  plan_nombre: string | null
  coste_semanal_min: number
  coste_semanal_max: number
  coste_diario: number
  ingredientes_sin_precio: number
  total_ingredientes: number
}

type NegocioData = {
  resumen: {
    ingresos_30d: number
    ingresos_mes_actual: number
    mrr_estimado: number
    transacciones_30d: number
    clientes_membresia_activa: number
    membresias_7d: number
    membresias_30d: number
    clientes_sin_membresia: number
  }
  transacciones_recientes: Array<{
    id: string
    cliente_id: string
    cliente_nombre: string
    importe: number
    fecha: string
    estado: string
    origen: string
    plan_tipo: string | null
    href: string
  }>
  pagos_pendientes: Array<{
    id: string
    cliente_id: string
    cliente_nombre: string
    motivo: string
    severity: 'alta' | 'media'
    importe_estimado: number
    href: string
  }>
  renovaciones: Array<{
    cliente_id: string
    cliente_nombre: string
    tipo_membresia: string | null
    fecha_fin_membresia: string | null
    dias: number | null
    importe_estimado: number
    href: string
  }>
  embudo: {
    nuevos_sin_pago: number
    links_generados: number
    pagos_completados: number
    clientes_activados: number
  }
  timestamp: string
}

const SEVERITY_STYLE: Record<Severity, { label: string; bg: string; color: string }> = {
  critica: { label: 'Crítica', bg: 'var(--error-bg)', color: 'var(--error)' },
  alta: { label: 'Alta', bg: 'rgba(200,169,106,0.12)', color: 'var(--warning)' },
  media: { label: 'Media', bg: 'var(--info-bg)', color: 'var(--info)' },
  baja: { label: 'Baja', bg: 'var(--success-bg)', color: 'var(--success)' },
}

const DASHBOARD_MUTED = 'color-mix(in srgb, var(--text) 52%, transparent)'
const DASHBOARD_SECONDARY = 'color-mix(in srgb, var(--text) 72%, transparent)'

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error ?? `Error ${res.status}`)
  }
  return data as T
}

function formatEuro(value: number) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string | null | undefined) {
  if (!date) return 'Sin fecha'
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-14 rounded-xl skeleton" />
      ))}
    </div>
  )
}

function SeverityChip({ severity }: { severity: Severity }) {
  const style = SEVERITY_STYLE[severity]
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

function SectionHeader({
  icon: Icon,
  title,
  meta,
  href,
}: {
  icon: React.ElementType
  title: string
  meta?: string
  href?: string
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={16} weight="fill" style={{ color: 'var(--accent)' }} />
        <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{title}</h2>
        {meta && <span className="text-xs" style={{ color: DASHBOARD_MUTED }}>{meta}</span>}
      </div>
      {href && (
        <Link href={href} className="text-xs inline-flex items-center gap-1" style={{ color: DASHBOARD_MUTED }}>
          Abrir <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

function EmptyState({ title, actionHref, actionLabel }: { title: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-xl border px-4 py-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
      <CheckCircle size={20} weight="fill" className="mx-auto mb-2" style={{ color: 'var(--success)' }} />
      <p className="text-sm font-medium" style={{ color: DASHBOARD_SECONDARY }}>{title}</p>
      {actionHref && actionLabel && (
        <Link href={actionHref} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {actionLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border px-4 py-5" style={{ borderColor: 'var(--error)', background: 'var(--error-bg)' }}>
      <div className="flex items-start gap-3">
        <Warning size={18} weight="fill" className="mt-0.5 flex-shrink-0" style={{ color: 'var(--error)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--error)' }}>{message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold active:scale-95"
            style={{ color: 'var(--text)' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  )
}

function TodayActionQueue({ actions }: { actions: TodayAction[] }) {
  if (actions.length === 0) {
    return <EmptyState title="Sin acciones urgentes ahora mismo" actionHref="/clientes" actionLabel="Ver clientes" />
  }

  return (
    <div className="divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {actions.map(action => (
        <Link
          key={action.id}
          href={action.href}
          className="grid gap-3 px-4 py-3 transition-colors active:scale-[0.995] sm:grid-cols-[minmax(0,1fr)_auto]"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <SeverityChip severity={action.severity} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{action.cliente_nombre}</span>
              <span className="text-xs" style={{ color: DASHBOARD_MUTED }}>{action.meta}</span>
            </div>
            <p className="text-sm font-medium" style={{ color: DASHBOARD_SECONDARY }}>{action.title}</p>
            <p className="mt-0.5 line-clamp-1 text-xs" style={{ color: DASHBOARD_MUTED }}>{action.detail}</p>
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{action.cta}</span>
            <ArrowRight size={13} style={{ color: DASHBOARD_MUTED }} />
          </div>
        </Link>
      ))}
    </div>
  )
}

function ClientRiskList({ clientes }: { clientes: ClienteRiesgo[] }) {
  if (clientes.length === 0) return <EmptyState title="Sin clientes en riesgo detectable" />

  return (
    <div className="space-y-2">
      {clientes.map(cliente => (
        <Link
          key={cliente.cliente_id}
          href={cliente.href}
          className="block rounded-xl border px-3 py-3 transition-colors active:scale-[0.99]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{cliente.cliente_nombre}</p>
              <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>{cliente.accion}</p>
            </div>
            <span
              className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                background: cliente.riesgo === 'alto' ? 'var(--error-bg)' : cliente.riesgo === 'medio' ? 'rgba(200,169,106,0.12)' : 'var(--info-bg)',
                color: cliente.riesgo === 'alto' ? 'var(--error)' : cliente.riesgo === 'medio' ? 'var(--warning)' : 'var(--info)',
              }}
            >
              {cliente.riesgo}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cliente.signals.map(signal => (
              <span key={signal} className="rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'var(--surface-elevated)', color: DASHBOARD_SECONDARY }}>
                {signal}
              </span>
            ))}
          </div>
        </Link>
      ))}
    </div>
  )
}

function AiInboxSummary({ tareas }: { tareas: InboxIa[] }) {
  if (tareas.length === 0) return <EmptyState title="Sin tareas IA pendientes" actionHref="/entrenos/brain-ia" actionLabel="Ver brain IA" />

  return (
    <div className="space-y-2">
      {tareas.map(tarea => (
        <Link
          key={tarea.id}
          href={tarea.href}
          className="block rounded-xl border px-3 py-3 active:scale-[0.99]"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold capitalize" style={{ color: 'var(--text)' }}>
              {tarea.tipo.replaceAll('_', ' ')}
            </p>
            <span className="text-[10px] font-semibold" style={{ color: DASHBOARD_MUTED }}>
              P{tarea.prioridad}
            </span>
          </div>
          <p className="text-xs" style={{ color: DASHBOARD_SECONDARY }}>{tarea.cliente_nombre}</p>
          <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: DASHBOARD_MUTED }}>
            {tarea.propuesta ?? `Agente ${tarea.agente}`}
          </p>
        </Link>
      ))}
    </div>
  )
}

function WeeklyOpsStrip({ data }: { data: CommandData['operacion'] }) {
  const items = [
    { label: 'Clientes activos', value: data.clientes_activos, icon: Users },
    { label: 'Plan nutrición', value: data.planes_nutricion_activos, icon: ForkKnife },
    { label: 'Plan entreno', value: data.planes_entreno_activos, icon: Pulse },
    { label: 'Check-ins', value: data.checkins_pendientes, icon: ClipboardText },
    { label: 'Revisiones 7d', value: data.revisiones_7d, icon: CalendarBlank },
    { label: 'Membresías 30d', value: data.membresias_30d, icon: Repeat },
  ]

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="px-3 py-3" style={{ background: 'var(--surface)' }}>
          <div className="mb-2 flex items-center gap-1.5">
            <Icon size={13} weight="fill" style={{ color: DASHBOARD_MUTED }} />
            <span className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{label}</span>
          </div>
          <p className="font-data text-2xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function FoodCostFriction({ costes }: { costes: CosteCliente[] }) {
  const avg = costes.length ? costes.reduce((sum, c) => sum + c.coste_semanal_min, 0) / costes.length : 0
  const sinPrecio = costes.filter(c => c.ingredientes_sin_precio > 0).length
  const top = costes.slice(0, 5)

  if (!costes.length) return <EmptyState title="Sin datos de costes alimentarios" actionHref="/precios/escandallo" actionLabel="Abrir escandallo" />

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
          <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>Media semanal</p>
          <p className="font-data text-xl font-semibold" style={{ color: 'var(--text)' }}>{formatEuro(avg)}</p>
        </div>
        <Link href="/precios/escandallo" className="rounded-xl border p-3" style={{ borderColor: sinPrecio > 0 ? 'var(--warning)' : 'var(--border)', background: 'var(--surface-hover)' }}>
          <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>Con precios incompletos</p>
          <p className="font-data text-xl font-semibold" style={{ color: sinPrecio > 0 ? 'var(--warning)' : 'var(--text)' }}>{sinPrecio}</p>
        </Link>
      </div>
      <div className="space-y-1.5">
        {top.map(coste => (
          <Link key={coste.cliente_id} href={`/clientes/${coste.cliente_id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--surface-hover)' }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{coste.nombre}</p>
              <p className="truncate text-[11px]" style={{ color: DASHBOARD_MUTED }}>{coste.plan_nombre ?? 'Plan activo'}</p>
            </div>
            <div className="text-right">
              <p className="font-data text-sm font-semibold" style={{ color: 'var(--text)' }}>{formatEuro(coste.coste_semanal_min)}</p>
              {coste.ingredientes_sin_precio > 0 && <p className="text-[10px]" style={{ color: 'var(--warning)' }}>{coste.ingredientes_sin_precio} sin precio</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function SportsCalendarStrip({ competiciones }: { competiciones: Competicion[] }) {
  if (competiciones.length === 0) return <EmptyState title="Sin competiciones próximas" />

  return (
    <div className="space-y-2">
      {competiciones.map(comp => (
        <Link
          key={comp.id}
          href={`/clientes/${comp.cliente_id}`}
          className="flex items-center justify-between gap-3 rounded-xl border px-3 py-3"
          style={{ borderColor: comp.estado === 'race_week' || comp.estado === 'hoy' ? 'var(--warning)' : 'var(--border)', background: 'var(--surface-hover)' }}
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{comp.nombre}</p>
            <p className="truncate text-xs" style={{ color: DASHBOARD_MUTED }}>{comp.cliente_nombre} · {comp.disciplina ?? 'competición'}</p>
          </div>
          <div className="text-right">
            <p className="font-data text-sm font-bold" style={{ color: comp.dias <= 7 ? 'var(--warning)' : 'var(--text)' }}>
              {comp.dias === 0 ? 'Hoy' : `${comp.dias}d`}
            </p>
            <p className="text-[10px]" style={{ color: DASHBOARD_MUTED }}>{formatDate(comp.fecha_competicion)}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

function BusinessSummary({ data }: { data: NegocioData }) {
  const items = [
    { label: 'Ingresos 30d', value: formatEuro(data.resumen.ingresos_30d), icon: CurrencyEur },
    { label: 'Mes actual', value: formatEuro(data.resumen.ingresos_mes_actual), icon: Receipt },
    { label: 'MRR estimado', value: formatEuro(data.resumen.mrr_estimado), icon: Pulse },
    { label: 'Renuevan 7d', value: data.resumen.membresias_7d, icon: Repeat },
    { label: 'Sin membresía', value: data.resumen.clientes_sin_membresia, icon: Warning },
    { label: 'Pagos Stripe', value: data.resumen.transacciones_30d, icon: CreditCard },
  ]

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border sm:grid-cols-3 lg:grid-cols-6" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="px-3 py-3" style={{ background: 'var(--surface)' }}>
          <div className="mb-2 flex items-center gap-1.5">
            <Icon size={13} weight="fill" style={{ color: DASHBOARD_MUTED }} />
            <span className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{label}</span>
          </div>
          <p className="font-data text-xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
        </div>
      ))}
    </div>
  )
}

function RenewalsTable({ rows }: { rows: NegocioData['renovaciones'] }) {
  if (rows.length === 0) return <EmptyState title="Sin renovaciones en 30 días" />

  return (
    <div className="space-y-1.5">
      {rows.map(row => (
        <Link key={row.cliente_id} href={row.href} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--surface-hover)' }}>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{row.cliente_nombre}</p>
            <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{row.tipo_membresia ?? 'sin tipo'} · {formatDate(row.fecha_fin_membresia)}</p>
          </div>
          <div className="text-right">
            <p className="font-data text-sm font-semibold" style={{ color: row.dias !== null && row.dias <= 7 ? 'var(--warning)' : 'var(--text)' }}>
              {row.dias !== null && row.dias < 0 ? `-${Math.abs(row.dias)}d` : `${row.dias ?? 0}d`}
            </p>
            <p className="text-[10px]" style={{ color: DASHBOARD_MUTED }}>{row.importe_estimado ? formatEuro(row.importe_estimado) : 'sin importe'}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}

function PaymentIssuesList({ rows }: { rows: NegocioData['pagos_pendientes'] }) {
  if (rows.length === 0) return <EmptyState title="Sin pagos pendientes detectados" />

  return (
    <div className="space-y-1.5">
      {rows.map(row => (
        <Link key={row.id} href={row.href} className="block rounded-xl px-3 py-2.5" style={{ background: row.severity === 'alta' ? 'var(--error-bg)' : 'var(--surface-hover)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{row.cliente_nombre}</p>
              <p className="text-[11px]" style={{ color: row.severity === 'alta' ? 'var(--error)' : DASHBOARD_MUTED }}>{row.motivo}</p>
            </div>
            <ArrowRight size={12} className="mt-1 flex-shrink-0" style={{ color: DASHBOARD_MUTED }} />
          </div>
        </Link>
      ))}
    </div>
  )
}

function TransactionsTable({ rows }: { rows: NegocioData['transacciones_recientes'] }) {
  if (rows.length === 0) return <EmptyState title="Sin transacciones Stripe completadas todavía" />

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
      {rows.map(row => (
        <Link key={row.id} href={row.href} className="grid gap-2 border-b px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_110px_120px_80px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{row.cliente_nombre}</p>
            <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{row.plan_tipo ?? 'custom'} · {row.origen}</p>
          </div>
          <p className="font-data text-sm font-semibold sm:text-right" style={{ color: 'var(--text)' }}>{formatEuro(row.importe)}</p>
          <p className="text-xs sm:text-right" style={{ color: DASHBOARD_MUTED }}>{formatDate(row.fecha)}</p>
          <p className="text-xs capitalize sm:text-right" style={{ color: 'var(--success)' }}>{row.estado}</p>
        </Link>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('command')
  const [command, setCommand] = useState<CommandData | null>(null)
  const [costes, setCostes] = useState<CosteCliente[]>([])
  const [negocio, setNegocio] = useState<NegocioData | null>(null)
  const [commandLoading, setCommandLoading] = useState(true)
  const [negocioLoading, setNegocioLoading] = useState(false)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [negocioError, setNegocioError] = useState<string | null>(null)

  const loadCommand = useCallback(async () => {
    setCommandLoading(true)
    setCommandError(null)
    try {
      const [commandData, costesData] = await Promise.all([
        fetchJson<CommandData>('/api/dashboard/command-center'),
        fetchJson<{ costes: CosteCliente[] }>('/api/dashboard/costes-clientes').catch(() => ({ costes: [] })),
      ])
      setCommand(commandData)
      setCostes(costesData.costes ?? [])
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : 'No se pudo cargar el command center')
    } finally {
      setCommandLoading(false)
    }
  }, [])

  const loadNegocio = useCallback(async () => {
    setNegocioLoading(true)
    setNegocioError(null)
    try {
      setNegocio(await fetchJson<NegocioData>('/api/dashboard/negocio'))
    } catch (error) {
      setNegocioError(error instanceof Error ? error.message : 'No se pudo cargar negocio')
    } finally {
      setNegocioLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCommand()
  }, [loadCommand])

  useEffect(() => {
    if (activeTab === 'negocio' && !negocio && !negocioLoading) {
      loadNegocio()
    }
  }, [activeTab, loadNegocio, negocio, negocioLoading])

  const pendingActions = command?.hoy.length ?? 0
  const todayLabel = useMemo(() => (
    new Date().toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })
  ), [])

  return (
    <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs capitalize" style={{ color: DASHBOARD_MUTED }}>{todayLabel}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Dashboard</h1>
              <span className="rounded-lg px-2 py-1 text-xs font-semibold" style={{ background: pendingActions > 0 ? 'var(--warning-bg)' : 'var(--success-bg)', color: pendingActions > 0 ? 'var(--warning)' : 'var(--success)' }}>
                {commandLoading ? 'Cargando' : `${pendingActions} acciones`}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/clientes/nuevo" className="btn btn-primary btn-sm">
              <UserPlus size={14} weight="bold" />
              Nuevo cliente
            </Link>
            <Link href="/clientes" className="btn btn-ghost btn-sm">
              Clientes
            </Link>
          </div>
        </header>

        <div className="mb-5 inline-flex rounded-2xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {[
            { id: 'command' as Tab, label: 'Command Center', icon: ListChecks },
            { id: 'negocio' as Tab, label: 'Negocio', icon: CurrencyEur },
          ].map(tab => {
            const Icon = tab.icon
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: selected ? 'var(--surface-elevated)' : 'transparent',
                  color: selected ? 'var(--text)' : DASHBOARD_MUTED,
                }}
              >
                <Icon size={15} weight="fill" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === 'command' && (
          <div className="space-y-5">
            {commandError && <ErrorState message={commandError} onRetry={loadCommand} />}

            <section>
              <SectionHeader icon={Lightning} title="Hoy requiere atención" meta={command ? `${command.hoy.length} señales` : undefined} />
              {commandLoading ? <SkeletonRows rows={6} /> : command && <TodayActionQueue actions={command.hoy} />}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="card-glass">
                <SectionHeader icon={Warning} title="Clientes en riesgo" href="/clientes" />
                {commandLoading ? <SkeletonRows rows={4} /> : command && <ClientRiskList clientes={command.clientes_riesgo} />}
              </section>

              <section className="card-glass">
                <SectionHeader icon={Brain} title="Inbox IA" href="/entrenos/brain-ia" />
                {commandLoading ? <SkeletonRows rows={4} /> : command && <AiInboxSummary tareas={command.inbox_ia} />}
              </section>
            </div>

            <section>
              <SectionHeader icon={ListChecks} title="Operación semanal" />
              {commandLoading ? <SkeletonRows rows={2} /> : command && <WeeklyOpsStrip data={command.operacion} />}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="card-glass">
                <SectionHeader icon={ForkKnife} title="Coste y fricción alimentaria" href="/precios/escandallo" />
                {commandLoading ? <SkeletonRows rows={4} /> : <FoodCostFriction costes={costes} />}
              </section>

              <section className="card-glass">
                <SectionHeader icon={Trophy} title="Calendario deportivo" />
                {commandLoading ? <SkeletonRows rows={4} /> : command && <SportsCalendarStrip competiciones={command.competiciones} />}
              </section>
            </div>

            {command?.timestamp && (
              <p className="pb-4 text-center text-[10px]" style={{ color: DASHBOARD_MUTED }}>
                Actualizado {new Date(command.timestamp).toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}

        {activeTab === 'negocio' && (
          <div className="space-y-5">
            {negocioError && <ErrorState message={negocioError} onRetry={loadNegocio} />}

            <section>
              <SectionHeader icon={CurrencyEur} title="Resumen económico" />
              {negocioLoading ? <SkeletonRows rows={2} /> : negocio && <BusinessSummary data={negocio} />}
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="card-glass">
                <SectionHeader icon={Repeat} title="Renovaciones" href="/clientes" />
                {negocioLoading ? <SkeletonRows rows={4} /> : negocio && <RenewalsTable rows={negocio.renovaciones} />}
              </section>

              <section className="card-glass">
                <SectionHeader icon={CreditCard} title="Pagos pendientes" href="/clientes" />
                {negocioLoading ? <SkeletonRows rows={4} /> : negocio && <PaymentIssuesList rows={negocio.pagos_pendientes} />}
              </section>
            </div>

            <section className="card-glass">
              <SectionHeader icon={Receipt} title="Transacciones recientes" />
              {negocioLoading ? <SkeletonRows rows={5} /> : negocio && <TransactionsTable rows={negocio.transacciones_recientes} />}
            </section>

            {negocio && (
              <section className="grid gap-3 sm:grid-cols-4">
                {[
                  ['Nuevos sin pago', negocio.embudo.nuevos_sin_pago],
                  ['Links/pagos creados', negocio.embudo.links_generados],
                  ['Pagos completados', negocio.embudo.pagos_completados],
                  ['Clientes activos', negocio.embudo.clientes_activados],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>{label}</p>
                    <p className="font-data mt-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
                  </div>
                ))}
              </section>
            )}

            {negocio?.timestamp && (
              <p className="pb-4 text-center text-[10px]" style={{ color: DASHBOARD_MUTED }}>
                Actualizado {new Date(negocio.timestamp).toLocaleString('es-ES')}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

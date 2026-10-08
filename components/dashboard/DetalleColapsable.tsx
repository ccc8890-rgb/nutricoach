'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, CreditCard, ForkKnife, Receipt, Repeat, Trophy } from '@phosphor-icons/react'
import type { CommandData, Competicion, CosteCliente, NegocioData } from '@/lib/dashboard/tipos'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { DASHBOARD_MUTED, EmptyState, SectionHeader, SkeletonRows, formatDate, formatEuro } from './comun'

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

type Props = {
  command: CommandData | null
  costes: CosteCliente[]
  negocio: NegocioData | null
  loading: boolean
}

export default function DetalleColapsable({ command, costes, negocio, loading }: Props) {
  // `ver` en la URL: abre el detalle y baja a la sección (también al volver atrás)
  const [ver, setVer] = useEstadoUrl<string | null>('ver', null, ['abierto', 'transacciones', 'pagos', 'renovaciones'])
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!ver || !ref.current) return
    ref.current.open = true
    if (ver !== 'abierto') document.getElementById(`detalle-${ver}`)?.scrollIntoView({ block: 'start' })
  }, [ver])

  return (
    <details
      ref={ref}
      onToggle={e => { const abierto = e.currentTarget.open; if (abierto !== (ver !== null)) setVer(abierto ? 'abierto' : null) }}
      className="coach-dashboard-detail group rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <summary className="flex cursor-pointer list-none flex-col items-start justify-between gap-1 px-5 py-5 text-sm font-semibold sm:flex-row sm:items-center" style={{ color: 'var(--text)' }}>
        Más detalle
        <span className="text-xs font-medium" style={{ color: DASHBOARD_MUTED }}>Calendario, costes, renovaciones, pagos y transacciones</span>
      </summary>
      <div className="grid gap-5 px-4 pb-5 lg:grid-cols-2">
        <section>
          <SectionHeader icon={Trophy} title="Calendario deportivo" />
          {loading || !command ? <SkeletonRows rows={3} /> : <SportsCalendarStrip competiciones={command.competiciones} />}
        </section>
        <section>
          <SectionHeader icon={ForkKnife} title="Coste y fricción alimentaria" href="/precios/escandallo" linkLabel="Abrir escandallo" />
          {loading ? <SkeletonRows rows={3} /> : <FoodCostFriction costes={costes} />}
        </section>
        <section id="detalle-renovaciones" className="scroll-mt-4">
          <SectionHeader icon={Repeat} title="Renovaciones" href="/clientes?caduca=1&sort=membresia_caduca" linkLabel="Ver clientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <RenewalsTable rows={negocio.renovaciones} />}
        </section>
        <section id="detalle-pagos" className="scroll-mt-4">
          <SectionHeader icon={CreditCard} title="Pagos pendientes" href="/clientes?filtro=sin_membresia" linkLabel="Ver clientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <PaymentIssuesList rows={negocio.pagos_pendientes} />}
        </section>
        <section id="detalle-transacciones" className="scroll-mt-4 lg:col-span-2">
          <SectionHeader icon={Receipt} title="Transacciones recientes" />
          {!negocio ? <SkeletonRows rows={3} /> : <TransactionsTable rows={negocio.transacciones_recientes} />}
        </section>
        {negocio && (
          <section className="grid gap-3 sm:grid-cols-4 lg:col-span-2">
            {([
              ['Nuevos sin pago', negocio.embudo.nuevos_sin_pago],
              ['Links/pagos creados', negocio.embudo.links_generados],
              ['Pagos completados', negocio.embudo.pagos_completados],
              ['Clientes activados', negocio.embudo.clientes_activados],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: DASHBOARD_MUTED }}>{label}</p>
                <p className="font-data mt-1 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </details>
  )
}

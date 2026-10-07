'use client'

import Link from 'next/link'
import { CreditCard, Warning } from '@phosphor-icons/react'
import type { CommandData, NegocioData } from '@/lib/dashboard/tipos'
import { DASHBOARD_MUTED, formatEuro } from './comun'

type Props = {
  operacion: CommandData['operacion'] | null
  negocio: NegocioData | null
  loading: boolean
  negocioError: string | null
  onRetry: () => void
}

export default function NumerosClave({ operacion, negocio, loading, negocioError, onRetry }: Props) {
  const dash = '—'
  const tiles = [
    { label: 'Clientes activos', value: operacion ? String(operacion.clientes_activos) : dash, href: '/clientes' },
    { label: 'Ingresos del mes', value: negocio ? formatEuro(negocio.resumen.ingresos_mes_actual) : dash, href: '/clientes' },
    { label: 'MRR estimado', value: negocio ? formatEuro(negocio.resumen.mrr_estimado) : dash, href: '/clientes' },
    { label: 'Renuevan en 7 días', value: negocio ? String(negocio.resumen.membresias_7d) : dash, href: '/clientes' },
  ]
  const pagos = negocio ? negocio.pagos_pendientes.length : 0
  const sinMembresia = negocio ? negocio.resumen.clientes_sin_membresia : 0

  return (
    <section className="coach-dashboard-metrics">
      <div className="coach-dashboard-metrics-grid grid grid-cols-2 gap-px overflow-hidden rounded-xl lg:grid-cols-4">
        {tiles.map(t => (
          <Link key={t.label} href={t.href} className="coach-dashboard-metric p-5 active:scale-[0.99]" style={{ background: 'var(--surface)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: DASHBOARD_MUTED }}>{t.label}</p>
            {loading ? <div className="mt-2 h-8 w-20 rounded-lg skeleton" /> : (
              <p className="font-data mt-2 text-3xl font-medium tracking-[-0.06em]" style={{ color: 'var(--text)' }}>{t.value}</p>
            )}
          </Link>
        ))}
      </div>

      {negocioError && !loading && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--error)', background: 'var(--error-bg)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--error)' }}>No se pudieron cargar los datos de negocio</p>
          <button type="button" onClick={onRetry} className="text-xs font-semibold active:scale-95" style={{ color: 'var(--text)' }}>Reintentar</button>
        </div>
      )}

      {(pagos > 0 || sinMembresia > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {pagos > 0 && (
            <Link href="/clientes" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
              <CreditCard size={13} weight="fill" /> {pagos} {pagos === 1 ? 'pago pendiente' : 'pagos pendientes'}
            </Link>
          )}
          {sinMembresia > 0 && (
            <Link href="/clientes" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
              <Warning size={13} weight="fill" /> {sinMembresia} sin membresía
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

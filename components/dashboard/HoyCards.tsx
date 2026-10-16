'use client'

import type { CSSProperties } from 'react'
import Link from 'next/link'
import { ArrowRight, Brain, CheckCircle, ClipboardText, Warning, UserPlus } from '@phosphor-icons/react'
import type { ResumenHoy, Tono } from '@/lib/dashboard/hoy'
import { DASHBOARD_MUTED, DASHBOARD_SECONDARY } from './comun'

const TONO: Record<Tono, { color: string; bg: string }> = {
  critico: { color: 'var(--error)', bg: 'var(--error-bg)' },
  pendiente: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ok: { color: 'var(--success)', bg: 'var(--success-bg)' },
}

const ICONO = { checkins: ClipboardText, riesgo: Warning, ia: Brain, altas: UserPlus } as const

export default function HoyCards({ resumen, loading }: { resumen: ResumenHoy | null; loading: boolean }) {
  if (loading || !resumen) {
    return (
      <div className="coach-dashboard-priorities">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 skeleton" />)}
      </div>
    )
  }

  if (resumen.todoAlDia) {
    return (
      <div className="coach-dashboard-clear rounded-xl border px-6 py-10 text-center" style={{ borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
        <CheckCircle size={36} weight="fill" className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>Todo al día</p>
        <p className="mt-1 text-sm" style={{ color: DASHBOARD_SECONDARY }}>No hay check-ins, riesgos ni propuestas pendientes.</p>
      </div>
    )
  }

  return (
    <section className="coach-dashboard-priorities" aria-label="Prioridades de hoy">
      {resumen.tarjetas.map(t => {
        const tono = TONO[t.tono]
        const Icon = ICONO[t.id]
        return (
          <article key={t.id} className="coach-dashboard-priority" style={{ '--priority-color': tono.color } as CSSProperties}>
            <Link href={t.href} className="coach-dashboard-link flex items-center gap-4 active:scale-[0.99]">
              <span className="coach-dashboard-priority-icon"><Icon size={17} weight="regular" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t.titulo}</h2>
                <p className="mt-0.5 text-xs" style={{ color: DASHBOARD_MUTED }}>{t.total > 0 ? `${t.total} ${t.total === 1 ? 'elemento requiere' : 'elementos requieren'} atención` : 'Sin acciones pendientes'}</p>
              </div>
              <p className="font-data coach-dashboard-priority-count" style={{ color: tono.color }}>{t.total}</p>
              <ArrowRight size={15} style={{ color: DASHBOARD_MUTED }} />
            </Link>
            <div className="coach-dashboard-cases">
              {t.casos.map(caso => (
                <Link key={caso.id} href={caso.href} className="coach-dashboard-case flex items-center justify-between gap-2 px-3 py-2.5 active:scale-[0.99]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{caso.titulo}</p>
                    <p className="truncate text-[11px]" style={{ color: DASHBOARD_MUTED }}>{caso.detalle}</p>
                  </div>
                  <ArrowRight size={12} className="flex-shrink-0" style={{ color: DASHBOARD_MUTED }} />
                </Link>
              ))}
            </div>
          </article>
        )
      })}
    </section>
  )
}

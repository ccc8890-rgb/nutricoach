'use client'

import Link from 'next/link'
import { ArrowRight, Brain, CheckCircle, ClipboardText, Warning } from '@phosphor-icons/react'
import type { ResumenHoy, Tono } from '@/lib/dashboard/hoy'
import { DASHBOARD_MUTED, DASHBOARD_SECONDARY } from './comun'

const TONO: Record<Tono, { color: string; bg: string }> = {
  critico: { color: 'var(--error)', bg: 'var(--error-bg)' },
  pendiente: { color: 'var(--warning)', bg: 'var(--warning-bg)' },
  ok: { color: 'var(--success)', bg: 'var(--success-bg)' },
}

const ICONO = { checkins: ClipboardText, riesgo: Warning, ia: Brain } as const

export default function HoyCards({ resumen, loading }: { resumen: ResumenHoy | null; loading: boolean }) {
  if (loading || !resumen) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {[0, 1, 2].map(i => <div key={i} className="h-52 rounded-2xl skeleton" />)}
      </div>
    )
  }

  if (resumen.todoAlDia) {
    return (
      <div className="rounded-2xl border px-6 py-10 text-center" style={{ borderColor: 'var(--success)', background: 'var(--success-bg)' }}>
        <CheckCircle size={36} weight="fill" className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>Todo al día</p>
        <p className="mt-1 text-sm" style={{ color: DASHBOARD_SECONDARY }}>No hay check-ins, riesgos ni propuestas pendientes.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {resumen.tarjetas.map(t => {
        const tono = TONO[t.tono]
        const Icon = ICONO[t.id]
        return (
          <section key={t.id} className="flex flex-col rounded-2xl border p-4" style={{ borderColor: t.total > 0 ? tono.color : 'var(--border)', background: 'var(--surface)' }}>
            <Link href={t.href} className="mb-3 flex items-start justify-between gap-3 active:scale-[0.99]">
              <div>
                <div className="mb-1 flex items-center gap-1.5">
                  <Icon size={15} weight="fill" style={{ color: tono.color }} />
                  <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>{t.titulo}</h2>
                </div>
                <p className="text-[11px]" style={{ color: DASHBOARD_MUTED }}>{t.total > 0 ? 'Toca para ver todos' : 'Nada pendiente'}</p>
              </div>
              <p className="font-data text-5xl font-semibold leading-none" style={{ color: tono.color }}>{t.total}</p>
            </Link>
            <div className="mt-auto space-y-1.5">
              {t.casos.map(caso => (
                <Link key={caso.id} href={caso.href} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 active:scale-[0.99]" style={{ background: 'var(--surface-hover)' }}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{caso.titulo}</p>
                    <p className="truncate text-[11px]" style={{ color: DASHBOARD_MUTED }}>{caso.detalle}</p>
                  </div>
                  <ArrowRight size={12} className="flex-shrink-0" style={{ color: DASHBOARD_MUTED }} />
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

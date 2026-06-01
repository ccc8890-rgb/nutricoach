'use client'

import Link from 'next/link'
import { ArrowRight, Brain, ChartLine, ForkKnife, Pulse, WarningCircle } from '@phosphor-icons/react'
import type { CommandCenterRow } from '@/lib/training/command-center'
import { crearTrainingRoomSummary } from '@/lib/training/workspace'

export default function TrainingRoomPanel({ cliente }: { cliente: CommandCenterRow }) {
  const summary = crearTrainingRoomSummary(cliente)
  const riskColor = summary.riskLevel === 'alto'
    ? 'var(--semantic-alert)'
    : summary.riskLevel === 'medio'
      ? 'var(--semantic-warn)'
      : 'var(--semantic-active)'

  return (
    <section className="rounded-3xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            Training Room compacto
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
            {summary.primaryFocus}
          </h3>
        </div>
        <span
          className="rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ borderColor: riskColor, color: riskColor, background: 'var(--bg)' }}
        >
          Riesgo {summary.riskLevel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="flex items-center gap-2">
            <Pulse size={16} weight="duotone" style={{ color: riskColor }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Señales usadas</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {summary.evidence.map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item}</p>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="flex items-center gap-2">
            <Brain size={16} weight="duotone" style={{ color: 'var(--semantic-warn)' }} />
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Acciones coach</p>
          </div>
          <div className="mt-3 space-y-1.5">
            {summary.coachActions.map(item => (
              <p key={item} className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
        <div className="flex items-start gap-2">
          <WarningCircle size={16} weight="duotone" style={{ color: 'var(--semantic-info)' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Mensaje simple para cliente</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary.clientMessage}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Link href={`/clientes/${cliente.cliente_id}`} className="rounded-2xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
          <ChartLine className="mb-1" size={16} /> Historial
        </Link>
        <Link href="/entrenos/brain-ia" className="rounded-2xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
          <Brain className="mb-1" size={16} /> IA
        </Link>
        <Link href={`/clientes/${cliente.cliente_id}`} className="rounded-2xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}>
          <ForkKnife className="mb-1" size={16} /> Nutrición
        </Link>
      </div>

      <Link href={`/entrenos/${cliente.plan_id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
        Abrir plan completo <ArrowRight size={15} />
      </Link>
    </section>
  )
}

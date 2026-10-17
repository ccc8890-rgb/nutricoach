// components/clientes/ClientesListaMobile.tsx
'use client'

import Link from 'next/link'
import { ArrowRight, Barbell, CalendarBlank, ForkKnife, Warning } from '@phosphor-icons/react'
import { OBJETIVO_LABELS } from '@/lib/utils'
import {
  nombreCliente, getEstadoCliente, estadoStyle, checkinColor,
  diasHastaCaducidad,
  type ClienteRow,
} from '@/lib/clientes-utils'

export default function ClientesListaMobile({ clientes }: { clientes: ClienteRow[] }) {
  return (
    <div className="coach-client-mobile-list flex flex-col gap-0 overflow-hidden">
      {clientes.map((c, i) => {
        const estado = getEstadoCliente(c)
        const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
        const dias = c.dias_sin_checkin ?? 999
        const caducaDias = diasHastaCaducidad(c)
        const revision = c.fecha_proxima_revision
          ? new Date(`${c.fecha_proxima_revision.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '')
          : null

        return (
          <Link
            key={c.id}
            href={href}
            className="flex items-start gap-3 px-4 py-4 active:opacity-70"
            style={{ borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined }}
          >
            {/* Avatar */}
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-[17px] flex-shrink-0 mt-0.5"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
              {/* Fila 1: nombre + badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[17px] truncate" style={{ color: 'var(--text)' }}>
                  {nombreCliente(c)}
                  {c.es_predictor_baja && <Warning weight="fill" size={13} className="inline ml-1" style={{ color: 'var(--error)' }} aria-label="Riesgo de baja" />}
                </span>
                <span className="text-[13px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={estadoStyle(estado.tone)}>
                  {estado.label}
                </span>
              </div>

              <div className="coach-client-mobile-plan">
                <span data-active={Boolean(c.tiene_dieta_activa)}><ForkKnife size={13} /></span>
                <span data-active={Boolean(c.tiene_entreno_activo)}><Barbell size={13} /></span>
                <p>{c.objetivo ? (OBJETIVO_LABELS[c.objetivo] ?? c.objetivo) : 'Sin objetivo'}</p>
                <p className="ml-auto"><CalendarBlank size={13} /> {revision ?? 'Sin revisión'}</p>
              </div>

              {/* Fila 2: membresía */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {c.tipo_membresia && (
                  <span className="coach-client-membership capitalize">
                    {c.tipo_membresia}
                  </span>
                )}
                {caducaDias !== null && (
                  <span className="text-[13px]" style={{ color: caducaDias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
                    · caduca {caducaDias <= 0 ? 'caducada' : `${caducaDias}d`}
                  </span>
                )}
              </div>

              {/* Fila 3: stats */}
              <div className="flex items-center gap-5 mt-2">
                <div>
                  <span className="font-data text-[17px] font-black" style={{ color: checkinColor(dias) }}>
                    {dias === 999 ? '—' : `${dias}d`}
                  </span>
                  <span className="text-[13px] ml-1" style={{ color: 'var(--text-muted)' }}>check-in</span>
                </div>
                <div>
                  <span className="font-data text-[17px] font-black" style={{ color: (c.tareas_ia_pendientes ?? 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {c.tareas_ia_pendientes ?? 0}
                  </span>
                  <span className="text-[13px] ml-1" style={{ color: 'var(--text-muted)' }}>IA</span>
                </div>
                {c.score_adherencia !== undefined && (
                  <div>
                    <span className="font-data text-[17px] font-black" style={{ color: 'var(--text-muted)' }}>
                      {c.score_adherencia}
                    </span>
                    <span className="text-[13px] ml-1" style={{ color: 'var(--text-muted)' }}>adh.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '14px' }} />
          </Link>
        )
      })}
    </div>
  )
}

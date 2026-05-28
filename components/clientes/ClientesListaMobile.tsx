// components/clientes/ClientesListaMobile.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import {
  nombreCliente, getEstadoCliente, estadoStyle, checkinColor,
  diasHastaCaducidad,
  type ClienteRow,
} from '@/lib/clientes-utils'

export default function ClientesListaMobile({ clientes }: { clientes: ClienteRow[] }) {
  return (
    <div className="flex flex-col gap-0 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {clientes.map((c, i) => {
        const estado = getEstadoCliente(c)
        const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
        const dias = c.dias_sin_checkin ?? 999
        const caducaDias = diasHastaCaducidad(c)

        return (
          <Link
            key={c.id}
            href={href}
            className="flex items-start gap-3 px-3 py-3 active:opacity-70"
            style={{ borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined }}
          >
            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-[13px] flex-shrink-0 mt-0.5"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Body */}
            <div className="flex-1 min-w-0">
              {/* Fila 1: nombre + badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[13px] truncate" style={{ color: 'var(--text)' }}>
                  {nombreCliente(c)}
                  {c.es_predictor_baja && <span className="ml-1 text-[10px]" style={{ color: 'var(--error)' }}>⚠</span>}
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={estadoStyle(estado.tone)}>
                  {estado.label}
                </span>
              </div>

              {/* Fila 2: membresía */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {c.tipo_membresia && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                    style={{ background: 'rgba(165,180,252,0.1)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.18)' }}
                  >
                    {c.tipo_membresia}
                  </span>
                )}
                {caducaDias !== null && (
                  <span className="text-[10px]" style={{ color: caducaDias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
                    · caduca {caducaDias <= 0 ? 'caducada' : `${caducaDias}d`}
                  </span>
                )}
              </div>

              {/* Fila 3: stats */}
              <div className="flex items-center gap-4 mt-1.5">
                <div>
                  <span className="font-data text-[12px] font-black" style={{ color: checkinColor(dias) }}>
                    {dias === 999 ? '—' : `${dias}d`}
                  </span>
                  <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>check-in</span>
                </div>
                <div>
                  <span className="font-data text-[12px] font-black" style={{ color: (c.tareas_ia_pendientes ?? 0) > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {c.tareas_ia_pendientes ?? 0}
                  </span>
                  <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>IA</span>
                </div>
                {c.score_adherencia !== undefined && (
                  <div>
                    <span className="font-data text-[12px] font-black" style={{ color: 'var(--text-muted)' }}>
                      {c.score_adherencia}
                    </span>
                    <span className="text-[9px] ml-0.5" style={{ color: 'var(--text-muted)' }}>adh.</span>
                  </div>
                )}
                {/* Dots planes */}
                <div className="flex gap-1 items-center">
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.tiene_dieta_activa ? 'var(--success)' : 'var(--border)' }} />
                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.tiene_entreno_activo ? 'var(--success)' : 'var(--border)' }} />
                </div>
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '12px' }} />
          </Link>
        )
      })}
    </div>
  )
}

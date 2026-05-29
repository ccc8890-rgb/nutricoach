// components/clientes/ClientesTabla.tsx
'use client'

import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react'
import { OBJETIVO_LABELS } from '@/lib/utils'
import {
  nombreCliente, getEstadoCliente, estadoStyle, scoreColor,
  checkinColor, diasHastaCaducidad,
  type ClienteRow, type SortKey,
} from '@/lib/clientes-utils'

interface Props {
  clientes: ClienteRow[]
  sort: SortKey
  onSort: (s: SortKey) => void
}

function ColHeader({ label, sortKey, current, onSort }: { label: string; sortKey: SortKey; current: SortKey; onSort: (s: SortKey) => void }) {
  const active = current === sortKey
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="text-left text-[9px] font-bold uppercase tracking-widest transition-colors whitespace-nowrap"
      style={{ color: active ? 'var(--text)' : 'var(--text-muted)' }}
    >
      {label}{active ? ' ↓' : ''}
    </button>
  )
}

function MembresiaCell({ c }: { c: ClienteRow }) {
  const dias = diasHastaCaducidad(c)
  const barColor = dias !== null && dias <= 30 ? 'var(--semantic-alert)' : 'var(--semantic-active)'
  const barWidth = (() => {
    if (!c.fecha_inicio_membresia || !c.fecha_fin_membresia) return 0
    const total = new Date(c.fecha_fin_membresia).getTime() - new Date(c.fecha_inicio_membresia).getTime()
    const elapsed = Date.now() - new Date(c.fecha_inicio_membresia).getTime()
    return Math.min(100, Math.max(0, (elapsed / total) * 100))
  })()

  return (
    <div>
      {c.tipo_membresia ? (
        <>
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(165,180,252,0.1)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.18)' }}
          >
            {c.tipo_membresia}
          </span>
          <div className="text-[9px] mt-0.5" style={{ color: dias !== null && dias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
            {dias === null ? '—' : dias <= 0 ? 'Caducada' : `${dias} d`}
          </div>
          <div className="h-[2px] rounded-full mt-0.5 w-full" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor, opacity: 0.8 }} />
          </div>
        </>
      ) : (
        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  )
}

export default function ClientesTabla({ clientes, sort, onSort }: Props) {
  if (clientes.length === 0) return null

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {/* Cabecera */}
      <div
        className="hidden lg:flex items-center gap-0 px-3 py-2"
        style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div style={{ width: '36px' }} />
        <div style={{ flex: 1, paddingRight: '8px' }}>
          <ColHeader label="Cliente" sortKey="nombre" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '108px', paddingRight: '6px' }}>
          <ColHeader label="Membresía" sortKey="membresia_caduca" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '60px', paddingRight: '4px', textAlign: 'center' }}>
          <ColHeader label="Check-in" sortKey="checkin" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '88px', paddingRight: '6px' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Objetivo</span>
        </div>
        <div style={{ width: '48px', paddingRight: '4px', textAlign: 'center' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Planes</span>
        </div>
        <div style={{ width: '60px', paddingRight: '6px', textAlign: 'center' }}>
          <ColHeader label="Adh." sortKey="score_adherencia" current={sort} onSort={onSort} />
        </div>
        <div style={{ width: '88px', paddingRight: '6px', textAlign: 'right' }}>
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Estado</span>
        </div>
        <div style={{ width: '16px' }} />
      </div>

      {/* Filas */}
      {clientes.map((c, i) => {
        const estado = getEstadoCliente(c)
        const href = c.revisado_por_coach === false ? `/clientes/${c.id}/revisar-rapido` : `/clientes/${c.id}`
        const dias = c.dias_sin_checkin ?? 999
        const score = c.score_adherencia

        return (
          <Link
            key={c.id}
            href={href}
            className="group flex items-center gap-0 px-3 py-2.5 transition-colors"
            style={{
              borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined,
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] flex-shrink-0 mr-2"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Cliente */}
            <div style={{ flex: 1, paddingRight: '8px', minWidth: 0 }}>
              <div className="font-bold text-[13px] truncate" style={{ color: 'var(--text)' }}>
                {nombreCliente(c)}
                {c.es_predictor_baja && <span className="ml-1.5 text-[9px]" style={{ color: 'var(--error)' }}>⚠</span>}
              </div>
              <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                {c.profile?.email}
              </div>
            </div>

            {/* Membresía */}
            <div style={{ width: '108px', paddingRight: '6px', flexShrink: 0 }}>
              <MembresiaCell c={c} />
            </div>

            {/* Check-in */}
            <div style={{ width: '60px', paddingRight: '4px', flexShrink: 0, textAlign: 'center' }}>
              <div className="font-data text-[13px] font-black" style={{ color: checkinColor(dias) }}>
                {dias === 999 ? '—' : `${dias}d`}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>check</div>
            </div>

            {/* Objetivo */}
            <div style={{ width: '88px', paddingRight: '6px', flexShrink: 0 }}>
              {c.objetivo && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}
                >
                  {OBJETIVO_LABELS[c.objetivo] ?? c.objetivo}
                </span>
              )}
            </div>

            {/* Planes (2 dots) */}
            <div style={{ width: '48px', paddingRight: '4px', flexShrink: 0, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '3px', alignItems: 'center' }}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: c.tiene_dieta_activa ? 'var(--success)' : 'var(--border)' }}
                title="Dieta"
              />
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: c.tiene_entreno_activo ? 'var(--success)' : 'var(--border)' }}
                title="Entreno"
              />
            </div>

            {/* Score adherencia */}
            <div style={{ width: '60px', paddingRight: '6px', flexShrink: 0, textAlign: 'center' }}>
              {score !== undefined ? (
                <>
                  <div className="font-data text-[13px] font-black" style={{ color: scoreColor(score) }}>{score}</div>
                  <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>/100</div>
                </>
              ) : (
                <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>—</span>
              )}
            </div>

            {/* Estado */}
            <div style={{ width: '88px', paddingRight: '6px', flexShrink: 0, textAlign: 'right' }}>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={estadoStyle(estado.tone)}
              >
                {estado.label}
              </span>
            </div>

            {/* Arrow */}
            <div style={{ width: '16px', flexShrink: 0 }}>
              <ArrowRight size={13} style={{ color: 'var(--text-muted)' }} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </Link>
        )
      })}
    </div>
  )
}

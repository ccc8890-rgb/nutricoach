// components/clientes/ClientesTabla.tsx
'use client'

import Link from 'next/link'
import { ArrowRight, Warning } from '@phosphor-icons/react'
import { OBJETIVO_LABELS } from '@/lib/utils'
import {
  nombreCliente, getEstadoCliente, estadoStyle, scoreColor,
  checkinColor, diasHastaCaducidad,
  type ClienteRow, type SortKey,
} from '@/lib/clientes-utils'

// Rejilla compartida por cabecera y filas: el espacio se reparte entre columnas en vez de quedar en una sola
const GRID = '44px minmax(260px, 2.4fr) minmax(130px, 1fr) minmax(150px, 1.15fr) minmax(110px, 0.8fr) minmax(130px, 1fr) 20px'

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
      className="text-left text-[12px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap"
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
            className="text-[12px] font-bold px-2 py-0.5 rounded-full capitalize"
            style={{ background: 'rgba(165,180,252,0.1)', color: '#a5b4fc', border: '1px solid rgba(165,180,252,0.18)' }}
          >
            {c.tipo_membresia}
          </span>
          <div className="text-[13px] mt-1" style={{ color: dias !== null && dias <= 30 ? 'var(--error)' : 'var(--text-muted)' }}>
            {dias === null ? '—' : dias <= 0 ? 'Caducada' : `${dias} d`}
          </div>
          <div className="h-[3px] rounded-full mt-1 w-full max-w-[120px]" style={{ background: 'var(--border)' }}>
            <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: barColor, opacity: 0.8 }} />
          </div>
        </>
      ) : (
        <span className="text-[14px]" style={{ color: 'var(--text-muted)' }}>—</span>
      )}
    </div>
  )
}

export default function ClientesTabla({ clientes, sort, onSort }: Props) {
  if (clientes.length === 0) return null

  return (
    <div className="coach-client-table overflow-hidden max-w-[1500px]">
      {/* Cabecera */}
      <div
        className="hidden lg:grid items-center gap-x-4 px-4 py-3"
        style={{ gridTemplateColumns: GRID, background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}
      >
        <div />
        <ColHeader label="Cliente" sortKey="nombre" current={sort} onSort={onSort} />
        <ColHeader label="Membresía" sortKey="membresia_caduca" current={sort} onSort={onSort} />
        <ColHeader label="Seguimiento" sortKey="checkin" current={sort} onSort={onSort} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plan</span>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Estado</span>
        <div />
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
            className="group grid items-center gap-x-4 px-4 py-4 transition-colors"
            style={{
              gridTemplateColumns: GRID,
              borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined,
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[16px]"
              style={{ background: 'var(--bg-subtle)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {c.profile?.nombre?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Cliente */}
            <div style={{ minWidth: 0 }}>
              <div className="font-bold text-[17px] truncate" style={{ color: 'var(--text)' }}>
                {nombreCliente(c)}
                {c.es_predictor_baja && <Warning weight="fill" size={13} className="inline ml-2" style={{ color: 'var(--error)' }} aria-label="Riesgo de baja" />}
              </div>
              <div className="text-[14px] truncate" style={{ color: 'var(--text-muted)' }}>
                {c.profile?.email}
              </div>
              {c.objetivo && <div className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>{OBJETIVO_LABELS[c.objetivo] ?? c.objetivo}</div>}
            </div>

            {/* Membresía */}
            <MembresiaCell c={c} />

            {/* Seguimiento */}
            <div className="flex items-center gap-5">
              <div>
                <div className="font-data text-[17px] font-semibold" style={{ color: checkinColor(dias) }}>{dias === 999 ? '—' : `${dias} d`}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>último check-in</div>
              </div>
              <div>
                <div className="font-data text-[17px] font-semibold" style={{ color: score !== undefined ? scoreColor(score) : 'var(--text-muted)' }}>{score ?? '—'}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>adherencia</div>
              </div>
            </div>

            {/* Planes */}
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: c.tiene_dieta_activa ? 'var(--success)' : 'var(--border)' }}
                title="Dieta"
              />
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: c.tiene_entreno_activo ? 'var(--success)' : 'var(--border)' }}
                title="Entreno"
              />
            </div>

            {/* Estado */}
            <div>
              <span
                className="inline-block text-[14px] font-bold px-3 py-1 rounded-full whitespace-nowrap"
                style={estadoStyle(estado.tone)}
              >
                {estado.label}
              </span>
            </div>

            {/* Flecha */}
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}

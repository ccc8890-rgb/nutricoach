// components/clientes/ClientesTabla.tsx
'use client'

import Link from 'next/link'
import { ArrowRight, Barbell, ForkKnife, Warning } from '@phosphor-icons/react'
import { OBJETIVO_LABELS } from '@/lib/utils'
import {
  nombreCliente, getEstadoCliente, estadoStyle, scoreColor,
  checkinColor, diasHastaCaducidad,
  type ClienteRow, type SortKey,
} from '@/lib/clientes-utils'

// Rejilla compartida por cabecera y filas: el espacio se reparte entre columnas en vez de quedar en una sola
const GRID = '44px minmax(220px, 1.8fr) minmax(125px, 0.85fr) minmax(175px, 1.15fr) minmax(170px, 1.1fr) minmax(125px, 0.8fr) minmax(115px, 0.75fr) 20px'

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
          <span className="coach-client-membership capitalize">
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

function RevisionCell({ fecha }: { fecha?: string | null }) {
  if (!fecha) return <span className="coach-client-empty-value">Sin programar</span>

  const objetivo = new Date(`${fecha.slice(0, 10)}T12:00:00`)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const dias = Math.ceil((objetivo.getTime() - hoy.getTime()) / 86_400_000)
  const label = dias < 0
    ? `${Math.abs(dias)} d vencida`
    : dias === 0
      ? 'Hoy'
      : dias <= 7
        ? `En ${dias} d`
        : objetivo.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '')

  return (
    <div className="coach-client-review-date" data-overdue={dias < 0} data-soon={dias >= 0 && dias <= 7}>
      <strong>{label}</strong>
      <span>revisión</span>
    </div>
  )
}

export default function ClientesTabla({ clientes, sort, onSort }: Props) {
  if (clientes.length === 0) return null

  return (
    <div className="coach-client-table overflow-hidden max-w-[1500px]">
      {/* Cabecera */}
      <div className="coach-client-table-head hidden lg:grid items-center gap-x-4 px-4 py-3" style={{ gridTemplateColumns: GRID }}>
        <div />
        <ColHeader label="Cliente" sortKey="nombre" current={sort} onSort={onSort} />
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Estado</span>
        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plan y objetivo</span>
        <ColHeader label="Seguimiento" sortKey="checkin" current={sort} onSort={onSort} />
        <ColHeader label="Próxima revisión" sortKey="proxima_revision" current={sort} onSort={onSort} />
        <ColHeader label="Membresía" sortKey="membresia_caduca" current={sort} onSort={onSort} />
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
            className="coach-client-table-row group grid items-center gap-x-4 px-4 py-4"
            style={{
              gridTemplateColumns: GRID,
              borderBottom: i < clientes.length - 1 ? '1px solid var(--border)' : undefined,
            }}
          >
            {/* Avatar */}
            <div
              className="coach-client-row-avatar"
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
            </div>

            {/* Estado operativo */}
            <div>
              <span className="coach-client-state" style={estadoStyle(estado.tone)}>{estado.label}</span>
            </div>

            {/* Planes y objetivo */}
            <div className="coach-client-plan-cell">
              <div className="coach-client-plan-status">
                <span data-active={Boolean(c.tiene_dieta_activa)} title={c.tiene_dieta_activa ? 'Dieta activa' : 'Sin dieta activa'}><ForkKnife size={13} /></span>
                <span data-active={Boolean(c.tiene_entreno_activo)} title={c.tiene_entreno_activo ? 'Entreno activo' : 'Sin entreno activo'}><Barbell size={13} /></span>
              </div>
              <span>{c.objetivo ? (OBJETIVO_LABELS[c.objetivo] ?? c.objetivo) : 'Sin objetivo'}</span>
            </div>

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

            {/* Próxima revisión */}
            <RevisionCell fecha={c.fecha_proxima_revision} />

            {/* Membresía */}
            <MembresiaCell c={c} />

            {/* Flecha */}
            <ArrowRight size={18} style={{ color: 'var(--text-muted)' }} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        )
      })}
    </div>
  )
}

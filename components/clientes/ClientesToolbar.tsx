// components/clientes/ClientesToolbar.tsx
'use client'

import { MagnifyingGlass, CaretDown } from '@phosphor-icons/react'
import type { Filtro, FiltroAlta, SortKey, ToolbarCounts } from '@/lib/clientes-utils'

const FILTRO_LABELS: Record<Filtro, string> = {
  todos: 'Todos',
  atencion: 'Atención',
  nuevos: 'Nuevos',
  riesgo: 'Riesgo',
  sin_checkin: 'Sin check-in',
  activos: 'Activos',
}

const SORT_LABELS: Record<SortKey, string> = {
  checkin: 'Check-in',
  nombre: 'Nombre',
  membresia_caduca: 'Caduca',
  score_adherencia: 'Adherencia',
  deuda_atencion: 'Deuda atención',
}

interface Props {
  busqueda: string
  onBusqueda: (v: string) => void
  filtro: Filtro
  onFiltro: (f: Filtro) => void
  caducaPronte: boolean
  onCaducaPronte: (v: boolean) => void
  filtroAlta: FiltroAlta
  onFiltroAlta: (v: FiltroAlta) => void
  filtroRevisiones: boolean
  onFiltroRevisiones: (v: boolean) => void
  filtroChats: boolean
  onFiltroChats: (v: boolean) => void
  sort: SortKey
  onSort: (s: SortKey) => void
  counts: ToolbarCounts
}

export default function ClientesToolbar({
  busqueda, onBusqueda,
  filtro, onFiltro,
  caducaPronte, onCaducaPronte,
  filtroAlta, onFiltroAlta,
  filtroRevisiones, onFiltroRevisiones,
  filtroChats, onFiltroChats,
  sort, onSort,
  counts,
}: Props) {
  const statusFiltros: Filtro[] = ['atencion', 'todos', 'riesgo', 'sin_checkin', 'nuevos', 'activos']
  const statusCounts: Partial<Record<Filtro, number>> = {
    atencion: counts.atencion,
    todos: counts.total,
    riesgo: counts.riesgo,
    sin_checkin: counts.sin_checkin,
    nuevos: counts.nuevos,
    activos: counts.activos,
  }

  return (
    <div
      className="rounded-2xl p-2.5 mb-4 flex flex-wrap items-center gap-2"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Búsqueda compacta */}
      <div className="relative flex-shrink-0">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          className="input"
          style={{ width: '185px', paddingLeft: '28px', height: '32px', fontSize: '12px' }}
          placeholder="Buscar cliente…"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {/* Filtros de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {statusFiltros.map(f => {
          const active = filtro === f
          const cnt = statusCounts[f]
          return (
            <button
              key={f}
              onClick={() => onFiltro(f)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
              style={active
                ? { background: 'var(--text)', color: 'var(--bg)' }
                : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              {FILTRO_LABELS[f]}
              {cnt !== undefined && cnt > 0 && (
                <span
                  className="rounded-full px-1 text-[10px] font-data"
                  style={{
                    background: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                    minWidth: '16px',
                    textAlign: 'center',
                  }}
                >
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Separador */}
      <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: 'var(--border)' }} />

      {/* Filtros membresía + fechas */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => onCaducaPronte(!caducaPronte)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={caducaPronte
            ? { background: 'rgba(255,69,58,0.15)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          ⏰ Caduca pronto
          {counts.caduca_pronto > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(255,69,58,0.2)' }}>
              {counts.caduca_pronto}
            </span>
          )}
        </button>

        <select
          value={filtroAlta ?? ''}
          onChange={e => onFiltroAlta((e.target.value as FiltroAlta) || null)}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold"
          style={{ background: filtroAlta ? 'rgba(99,102,241,0.12)' : 'var(--bg-subtle)', color: filtroAlta ? '#818cf8' : 'var(--text-secondary)', border: `1px solid ${filtroAlta ? 'rgba(129,140,248,0.3)' : 'var(--border)'}`, height: '32px' }}
        >
          <option value="">📅 Alta: cualquiera</option>
          <option value="mes">Alta: este mes</option>
          <option value="trimestre">Alta: últimos 3 meses</option>
        </select>

        <button
          onClick={() => onFiltroRevisiones(!filtroRevisiones)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={filtroRevisiones
            ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          📅 Revisiones
          {counts.revisiones_proximas > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(129,140,248,0.15)' }}>
              {counts.revisiones_proximas}
            </span>
          )}
        </button>

        <button
          onClick={() => onFiltroChats(!filtroChats)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap"
          style={filtroChats
            ? { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.3)' }
            : { background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
          }
        >
          💬 Chats sin leer
          {counts.chats_sin_leer > 0 && (
            <span className="rounded-full px-1 text-[10px] font-data" style={{ background: 'rgba(129,140,248,0.15)' }}>
              {counts.chats_sin_leer}
            </span>
          )}
        </button>
      </div>

      {/* Espaciador */}
      <div className="flex-1" />

      {/* Ordenación */}
      <div className="relative flex-shrink-0">
        <select
          value={sort}
          onChange={e => onSort(e.target.value as SortKey)}
          className="px-2.5 pr-7 py-1.5 rounded-lg text-[11px] font-semibold appearance-none"
          style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border)', height: '32px' }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map(k => (
            <option key={k} value={k}>↕ {SORT_LABELS[k]}</option>
          ))}
        </select>
        <CaretDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  )
}

// components/clientes/ClientesToolbar.tsx
'use client'

import { CalendarBlank, CaretDown, ChatCircle, Clock, FadersHorizontal, MagnifyingGlass, UserMinus } from '@/components/icons/phosphor'
import type { Filtro, FiltroAlta, SortKey, ToolbarCounts } from '@/lib/clientes-utils'

const FILTRO_LABELS: Record<Filtro, string> = {
  todos: 'Todos',
  atencion: 'Atención',
  nuevos: 'Nuevos',
  riesgo: 'Riesgo',
  sin_checkin: 'Sin check-in',
  activos: 'Activos',
  sin_membresia: 'Sin membresía',
}

const SORT_LABELS: Record<SortKey, string> = {
  checkin: 'Check-in',
  nombre: 'Nombre',
  membresia_caduca: 'Caduca',
  proxima_revision: 'Próxima revisión',
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
  const statusFiltros: Filtro[] = ['atencion', 'todos', 'riesgo', 'nuevos', 'activos']
  const statusCounts: Partial<Record<Filtro, number>> = {
    atencion: counts.atencion,
    todos: counts.total,
    riesgo: counts.riesgo,
    sin_checkin: counts.sin_checkin,
    nuevos: counts.nuevos,
    activos: counts.activos,
    sin_membresia: counts.sin_membresia,
  }

  return (
    <div
      className="coach-client-toolbar mb-5"
      style={{ background: 'transparent' }}
    >
      {/* Búsqueda compacta */}
      <div className="relative flex-shrink-0">
        <MagnifyingGlass
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          className="input coach-client-search"
          style={{ width: '185px', paddingLeft: '28px', height: '32px', fontSize: '12px' }}
          placeholder="Buscar cliente…"
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Filtros de estado */}
      <div className="flex gap-1.5 flex-wrap">
        {statusFiltros.map(f => {
          const active = filtro === f
          const cnt = statusCounts[f]
          return (
            <button
              key={f}
              onClick={() => onFiltro(f)}
              className="coach-client-filter flex items-center gap-1.5 whitespace-nowrap"
              data-active={active}
            >
              {FILTRO_LABELS[f]}
              {cnt !== undefined && cnt > 0 && (
                <span
                  className="coach-client-filter-count"
                >
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex-1" />

      <details className="coach-client-more-filters relative">
        <summary className="coach-client-filter flex cursor-pointer list-none items-center gap-1.5 whitespace-nowrap">
          <FadersHorizontal size={14} /> Más filtros
          {(caducaPronte || filtroAlta || filtroRevisiones || filtroChats || filtro === 'sin_checkin' || filtro === 'sin_membresia') && <span className="coach-filter-dot" />}
        </summary>
        <div className="coach-client-filter-popover">
          <button onClick={() => onFiltro('sin_checkin')} className="coach-client-filter-row" data-active={filtro === 'sin_checkin'}>
            <Clock size={15} /> Sin check-in <span>{counts.sin_checkin}</span>
          </button>
          <button onClick={() => onFiltro('sin_membresia')} className="coach-client-filter-row" data-active={filtro === 'sin_membresia'}>
            <UserMinus size={15} /> Sin membresía <span>{counts.sin_membresia}</span>
          </button>
        <button
          onClick={() => onCaducaPronte(!caducaPronte)}
          className="coach-client-filter-row"
          data-active={caducaPronte}
        >
          <Clock size={15} /> Caduca pronto <span>{counts.caduca_pronto}</span>
        </button>

        <select
          value={filtroAlta ?? ''}
          onChange={e => onFiltroAlta((e.target.value as FiltroAlta) || null)}
          className="coach-client-filter-select"
        >
          <option value="">Alta: cualquiera</option>
          <option value="mes">Alta: este mes</option>
          <option value="trimestre">Alta: últimos 3 meses</option>
        </select>

        <button
          onClick={() => onFiltroRevisiones(!filtroRevisiones)}
          className="coach-client-filter-row"
          data-active={filtroRevisiones}
        >
          <CalendarBlank size={15} /> Revisiones <span>{counts.revisiones_proximas}</span>
        </button>

        <button
          onClick={() => onFiltroChats(!filtroChats)}
          className="coach-client-filter-row"
          data-active={filtroChats}
        >
          <ChatCircle size={15} /> Chats sin leer <span>{counts.chats_sin_leer}</span>
        </button>
        </div>
      </details>

      {/* Ordenación */}
      <div className="relative flex-shrink-0">
        <select
          value={sort}
          onChange={e => onSort(e.target.value as SortKey)}
          className="coach-client-sort appearance-none"
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

// Piezas compartidas por los módulos del panel de rendimiento.
import type { ReactNode } from 'react'
import type { PanelRendimiento } from '@/lib/rendimiento/panel'
import type { UmbralesAtleta } from '@/lib/rendimiento/carga'
import type { ResumenEjecucion } from '@/lib/rendimiento/ejecucion'

/** Lo que devuelve /api/clientes/[id]/rendimiento. */
export type DatosPanel = PanelRendimiento & { umbrales: UmbralesAtleta; ejecucion: ResumenEjecucion; hoy: string }

export const COLOR = { forma: '#5B8DEF', fatiga: '#E0557A', fresc: '#6AAF85', carga: '#8A9AB8', ambar: '#C8A96A' }
export const ZONAS_FC = ['#7B818A', '#6AAF85', '#C8A96A', '#E08A4E', '#E0557A']

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
export const fechaCorta = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }

export const tipoLegible: Record<string, string> = {
  running: 'Carrera', track_running: 'Pista', treadmill_running: 'Cinta', trail_running: 'Trail',
  strength_training: 'Fuerza', cycling: 'Ciclismo', indoor_cycling: 'Ciclismo (rodillo)', lap_swimming: 'Natación (piscina)',
  open_water_swimming: 'Natación (aguas abiertas)', indoor_rowing: 'Remo', hiking: 'Senderismo', walking: 'Caminar',
}

export function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</h3>
      {nota && <p className="mb-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{nota}</p>}
      {children}
    </section>
  )
}

export function Tarjeta({ titulo, valor, pie, color }: { titulo: string; valor: string; pie?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{titulo}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums" style={{ color: color ?? 'var(--text)' }}>{valor}</p>
      {pie && <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{pie}</p>}
    </div>
  )
}

/** Barra de pestañas (deslizable en móvil). `grande` es la de primer nivel (deportes). */
export function Pestanas<T extends string>({ items, valor, onChange, etiqueta, grande }: {
  items: readonly { key: T; titulo: string }[]
  valor: T
  onChange: (k: T) => void
  etiqueta: string
  grande?: boolean
}) {
  return (
    <nav aria-label={etiqueta} className="-mx-1 overflow-x-auto px-1">
      <div className="flex w-max gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        {items.map(x => (
          <button key={x.key} onClick={() => onChange(x.key)} aria-current={valor === x.key ? 'page' : undefined}
            className={`whitespace-nowrap rounded-md font-medium ${grande ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
            style={{ background: valor === x.key ? 'var(--surface-elevated)' : 'transparent', color: valor === x.key ? 'var(--text)' : 'var(--text-muted)' }}>
            {x.titulo}
          </button>
        ))}
      </div>
    </nav>
  )
}

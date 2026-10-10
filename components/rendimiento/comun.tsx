// Piezas compartidas por los módulos del panel de rendimiento.
import type { ReactNode } from 'react'

export const COLOR = { forma: '#5B8DEF', fatiga: '#E0557A', fresc: '#6AAF85', carga: '#8A9AB8', ambar: '#C8A96A' }

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

export function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</h3>
      {nota && <p className="mb-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{nota}</p>}
      {children}
    </section>
  )
}

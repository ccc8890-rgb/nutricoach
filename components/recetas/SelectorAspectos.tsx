'use client'

import { ASPECTOS_CORRECCION, GRUPOS_CORRECCION } from '@/lib/recetas/correcciones'

/** Aspectos a corregir agrupados (Textos · Ingredientes · Datos · Foto): el motor atiende cada uno en su siguiente pasada. */
export default function SelectorAspectos({ valor, onCambio, color = 'var(--warning)' }: {
  valor: string[]
  onCambio: (v: string[]) => void
  color?: string
}) {
  const alternar = (id: string) => onCambio(valor.includes(id) ? valor.filter(x => x !== id) : [...valor, id])
  return (
    <div className="space-y-2">
      {GRUPOS_CORRECCION.map(g => (
        <div key={g} className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 text-[11px] uppercase tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)' }}>{g}</span>
          {ASPECTOS_CORRECCION.filter(a => a.grupo === g).map(a => {
            const on = valor.includes(a.id)
            return (
              <button key={a.id} type="button" onClick={() => alternar(a.id)} className="rounded-full border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: on ? color : 'var(--border)', color: on ? color : 'var(--text-secondary)', background: on ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent' }}>
                {a.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

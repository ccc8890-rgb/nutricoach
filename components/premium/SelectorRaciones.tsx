'use client'

import { Minus, Plus } from 'lucide-react'

/** Redondeo legible de cantidades escaladas: sin decimales salvo en cantidades pequeñas */
export function escalarGramos(gramos: number, factor: number): string {
  const v = gramos * factor
  if (v >= 10) return String(Math.round(v))
  if (v >= 1) return String(Math.round(v * 10) / 10)
  return String(Math.round(v * 100) / 100)
}

/**
 * Para cuántas raciones se cocina: recalcula las cantidades de la receta (que vienen para `original` raciones).
 * `kcalRacion` es la de UNA ración de la receta original.
 */
export function SelectorRaciones({ original, valor, onChange, kcalRacion }: {
  original: number; valor: number; onChange: (n: number) => void; kcalRacion?: number | null
}) {
  const presets = [...new Set([1, original])].sort((a, b) => a - b)
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>¿Para cuántas raciones?</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
            La receta original es para {original} {original === 1 ? 'ración' : 'raciones'}. Las cantidades se recalculan solas.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => onChange(Math.max(1, valor - 1))} disabled={valor <= 1} aria-label="Menos raciones"
            className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}><Minus size={14} /></button>
          <span className="w-10 text-center text-lg font-bold font-data" style={{ color: 'var(--text)' }}>{valor}</span>
          <button onClick={() => onChange(Math.min(24, valor + 1))} aria-label="Más raciones"
            className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}><Plus size={14} /></button>
        </div>
      </div>
      {presets.length > 1 && (
        <div className="flex gap-1.5 mt-3">
          {presets.map(n => (
            <button key={n} onClick={() => onChange(n)} className="rounded-lg px-2.5 py-1 text-[11px] font-medium"
              style={{ background: valor === n ? 'var(--primary)' : 'transparent', color: valor === n ? 'var(--bg)' : 'var(--text-muted)', border: `1px solid ${valor === n ? 'var(--primary)' : 'var(--border)'}` }}>
              {n === 1 ? 'Solo 1 ración' : `Receta entera (${n})`}
            </button>
          ))}
        </div>
      )}
      {kcalRacion ? (
        <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Cada ración tiene {Math.round(kcalRacion)} kcal{valor > 1 ? ` · ${valor} raciones: ${Math.round(kcalRacion * valor)} kcal en total` : ''}.
        </p>
      ) : null}
    </div>
  )
}

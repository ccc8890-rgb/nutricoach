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
  const fm = { fontFamily: 'var(--font-sora), var(--font-instrument), sans-serif', fontWeight: 300 } as const
  return (
    <div className="mx-auto mb-3 w-full max-w-xl border-b pb-4" style={{ borderColor: 'var(--recipe-rule, var(--border))' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-data text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Raciones</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Original: {original} {original === 1 ? 'ración' : 'raciones'}. Las cantidades se recalculan.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(1, valor - 1))} disabled={valor <= 1} aria-label="Menos raciones"
            className="flex h-9 w-9 items-center justify-center rounded-lg border disabled:opacity-40" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}><Minus size={15} /></button>
          <span className="w-12 text-center text-2xl tabular-nums" style={{ color: 'var(--text)', ...fm }}>{valor}</span>
          <button onClick={() => onChange(Math.min(24, valor + 1))} aria-label="Más raciones"
            className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}><Plus size={15} /></button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {kcalRacion ? (
          <p className="text-sm tabular-nums" style={{ color: 'var(--text-muted)' }}>
            {Math.round(kcalRacion)} kcal por ración{valor > 1 ? ` · ${Math.round(kcalRacion * valor)} kcal en total` : ''}
          </p>
        ) : <span />}
        {presets.length > 1 && (
          <div className="flex overflow-hidden rounded-md border text-xs font-medium" style={{ borderColor: 'var(--border)' }}>
            {presets.map(n => (
              <button key={n} onClick={() => onChange(n)} className="px-2.5 py-1"
                style={{ background: valor === n ? 'var(--primary)' : 'transparent', color: valor === n ? 'var(--bg)' : 'var(--text-muted)' }}>
                {n === 1 ? 'Solo 1' : `Entera (${n})`}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

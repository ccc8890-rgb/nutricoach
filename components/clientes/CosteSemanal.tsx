'use client'

import { useEffect, useState } from 'react'
import type { CosteSemanal } from '@/app/api/clientes/[id]/coste-semanal/route'
import { ShoppingCart, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  clienteId: string
}

export default function CosteSemanalCard({ clienteId }: Props) {
  const [data, setData] = useState<CosteSemanal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/coste-semanal`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false))
  }, [clienteId])

  if (loading) return (
    <div className="rounded-xl border p-4 animate-pulse" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="h-4 w-32 rounded" style={{ background: 'var(--border)' }} />
    </div>
  )

  if (error === 'Sin plan activo') return null
  if (error || !data) return null

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Coste semanal estimado</span>
        </div>
        <div className="flex items-center gap-3">
          {data.coste_total !== null && data.coste_total > 0 && (
            <span className="text-base font-bold" style={{ color: 'var(--text)' }}>
              {data.coste_total.toFixed(2)} €
            </span>
          )}
          {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 space-y-3" style={{ borderColor: 'var(--border)' }}>
          {/* Cobertura */}
          <div className="flex items-center justify-between pt-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cobertura de precios</span>
            <span className="text-xs font-medium" style={{ color: data.cobertura_pct >= 80 ? '#22c55e' : data.cobertura_pct >= 50 ? '#f59e0b' : '#ef4444' }}>
              {data.cobertura_pct}%
            </span>
          </div>
          <div className="w-full rounded-full h-1.5" style={{ background: 'var(--border)' }}>
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${data.cobertura_pct}%`,
                background: data.cobertura_pct >= 80 ? '#22c55e' : data.cobertura_pct >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>

          {/* Top ingredientes */}
          <div className="space-y-1 mt-1">
            {data.ingredientes.filter(i => i.coste !== null).slice(0, 8).map(ing => (
              <div key={ing.alimento_id} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[55%]" style={{ color: 'var(--text)' }}>{ing.nombre}</span>
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--text-muted)' }}>{(ing.cantidad_gramos / 1000).toFixed(2)} kg</span>
                  <span className="font-medium" style={{ color: 'var(--text)' }}>{ing.coste!.toFixed(2)} €</span>
                </div>
              </div>
            ))}
          </div>

          {/* Sin precio */}
          {data.sin_precio.length > 0 && (
            <div className="flex items-start gap-1.5 rounded-lg p-2 mt-1" style={{ background: 'rgba(234,179,8,0.1)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-yellow-500" />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Sin precio: {data.sin_precio.slice(0, 5).join(', ')}{data.sin_precio.length > 5 ? `… +${data.sin_precio.length - 5}` : ''}
              </p>
            </div>
          )}

          <p className="text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
            Estimación basada en el plan activo × 7 días. Precio más barato disponible por ingrediente.
          </p>
        </div>
      )}
    </div>
  )
}

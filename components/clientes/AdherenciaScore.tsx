'use client'

import { useEffect, useState } from 'react'
import type { AdherenciaScore } from '@/lib/adherencia/score'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle } from 'lucide-react'

interface Props {
  clienteId: string
}

const RIESGO_CONFIG = {
  bajo: { color: '#22c55e', label: 'Bajo riesgo', bg: 'rgba(34,197,94,0.1)' },
  medio: { color: '#f59e0b', label: 'Atención', bg: 'rgba(245,158,11,0.1)' },
  alto: { color: '#ef4444', label: 'Riesgo alto', bg: 'rgba(239,68,68,0.1)' },
}

export default function AdherenciaScoreCard({ clienteId }: Props) {
  const [data, setData] = useState<AdherenciaScore | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/adherencia`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [clienteId])

  if (loading) return (
    <div className="rounded-xl border p-4 animate-pulse h-24" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
  )
  if (!data) return null

  const riesgo = RIESGO_CONFIG[data.riesgo_abandono]

  const TendenciaIcon = data.tendencia === 'mejora' ? TrendingUp :
    data.tendencia === 'bajando' ? TrendingDown : Minus

  const tendenciaColor = data.tendencia === 'mejora' ? '#22c55e' :
    data.tendencia === 'bajando' ? '#ef4444' : 'var(--text-muted)'

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Score circular */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
          style={{ background: riesgo.color }}
        >
          {data.score}
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Score de adherencia</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: riesgo.bg, color: riesgo.color }}>
              {riesgo.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <div className="flex items-center gap-1">
              <TendenciaIcon size={13} style={{ color: tendenciaColor }} />
              <span className="text-xs" style={{ color: tendenciaColor }}>
                {data.tendencia === 'mejora' ? 'Mejorando' : data.tendencia === 'bajando' ? 'Bajando' : 'Estable'}
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {data.checkins_ultimas_4_semanas}/4 check-ins (4 sem)
            </span>
            {data.semanas_sin_checkin > 0 && (
              <span className="text-xs" style={{ color: data.semanas_sin_checkin >= 2 ? '#ef4444' : 'var(--text-muted)' }}>
                {data.semanas_sin_checkin}s sin check-in
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Métricas */}
      {(data.media_adherencia !== null || data.media_energia !== null || data.media_sueno !== null) && (
        <div className="px-4 pb-3 flex gap-4">
          {data.media_adherencia !== null && (
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Adherencia</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{data.media_adherencia}%</p>
            </div>
          )}
          {data.media_energia !== null && (
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Energía</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{data.media_energia}/10</p>
            </div>
          )}
          {data.media_sueno !== null && (
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sueño</p>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{data.media_sueno}/10</p>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {data.alertas.length > 0 ? (
        <div className="px-4 pb-3 space-y-1">
          {data.alertas.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a}</span>
            </div>
          ))}
        </div>
      ) : data.score >= 70 ? (
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <CheckCircle size={12} className="text-green-500 shrink-0" />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Cliente con buena adherencia</span>
        </div>
      ) : null}
    </div>
  )
}

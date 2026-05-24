'use client'

import { useEffect, useState } from 'react'

interface DiarioEntry {
  fecha: string
  pct: number
  hechas: number
  total: number
}

interface AdherenciaData {
  score: number
  tendencia: 'mejora' | 'estable' | 'bajando'
  riesgo_abandono: 'bajo' | 'medio' | 'alto'
  media_adherencia: number | null
  media_energia: number | null
  semanas_sin_checkin: number
  checkins_ultimas_4_semanas: number
  alertas: string[]
  registro_diario: DiarioEntry[]
  media_registro_diario: number | null
  dias_con_registro: number
}

interface Props {
  clienteId: string
}

function pctColor(pct: number): string {
  if (pct === 0) return 'var(--border)'
  if (pct >= 80) return '#22c55e'
  if (pct >= 50) return '#f59e0b'
  return '#ef4444'
}

function pctBg(pct: number): string {
  if (pct === 0) return 'var(--surface)'
  if (pct >= 80) return 'rgba(34,197,94,0.12)'
  if (pct >= 50) return 'rgba(245,158,11,0.12)'
  return 'rgba(239,68,68,0.12)'
}

function formatFecha(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function MealAdherenciaHeatmap({ clienteId }: Props) {
  const [data, setData] = useState<AdherenciaData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clientes/${clienteId}/adherencia`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .finally(() => setLoading(false))
  }, [clienteId])

  if (loading) return (
    <div className="rounded-2xl border p-4 animate-pulse h-32" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} />
  )
  if (!data) return null

  const registros = data.registro_diario ?? []
  // Últimos 14 días
  const ultimos14 = registros.slice(0, 14)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Adherencia de comidas</span>
          {data.media_registro_diario !== null && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: pctBg(data.media_registro_diario), color: pctColor(data.media_registro_diario) }}>
              Media {data.media_registro_diario}%
            </span>
          )}
        </div>
        {data.dias_con_registro > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {data.dias_con_registro} días registrados
          </span>
        )}
      </div>

      {ultimos14.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin registros de comidas en los últimos 14 días</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>El cliente aún no ha marcado comidas desde el portal</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {ultimos14.map(d => (
            <div key={d.fecha} className="flex items-center gap-3">
              {/* Fecha */}
              <span className="text-xs w-28 shrink-0 capitalize" style={{ color: 'var(--text-muted)' }}>
                {formatFecha(d.fecha)}
              </span>

              {/* Barra */}
              <div className="flex-1 relative h-6 rounded-lg overflow-hidden" style={{ background: 'var(--bg)' }}>
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${d.pct}%`, background: pctColor(d.pct), opacity: 0.85 }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2">
                  <span className="text-[10px] font-medium" style={{ color: d.pct > 40 ? 'white' : 'var(--text-muted)' }}>
                    {d.hechas}/{d.total} comidas
                  </span>
                  {d.pct > 0 && (
                    <span className="text-[10px] font-bold" style={{ color: d.pct > 60 ? 'white' : pctColor(d.pct) }}>
                      {d.pct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer: resumen check-in */}
      {data.media_adherencia !== null && (
        <div className="px-4 py-2.5 border-t flex items-center gap-4 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          <span>Check-in autoreportado: <strong style={{ color: 'var(--text)' }}>{data.media_adherencia}%</strong></span>
          {data.media_energia !== null && (
            <span>Energía: <strong style={{ color: 'var(--text)' }}>{data.media_energia}/10</strong></span>
          )}
          <span className="ml-auto">
            {data.checkins_ultimas_4_semanas}/4 check-ins
          </span>
        </div>
      )}
    </div>
  )
}

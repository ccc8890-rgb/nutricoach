'use client'

import { useEffect, useState } from 'react'
import { Watch, Footprints, BatteryMedium, Brain, Flame } from 'lucide-react'

interface GarminDatos {
  body_battery_end: number | null
  training_readiness: number | null
  pasos: number | null
  stress_avg: number | null
  rhr: number | null
  calorias_totales: number | null
}

interface GarminStatus {
  activa: boolean
  ultima_sync: string | null
  datos_hoy: GarminDatos | null
}

interface IntegracionesResponse {
  garmin_connect?: GarminStatus
  strava?: { activa: boolean; ultima_sync: string | null }
}

interface Props {
  codigo: string
}

function batteryColor(v: number) {
  if (v >= 70) return '#22c55e'
  if (v >= 40) return '#f59e0b'
  return '#ef4444'
}

function readinessLabel(v: number) {
  if (v >= 70) return 'Excelente'
  if (v >= 50) return 'Bien'
  if (v >= 30) return 'Moderado'
  return 'Bajo'
}

export default function GarminMiniCard({ codigo }: Props) {
  const [garmin, setGarmin] = useState<GarminStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/${codigo}/integraciones`)
      .then(r => r.ok ? r.json() as Promise<IntegracionesResponse> : null)
      .then(d => {
        if (d?.garmin_connect?.activa) setGarmin(d.garmin_connect)
      })
      .finally(() => setLoading(false))
  }, [codigo])

  if (loading || !garmin || !garmin.datos_hoy) return null

  const d = garmin.datos_hoy

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Watch size={14} style={{ color: '#0D9488' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Garmin hoy</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium"
          style={{ background: 'rgba(13,148,136,0.1)', color: '#0D9488' }}>Sincronizado</span>
      </div>

      <div className="grid grid-cols-2 gap-0 divide-x divide-y" style={{ borderColor: 'var(--border)' }}>
        {/* Body Battery */}
        {d.body_battery_end !== null && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: batteryColor(d.body_battery_end) + '20' }}>
              <BatteryMedium size={16} style={{ color: batteryColor(d.body_battery_end) }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>
                {d.body_battery_end}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Body Battery</p>
            </div>
          </div>
        )}

        {/* Training Readiness */}
        {d.training_readiness !== null && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(79,70,229,0.1)' }}>
              <Brain size={16} style={{ color: '#4f46e5' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>
                {readinessLabel(d.training_readiness)}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Readiness</p>
            </div>
          </div>
        )}

        {/* Pasos */}
        {d.pasos !== null && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.1)' }}>
              <Footprints size={16} style={{ color: '#f59e0b' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>
                {d.pasos.toLocaleString('es-ES')}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pasos</p>
            </div>
          </div>
        )}

        {/* Calorías activas */}
        {d.calorias_totales !== null && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.1)' }}>
              <Flame size={16} style={{ color: '#ef4444' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>
                {d.calorias_totales} kcal
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>TDEE hoy</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Activity, Watch, Footprints, BatteryMedium, Brain, Flame, RefreshCw, Loader2, HeartPulse, Moon, Route, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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
  integraciones?: Array<{ proveedor: string; activa: boolean; ultima_sync: string | null; error_ultimo: string | null }>
  garmin_connect?: GarminStatus
  strava_resumen?: {
    actividades: Array<{
      fecha: string
      tipo_entreno: string | null
      duracion_min: number | null
      distancia_entreno_km: number | null
      fc_media: number | null
      pace_min_km: number | null
    }>
    sesiones_14d: number
    minutos_14d: number
    distancia_14d: number
  }
  resumenes_proveedor?: ProviderSummary[]
}

interface ProviderSummary {
  proveedor: string
  activa: boolean
  ultima_sync: string | null
  registros_14d: number
  minutos_14d: number
  distancia_14d: number
  calorias_14d: number
  ultimo: {
    fecha: string
    pasos: number | null
    distancia_km: number | null
    calorias_activas: number | null
    calorias_totales: number | null
    minutos_activo: number | null
    duracion_min: number | null
    distancia_entreno_km: number | null
    tipo_entreno: string | null
    hrv: number | null
    rhr: number | null
    sueno_h: number | null
    sueno_calidad: number | null
  } | null
}

interface Props {
  codigo: string
}

type MiniStat = {
  label: string
  value: string | number
  icon: LucideIcon
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

const PROVIDER_LABELS: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  garmin_connect: { label: 'Garmin', color: '#0D9488', icon: Watch },
  garmin: { label: 'Garmin', color: '#0D9488', icon: Watch },
  strava: { label: 'Strava', color: '#FC4C02', icon: Activity },
  whoop: { label: 'Whoop', color: '#111827', icon: HeartPulse },
  coros: { label: 'Coros', color: '#2563EB', icon: Watch },
  google_fit: { label: 'Google Fit', color: '#4285F4', icon: Footprints },
}

function providerMeta(proveedor: string) {
  return PROVIDER_LABELS[proveedor] ?? { label: proveedor.replace(/_/g, ' '), color: '#64748B', icon: Activity }
}

function formatTime(value: string | null | undefined) {
  if (!value) return null
  return new Date(value).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function compactNumber(value: number) {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 1 })
}

export default function GarminMiniCard({ codigo }: Props) {
  const [garmin, setGarmin] = useState<GarminStatus | null>(null)
  const [data, setData] = useState<IntegracionesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function load() {
    await fetch(`/api/cliente/${codigo}/integraciones`)
      .then(r => r.ok ? r.json() as Promise<IntegracionesResponse> : null)
      .then(d => {
        setData(d)
        if (d?.garmin_connect?.activa) setGarmin(d.garmin_connect)
      })
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  async function syncNow() {
    setSyncing(true)
    try {
      await fetch(`/api/cliente/${codigo}/sync-integraciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 2 }),
      })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  if (loading || !data) return null

  const connectedProviders = (data.resumenes_proveedor ?? [])
    .filter(provider => provider.activa || provider.registros_14d > 0)
    .filter(provider => provider.proveedor !== 'garmin_connect' && provider.proveedor !== 'garmin')

  const hasGarminData = Boolean(garmin?.activa && garmin.datos_hoy)
  const hasStravaData = Boolean((data.strava_resumen?.sesiones_14d ?? 0) > 0 || connectedProviders.some(provider => provider.proveedor === 'strava'))
  const visibleProviders = connectedProviders.filter(provider => provider.proveedor !== 'strava')

  if (!hasGarminData && !hasStravaData && visibleProviders.length === 0) return null

  const d = garmin?.datos_hoy

  return (
    <div className="space-y-3">
      {hasGarminData && d && (
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
            <Watch size={14} style={{ color: '#0D9488' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Garmin hoy</span>
            {garmin?.ultima_sync && (
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {formatTime(garmin.ultima_sync)}
              </span>
            )}
            <button
              onClick={syncNow}
              disabled={syncing}
              className="rounded-full border p-1 transition disabled:opacity-50"
              style={{ borderColor: 'var(--border)', color: '#0D9488' }}
              aria-label="Actualizar integraciones"
            >
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-0 divide-x divide-y" style={{ borderColor: 'var(--border)' }}>
            {d.body_battery_end !== null && (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: batteryColor(d.body_battery_end) + '20' }}>
                  <BatteryMedium size={16} style={{ color: batteryColor(d.body_battery_end) }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{d.body_battery_end}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Body Battery</p>
                </div>
              </div>
            )}

            {d.training_readiness !== null && (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(79,70,229,0.1)' }}>
                  <Brain size={16} style={{ color: '#4f46e5' }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{readinessLabel(d.training_readiness)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Readiness</p>
                </div>
              </div>
            )}

            {d.pasos !== null && (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.1)' }}>
                  <Footprints size={16} style={{ color: '#f59e0b' }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{d.pasos.toLocaleString('es-ES')}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Pasos</p>
                </div>
              </div>
            )}

            {d.calorias_totales !== null && (
              <div className="flex items-center gap-2.5 px-4 py-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <Flame size={16} style={{ color: '#ef4444' }} />
                </div>
                <div>
                  <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{d.calorias_totales} kcal</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>TDEE hoy</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {hasStravaData && (
        <CompactProviderCard
          proveedor="strava"
          ultimaSync={data.resumenes_proveedor?.find(provider => provider.proveedor === 'strava')?.ultima_sync ?? null}
          syncing={syncing}
          onSync={syncNow}
          stats={[
            { label: 'Sesiones', value: data.strava_resumen?.sesiones_14d ?? 0, icon: Activity },
            { label: 'Tiempo', value: `${data.strava_resumen?.minutos_14d ?? 0} min`, icon: Timer },
            { label: 'Distancia', value: `${data.strava_resumen?.distancia_14d ?? 0} km`, icon: Route },
          ]}
        />
      )}

      {visibleProviders.map(provider => {
        const latest = provider.ultimo
        const stats = [
          latest?.hrv != null ? { label: 'HRV', value: `${Math.round(latest.hrv)} ms`, icon: HeartPulse } : null,
          latest?.rhr != null ? { label: 'Reposo', value: `${Math.round(latest.rhr)} ppm`, icon: HeartPulse } : null,
          latest?.sueno_h != null ? { label: 'Sueño', value: `${compactNumber(latest.sueno_h)} h`, icon: Moon } : null,
          latest?.sueno_calidad != null ? { label: 'Recovery', value: `${Math.round(latest.sueno_calidad)}`, icon: BatteryMedium } : null,
          latest?.pasos != null ? { label: 'Pasos', value: latest.pasos.toLocaleString('es-ES'), icon: Footprints } : null,
          latest?.calorias_totales != null ? { label: 'TDEE', value: `${latest.calorias_totales} kcal`, icon: Flame } : null,
          provider.distancia_14d > 0 ? { label: 'Distancia', value: `${provider.distancia_14d} km`, icon: Route } : null,
        ].filter(Boolean) as MiniStat[]

        return (
          <CompactProviderCard
            key={provider.proveedor}
            proveedor={provider.proveedor}
            ultimaSync={provider.ultima_sync}
            syncing={syncing}
            onSync={syncNow}
            stats={stats.length ? stats.slice(0, 3) : [{ label: 'Conectado', value: 'Activo', icon: Watch }]}
          />
        )
      })}
    </div>
  )
}

function CompactProviderCard({
  proveedor,
  ultimaSync,
  stats,
  syncing,
  onSync,
}: {
  proveedor: string
  ultimaSync: string | null
  stats: MiniStat[]
  syncing: boolean
  onSync: () => void
}) {
  const meta = providerMeta(proveedor)
  const Icon = meta.icon

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <Icon size={14} style={{ color: meta.color }} />
        <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text)' }}>{meta.label}</span>
        {ultimaSync && <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>{formatTime(ultimaSync)}</span>}
        <button
          onClick={onSync}
          disabled={syncing}
          className="rounded-full border p-1 transition disabled:opacity-50"
          style={{ borderColor: 'var(--border)', color: meta.color }}
          aria-label={`Actualizar ${meta.label}`}
        >
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'var(--border)' }}>
        {stats.map(({ label, value, icon: StatIcon }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-3">
            <div className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg sm:flex" style={{ background: `${meta.color}1A` }}>
              <StatIcon size={14} style={{ color: meta.color }} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold leading-none" style={{ color: 'var(--text)' }}>{value}</p>
              <p className="mt-1 truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

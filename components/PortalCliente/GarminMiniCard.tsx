'use client'

import { useEffect, useState } from 'react'
import { Activity, Watch, Footprints, BatteryMedium, Brain, Flame, RefreshCw, Loader2, HeartPulse, Moon, Route, Timer, Info } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface GarminDatos {
  body_battery_end: number | null
  training_readiness: number | null
  pasos: number | null
  stress_avg: number | null
  rhr: number | null
  hrv: number | null
  calorias_totales: number | null
  vo2max_running: number | null
  vo2max_cycling: number | null
  lactate_threshold_hr: number | null
  training_acute_load: number | null
  training_recovery_time_h: number | null
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

type GarminStat = {
  key: string
  label: string
  value: string | number
  icon: LucideIcon
  color: string
  bg: string
  description: string
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
  const [openMetric, setOpenMetric] = useState<string | null>(null)

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
  const garminStats = d ? buildGarminStats(d) : []

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
            {garminStats.map(stat => (
              <GarminStatCell
                key={stat.key}
                stat={stat}
                open={openMetric === stat.key}
                onToggle={() => setOpenMetric(openMetric === stat.key ? null : stat.key)}
              />
            ))}
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

function buildGarminStats(d: GarminDatos): GarminStat[] {
  return [
    d.body_battery_end !== null ? {
      key: 'body_battery',
      label: 'Body Battery',
      value: d.body_battery_end,
      icon: BatteryMedium,
      color: batteryColor(d.body_battery_end),
      bg: `${batteryColor(d.body_battery_end)}20`,
      description: 'Estimación de energía disponible según sueño, estrés y actividad. Alto = mejor margen para entrenar.',
    } : null,
    d.training_readiness !== null ? {
      key: 'readiness',
      label: 'Readiness',
      value: readinessLabel(d.training_readiness),
      icon: Brain,
      color: '#4f46e5',
      bg: 'rgba(79,70,229,0.1)',
      description: 'Preparación para entrenar hoy. Combina sueño, recuperación, carga reciente, HRV y estrés.',
    } : null,
    d.pasos !== null ? {
      key: 'pasos',
      label: 'Pasos',
      value: d.pasos.toLocaleString('es-ES'),
      icon: Footprints,
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.1)',
      description: 'Actividad diaria total. Ayuda a ajustar gasto, NEAT y adherencia fuera del entrenamiento.',
    } : null,
    d.calorias_totales !== null ? {
      key: 'tdee',
      label: 'TDEE hoy',
      value: `${d.calorias_totales} kcal`,
      icon: Flame,
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.1)',
      description: 'Gasto energético total estimado del día. Útil para ajustar déficit, mantenimiento o carga.',
    } : null,
    d.vo2max_running !== null ? {
      key: 'vo2max',
      label: 'VO2max',
      value: Math.round(d.vo2max_running),
      icon: Activity,
      color: '#0EA5E9',
      bg: 'rgba(14,165,233,0.1)',
      description: 'Capacidad aeróbica estimada en ml/kg/min. Es una métrica clave de rendimiento en resistencia.',
    } : null,
    d.hrv !== null ? {
      key: 'vfc',
      label: 'VFC',
      value: `${Math.round(d.hrv)} ms`,
      icon: HeartPulse,
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
      description: 'Variabilidad de frecuencia cardiaca. Tendencias bajas pueden indicar fatiga, estrés o mala recuperación.',
    } : null,
    d.lactate_threshold_hr !== null ? {
      key: 'umbral_fc',
      label: 'Umbral FC',
      value: `${Math.round(d.lactate_threshold_hr)} ppm`,
      icon: HeartPulse,
      color: '#F43F5E',
      bg: 'rgba(244,63,94,0.1)',
      description: 'Frecuencia cardiaca estimada cerca del umbral de lactato. Sirve para ajustar ritmos y zonas intensas.',
    } : null,
    d.training_acute_load !== null ? {
      key: 'carga_aguda',
      label: 'Carga aguda',
      value: Math.round(d.training_acute_load),
      icon: Route,
      color: '#A855F7',
      bg: 'rgba(168,85,247,0.1)',
      description: 'Carga acumulada reciente. Ayuda a decidir si toca apretar, mantener o descargar.',
    } : null,
    d.training_recovery_time_h !== null ? {
      key: 'recuperacion',
      label: 'Recuperación',
      value: `${Math.round(d.training_recovery_time_h)} h`,
      icon: Timer,
      color: '#64748B',
      bg: 'rgba(100,116,139,0.1)',
      description: 'Horas estimadas para volver a estar listo tras la carga reciente. No es una orden, es una señal.',
    } : null,
  ].filter(Boolean) as GarminStat[]
}

function GarminStatCell({ stat, open, onToggle }: { stat: GarminStat; open: boolean; onToggle: () => void }) {
  const Icon = stat.icon

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg flex shrink-0 items-center justify-center" style={{ background: stat.bg }}>
          <Icon size={16} style={{ color: stat.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-none" style={{ color: 'var(--text)' }}>{stat.value}</p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full p-1 transition active:scale-95"
          style={{ color: open ? stat.color : 'var(--text-muted)', background: open ? stat.bg : 'transparent' }}
          aria-label={`Explicar ${stat.label}`}
        >
          <Info size={12} />
        </button>
      </div>
      {open && (
        <p className="mt-2 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          {stat.description}
        </p>
      )}
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

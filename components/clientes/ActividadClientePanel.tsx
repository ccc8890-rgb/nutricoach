'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BatteryMedium,
  Bike,
  CalendarClock,
  CheckCircle2,
  Gauge,
  HeartPulse,
  Loader2,
  RefreshCw,
  Route,
  Watch,
} from 'lucide-react'

type ActividadFlag = {
  tipo: string
  severidad: 'alta' | 'media' | 'baja'
  titulo: string
  descripcion: string
  accion: string
  valor?: number | string | null
}

type ActividadResumen = {
  dias: number
  tiene_datos: boolean
  sesiones: number
  pasos_media: number
  calorias_activas_total: number
  tdee_media: number | null
  tss_total: number
  minutos_alta_intensidad_total: number
  hrv_media: number | null
  rhr_media: number | null
  fc_media_entreno: number | null
  body_battery_media: number | null
  stress_media: number | null
  readiness_media: number | null
  distancia_entreno_km_total: number
  proveedores: string[]
}

type ActividadRow = {
  id: string
  proveedor: string
  fecha: string
  tipo_entreno?: string | null
  duracion_min?: number | null
  distancia_entreno_km?: number | null
  distancia_km?: number | null
  calorias_activas?: number | null
  calorias_totales?: number | null
  tss?: number | null
  pace_min_km?: number | null
  fc_media?: number | null
  fc_max?: number | null
  hrv?: number | null
  rhr?: number | null
  body_battery_end?: number | null
  training_readiness?: number | null
  pasos?: number | null
}

type IntegracionRow = {
  id: string
  proveedor: string
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

type ActividadResponse = {
  integraciones: IntegracionRow[]
  resumen: ActividadResumen
  actividades: ActividadRow[]
  flags: ActividadFlag[]
}

function fmt(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sin dato'
  return `${Number(value).toLocaleString('es-ES')}${suffix}`
}

function proveedorLabel(proveedor: string) {
  if (proveedor === 'garmin_connect') return 'Garmin Connect'
  if (proveedor === 'google_fit') return 'Google Fit'
  return proveedor.charAt(0).toUpperCase() + proveedor.slice(1)
}

function flagStyle(severidad: ActividadFlag['severidad']) {
  if (severidad === 'alta') return { background: 'var(--error-bg)', color: 'var(--error)', border: '1px solid rgba(255,69,58,0.22)' }
  if (severidad === 'media') return { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid rgba(201,169,110,0.22)' }
  return { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl p-3 min-w-0" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>{label}</p>
        <Icon size={15} style={{ color: 'var(--text-muted)' }} />
      </div>
      <p className="font-data text-xl font-black mt-2 leading-none truncate" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

export default function ActividadClientePanel({ clienteId }: { clienteId: string }) {
  const [data, setData] = useState<ActividadResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [dias, setDias] = useState(14)
  const [syncing, setSyncing] = useState(false)

  async function load(nextDias = dias) {
    setLoading(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/actividad?dias=${nextDias}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(dias)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, dias])

  async function syncNow() {
    setSyncing(true)
    try {
      await fetch('/api/integraciones/garmin-connect/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente_id: clienteId, dias: 7 }),
      }).catch(() => null)
      await load(dias)
    } finally {
      setSyncing(false)
    }
  }

  const actividadesEntreno = useMemo(
    () => (data?.actividades ?? []).filter(a => a.tipo_entreno || a.duracion_min || a.distancia_entreno_km).slice(0, 12),
    [data]
  )

  if (loading && !data) {
    return (
      <div className="rounded-2xl p-5 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="h-5 w-48 rounded mb-4" style={{ background: 'var(--surface-hover)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl" style={{ background: 'var(--surface-hover)' }} />)}
        </div>
      </div>
    )
  }

  if (!data) return null
  const resumen = data.resumen

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Datos externos</p>
          <h2 className="font-bold flex items-center gap-2" style={{ color: 'var(--text)' }}>
            <Watch size={17} /> Garmin, Strava y carga real
          </h2>
          <p className="text-xs mt-1 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
            Señales de actividad, recuperación y gasto real para decisiones de entrenamiento y nutrición.
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] sm:flex gap-2">
          <select
            value={dias}
            onChange={e => setDias(Number(e.target.value))}
            className="text-xs py-2 px-3 rounded-xl border outline-none"
            style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <option value={7}>7 días</option>
            <option value={14}>14 días</option>
            <option value={30}>30 días</option>
            <option value={60}>60 días</option>
          </select>
          <button className="btn-secondary btn-sm" onClick={syncNow} disabled={syncing}>
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {data.integraciones.length === 0 ? (
          <span className="text-xs px-3 py-1.5 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Sin integraciones conectadas
          </span>
        ) : data.integraciones.map(intg => (
          <span
            key={intg.id}
            className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap"
            style={intg.activa ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(48,209,88,0.2)' } : { background: 'var(--surface-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {intg.activa ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
            {proveedorLabel(intg.proveedor)}
            {intg.ultima_sync ? ` · ${new Date(intg.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ''}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Metric label="Sesiones" value={fmt(resumen.sesiones)} icon={Activity} />
        <Metric label="TSS" value={fmt(resumen.tss_total)} icon={Gauge} />
        <Metric label="TDEE medio" value={fmt(resumen.tdee_media, ' kcal')} icon={BatteryMedium} />
        <Metric label="HRV media" value={fmt(resumen.hrv_media, ' ms')} icon={HeartPulse} />
        <Metric label="Readiness" value={fmt(resumen.readiness_media, '/100')} icon={Gauge} />
        <Metric label="Pasos/día" value={fmt(resumen.pasos_media)} icon={Route} />
        <Metric label="Distancia" value={fmt(resumen.distancia_entreno_km_total, ' km')} icon={Bike} />
        <Metric label="Alta intensidad" value={fmt(resumen.minutos_alta_intensidad_total, ' min')} icon={CalendarClock} />
      </div>

      {data.flags.length > 0 && (
        <div className="space-y-2 mb-4">
          {data.flags.map(flag => (
            <div key={`${flag.tipo}-${flag.titulo}`} className="rounded-2xl p-3" style={flagStyle(flag.severidad)}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{flag.titulo}</p>
                  <p className="text-xs mt-0.5 opacity-85">{flag.descripcion}</p>
                  <p className="text-xs mt-1 font-medium">{flag.accion}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Entrenos detectados</p>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{actividadesEntreno.length} registros</span>
        </div>
        {actividadesEntreno.length === 0 ? (
          <div className="rounded-2xl p-5 text-center" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sin entrenos externos en este periodo</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Cuando Garmin o Strava sincronicen sesiones, aparecerán aquí.</p>
          </div>
        ) : (
          <div className="divide-y rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
            {actividadesEntreno.map(a => (
              <div key={a.id} className="p-3 grid grid-cols-[1fr_auto] gap-3" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                    {a.tipo_entreno ? a.tipo_entreno.replaceAll('_', ' ') : 'Actividad'} · {proveedorLabel(a.proveedor)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(a.fecha).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {a.duracion_min ? ` · ${a.duracion_min} min` : ''}
                    {a.distancia_entreno_km ? ` · ${a.distancia_entreno_km} km` : ''}
                    {a.pace_min_km ? ` · ${a.pace_min_km} min/km` : ''}
                  </p>
                </div>
                <div className="text-right text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {a.fc_media ? <p>FC {a.fc_media}</p> : null}
                  {a.calorias_activas ? <p>{a.calorias_activas} kcal</p> : null}
                  {a.tss ? <p>TSS {a.tss}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

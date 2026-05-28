'use client'
import { useEffect, useState } from 'react'
import { Smartphone, Heart, Zap, CheckCircle, XCircle, Loader2, Footprints, BatteryMedium, Brain, Wind, Flame, TrendingUp, Lock, Eye, EyeOff, RefreshCw, Route, Clock } from 'lucide-react'

// ─── Brand icons ─────────────────────────────────────────────────────────────

function GarminIcon({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/garmin-connect.jpg" width={size} height={size} style={{ borderRadius: 6 }} alt="Garmin Connect" />
}

function StravaIcon({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/strava.jpg" width={size} height={size} style={{ borderRadius: 6 }} alt="Strava" />
}

function CorosIcon({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/coros.jpg" width={size} height={size} style={{ borderRadius: 6 }} alt="COROS" />
}

function TrainingPeaksIcon({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/trainingpeaks.jpg" width={size} height={size} style={{ borderRadius: 6 }} alt="TrainingPeaks" />
}

function WhoopIcon({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/whoop.jpg" width={size} height={size} style={{ borderRadius: 6 }} alt="Whoop" />
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface IntegracionInfo {
  proveedor: string
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

interface StravaActividad {
  fecha: string
  tipo_entreno: string | null
  duracion_min: number | null
  distancia_entreno_km: number | null
  calorias_activas: number | null
  fc_media: number | null
  fc_max: number | null
  tss: number | null
  pace_min_km: number | null
}

interface StravaResumen {
  actividades: StravaActividad[]
  sesiones_14d: number
  minutos_14d: number
  distancia_14d: number
}

interface GarminConnectStatus {
  activa: boolean
  ultima_sync: string | null
  datos_hoy: {
    body_battery_end: number | null
    training_readiness: number | null
    pasos: number | null
    stress_avg: number | null
    rhr: number | null
    hrv: number | null
    calorias_totales: number | null
    sueno_h: number | null
    sueno_calidad: number | null
  } | null
}

interface GarminDia {
  fecha: string
  pasos: number | null
  calorias_totales: number | null
  rhr: number | null
  hrv: number | null
  body_battery_max: number | null
  body_battery_min: number | null
  body_battery_end: number | null
  stress_avg: number | null
  training_readiness: number | null
  distancia_km: number | null
  sueno_h: number | null
  minutos_activo: number | null
  minutos_alta_intensidad: number | null
}

interface GarminPromedios {
  pasos: number
  calorias_totales: number
  rhr: number
  hrv: number | null
  body_battery_end: number | null
  stress_avg: number | null
  training_readiness: number | null
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

function bodyBatteryColor(val: number) {
  if (val >= 70) return '#22c55e'
  if (val >= 40) return '#f59e0b'
  return '#ef4444'
}

function readinessColor(val: number) {
  if (val >= 70) return '#22c55e'
  if (val >= 40) return '#f59e0b'
  return '#ef4444'
}

function stressLabel(val: number) {
  if (val < 26) return 'Bajo'
  if (val < 51) return 'Medio'
  if (val < 76) return 'Alto'
  return 'Muy alto'
}

function stressColor(val: number) {
  if (val < 26) return '#22c55e'
  if (val < 51) return '#f59e0b'
  return '#ef4444'
}

function StatPill({ label, value, unit, color }: { label: string; value: string | number; unit?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center bg-[var(--bg)] rounded-xl px-3 py-2 min-w-[72px]">
      <span className="text-[10px] text-[var(--text-muted)] mb-0.5">{label}</span>
      <span className="text-base font-bold" style={{ color: color ?? 'var(--text)' }}>{value}</span>
      {unit && <span className="text-[9px] text-[var(--text-muted)]">{unit}</span>}
    </div>
  )
}

function GaugeBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="w-full h-2 rounded-full bg-[var(--bg)] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ─── Proveedores OAuth (Strava, Garmin API oficial, Google Fit) ────────────

const OAUTH_PROVEEDORES = [
  {
    key: 'strava',
    nombre: 'Strava',
    descripcion: 'Actividades de running, ciclismo y natación',
    icono: Smartphone,
    color: '#FC4C02',
    disponible: true,
  },
  {
    key: 'google_fit',
    nombre: 'Google Fit',
    descripcion: 'Actividad diaria, pasos y calorías',
    icono: Smartphone,
    color: '#4285F4',
    disponible: true,
  },
]

interface Props {
  codigo: string
  clienteId: string
}

// ─── Componente principal ────────────────────────────────────────────────────

interface TerraConexion {
  terra_user_id: string
  provider: string
  ultima_sync: string | null
}

// Proveedores que Terra expone (con sus íconos y etiquetas)
const TERRA_PROVIDER_META: Record<string, { label: string; icon: string; color: string }> = {
  TRAININGPEAKS: { label: 'TrainingPeaks', icon: '/icons/trainingpeaks.jpg', color: '#5C33F6' },
  COROS:         { label: 'COROS',          icon: '/icons/coros.jpg',         color: '#1A1A2E' },
  WHOOP:         { label: 'Whoop',          icon: '',                          color: '#111111' },
  GARMIN:        { label: 'Garmin',         icon: '/icons/garmin-connect.jpg', color: '#007CC3' },
  POLAR:         { label: 'Polar',          icon: '',                          color: '#D7263D' },
  WAHOO:         { label: 'Wahoo',          icon: '',                          color: '#E8175D' },
  SUUNTO:        { label: 'Suunto',         icon: '',                          color: '#E4003A' },
  WITHINGS:      { label: 'Withings',       icon: '',                          color: '#00B0B9' },
  OURA:          { label: 'Oura',           icon: '',                          color: '#B08D57' },
}

function terraMeta(provider: string) {
  return TERRA_PROVIDER_META[provider.toUpperCase()] ?? { label: provider, icon: '', color: '#64748B' }
}

export default function IntegracionesPanel({ codigo, clienteId }: Props) {
  const [integraciones, setIntegraciones] = useState<IntegracionInfo[]>([])
  const [garminConnect, setGarminConnect] = useState<GarminConnectStatus | null>(null)
  const [garminResumen, setGarminResumen] = useState<{ dias: GarminDia[]; promedios: GarminPromedios; tiene_datos: boolean } | null>(null)
  const [stravaResumen, setStravaResumen] = useState<StravaResumen | null>(null)
  const [terraConexiones, setTerraConexiones] = useState<TerraConexion[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  // Garmin Connect credentials form
  const [gcForm, setGcForm] = useState({ email: '', password: '', showPassword: false })
  const [gcSaving, setGcSaving] = useState(false)
  const [gcError, setGcError] = useState<string | null>(null)

  async function cargarDatos() {
    const [intData, garminData] = await Promise.all([
      fetch(`/api/cliente/${codigo}/integraciones`).then(r => r.json()),
      fetch(`/api/cliente/${codigo}/garmin-resumen`).then(r => r.json()),
    ])
    setIntegraciones(intData.integraciones ?? [])
    setGarminConnect(intData.garmin_connect ?? null)
    setStravaResumen(intData.strava_resumen ?? null)
    setTerraConexiones(intData.terra_conexiones ?? [])
    setGarminResumen(garminData)
  }

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo])

  const getEstado = (key: string) => integraciones.find(i => i.proveedor === key)

  const handleConnect = (proveedor: string) => {
    window.location.href = `/api/integraciones/${proveedor}/connect?cliente_id=${clienteId}&codigo=${codigo}`
  }

  const handleDisconnect = async (proveedor: string) => {
    if (!confirm(`¿Desconectar ${proveedor}?`)) return
    await fetch(`/api/integraciones/${proveedor}/disconnect?cliente_id=${clienteId}`, { method: 'DELETE' })
    setIntegraciones(prev => prev.filter(i => i.proveedor !== proveedor))
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch(`/api/cliente/${codigo}/sync-integraciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dias: 3 }),
      })
      const data = await res.json().catch(() => null) as { results?: Array<{ proveedor: string; ok: boolean; sincronizados: number; error?: string }> } | null
      if (!res.ok) throw new Error(data?.results?.find(r => !r.ok)?.error ?? 'No se pudo sincronizar')

      const results = data?.results ?? []
      const errors = results.filter(r => !r.ok)
      const total = results.reduce((acc, r) => acc + (r.sincronizados ?? 0), 0)

      await cargarDatos()

      if (errors.length > 0 && total === 0) {
        // Endpoint devolvió 200 pero todas las syncs fallaron — mostrar error real
        setSyncMessage(`Error: ${errors[0]?.error ?? 'No se pudo sincronizar'}`)
      } else if (total > 0) {
        setSyncMessage(`${total} registros actualizados`)
      } else {
        setSyncMessage('Sin datos nuevos por ahora')
      }
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'Error sincronizando')
    } finally {
      setSyncing(false)
    }
  }

  const handleGarminConnectSave = async () => {
    if (!gcForm.email || !gcForm.password) return
    setGcSaving(true)
    setGcError(null)
    try {
      const res = await fetch('/api/integraciones/garmin-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: gcForm.email, password: gcForm.password, codigo }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGcError(data.error ?? 'Error desconocido')
      } else {
        setGarminConnect({ activa: true, ultima_sync: null, datos_hoy: null })
        setGcForm({ email: '', password: '', showPassword: false })
      }
    } catch {
      setGcError('Error de red')
    } finally {
      setGcSaving(false)
    }
  }

  const handleGarminConnectDisconnect = async () => {
    if (!confirm('¿Desconectar Garmin Connect? Se borrarán tus credenciales guardadas.')) return
    await fetch('/api/integraciones/garmin-connect', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo }),
    })
    setGarminConnect(null)
    setGarminResumen(null)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
    </div>
  )

  const hoy = garminConnect?.datos_hoy
  const promedios = garminResumen?.promedios

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">Mis apps y dispositivos</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Conecta tus apps para que tu coach tenga datos más precisos y tus planes se adapten mejor a tu actividad real.
            </p>
          </div>
          <button
            onClick={handleSyncNow}
            disabled={syncing || (!garminConnect?.activa && !getEstado('strava')?.activa)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-45"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--surface)' }}
          >
            {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Actualizar
          </button>
        </div>
        {syncMessage && (
          <p className="mt-2 text-xs" style={{ color: syncMessage.includes('Error') || syncMessage.includes('No se pudo') ? '#ef4444' : 'var(--text-muted)' }}>
            {syncMessage}
          </p>
        )}
      </div>

      {/* ── Garmin Connect (unofficial sync automático) ─────────────────── */}
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#007CC320' }}>
              <GarminIcon size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--text)]">Garmin Connect</span>
                {garminConnect?.activa
                  ? <CheckCircle size={14} className="text-green-500" />
                  : <XCircle size={14} className="text-[var(--text-muted)]" />}
              </div>
              <p className="text-xs text-[var(--text-muted)]">Pasos, HRV, sueño, TDEE y recuperación</p>
              {garminConnect?.ultima_sync && (
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Última sync: {new Date(garminConnect.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          {garminConnect?.activa ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                Activo
              </span>
              <button
                onClick={handleGarminConnectDisconnect}
                className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-[var(--text-muted)] bg-[var(--surface)] rounded-full px-2 py-0.5 shrink-0">
              Sin vincular
            </span>
          )}
        </div>

        {/* Formulario de credenciales cuando no está conectado */}
        {!garminConnect?.activa && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Introduce las credenciales de tu cuenta Garmin Connect para sincronizar pasos, Body Battery, HRV y carga de entrenamiento automáticamente.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="email"
                placeholder="Email de Garmin Connect"
                value={gcForm.email}
                onChange={e => setGcForm(f => ({ ...f, email: e.target.value }))}
                className="input text-sm"
                autoComplete="off"
              />
              <div className="relative">
                <input
                  type={gcForm.showPassword ? 'text' : 'password'}
                  placeholder="Contraseña de Garmin Connect"
                  value={gcForm.password}
                  onChange={e => setGcForm(f => ({ ...f, password: e.target.value }))}
                  className="input text-sm w-full pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setGcForm(f => ({ ...f, showPassword: !f.showPassword }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                  aria-label="Ver contraseña"
                >
                  {gcForm.showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {gcError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <XCircle size={12} /> {gcError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGarminConnectSave}
                  disabled={gcSaving || !gcForm.email || !gcForm.password}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {gcSaving ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />}
                  {gcSaving ? 'Verificando…' : 'Vincular cuenta'}
                </button>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Tus credenciales se guardan cifradas.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Datos del último día disponible */}
        {hoy && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">
              Último registro · {garminConnect?.ultima_sync ? new Date(garminConnect.ultima_sync).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {hoy.body_battery_end != null && (
                <div className="flex-1 min-w-[80px] bg-[var(--bg)] rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <BatteryMedium size={12} style={{ color: bodyBatteryColor(hoy.body_battery_end) }} />
                    <span className="text-[10px] text-[var(--text-muted)]">Body Battery</span>
                  </div>
                  <span className="text-xl font-bold" style={{ color: bodyBatteryColor(hoy.body_battery_end) }}>
                    {hoy.body_battery_end}
                  </span>
                  <GaugeBar value={hoy.body_battery_end} color={bodyBatteryColor(hoy.body_battery_end)} />
                </div>
              )}
              {hoy.training_readiness != null && (
                <div className="flex-1 min-w-[80px] bg-[var(--bg)] rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Brain size={12} style={{ color: readinessColor(hoy.training_readiness) }} />
                    <span className="text-[10px] text-[var(--text-muted)]">Preparación</span>
                  </div>
                  <span className="text-xl font-bold" style={{ color: readinessColor(hoy.training_readiness) }}>
                    {hoy.training_readiness}
                  </span>
                  <GaugeBar value={hoy.training_readiness} color={readinessColor(hoy.training_readiness)} />
                </div>
              )}
              {hoy.stress_avg != null && (
                <div className="flex-1 min-w-[80px] bg-[var(--bg)] rounded-xl p-3">
                  <div className="flex items-center gap-1 mb-1">
                    <Wind size={12} style={{ color: stressColor(hoy.stress_avg) }} />
                    <span className="text-[10px] text-[var(--text-muted)]">Estrés</span>
                  </div>
                  <span className="text-xl font-bold" style={{ color: stressColor(hoy.stress_avg) }}>
                    {hoy.stress_avg}
                  </span>
                  <span className="text-[10px]" style={{ color: stressColor(hoy.stress_avg) }}>{stressLabel(hoy.stress_avg)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {hoy.pasos != null && (
                <StatPill label="Pasos" value={hoy.pasos.toLocaleString('es-ES')} />
              )}
              {hoy.rhr != null && (
                <StatPill label="FC reposo" value={hoy.rhr} unit="ppm" color="#ef4444" />
              )}
              {hoy.hrv != null && (
                <StatPill label="HRV" value={hoy.hrv} unit="ms" color="#8b5cf6" />
              )}
              {hoy.calorias_totales != null && (
                <StatPill label="TDEE" value={hoy.calorias_totales.toLocaleString('es-ES')} unit="kcal" color="#f97316" />
              )}
              {hoy.sueno_h != null && (
                <StatPill label="Sueño" value={hoy.sueno_h.toFixed(1)} unit="h" color="#818CF8" />
              )}
            </div>
          </div>
        )}

        {garminConnect?.activa && !hoy && (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <p className="text-xs font-medium text-[var(--text)]">Sin datos recientes de Garmin</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Abre la app <strong>Garmin Connect</strong> en tu móvil para que el reloj sincronice los datos del día. Después pulsa <strong>Actualizar</strong> aquí.
              </p>
            </div>
          </div>
        )}

        {/* Promedios 7 días */}
        {garminResumen?.tiene_datos && promedios && garminResumen.dias.length > 1 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Media últimos {garminResumen.dias.length} días
            </p>
            <div className="flex flex-wrap gap-2">
              {promedios.pasos > 0 && (
                <div className="flex items-center gap-1.5 bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
                  <Footprints size={11} className="text-[var(--primary)]" />
                  <span className="text-xs text-[var(--text)]">{promedios.pasos.toLocaleString('es-ES')} pasos/día</span>
                </div>
              )}
              {promedios.calorias_totales > 0 && (
                <div className="flex items-center gap-1.5 bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
                  <Flame size={11} className="text-orange-500" />
                  <span className="text-xs text-[var(--text)]">{promedios.calorias_totales.toLocaleString('es-ES')} kcal TDEE/día</span>
                </div>
              )}
              {promedios.hrv != null && (
                <div className="flex items-center gap-1.5 bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
                  <TrendingUp size={11} className="text-purple-500" />
                  <span className="text-xs text-[var(--text)]">HRV media {promedios.hrv} ms</span>
                </div>
              )}
              {promedios.training_readiness != null && (
                <div className="flex items-center gap-1.5 bg-[var(--bg)] rounded-lg px-2.5 py-1.5">
                  <Brain size={11} style={{ color: readinessColor(promedios.training_readiness) }} />
                  <span className="text-xs text-[var(--text)]">Preparación media {promedios.training_readiness}/100</span>
                </div>
              )}
            </div>
            {/* Mini sparkline de body battery */}
            {garminResumen.dias.some(d => d.body_battery_end != null) && (
              <div className="mt-3">
                <p className="text-[10px] text-[var(--text-muted)] mb-1">Body Battery — últimos días</p>
                <div className="flex items-end gap-1 h-8">
                  {[...garminResumen.dias].reverse().map((d, i) => {
                    const val = d.body_battery_end
                    if (val == null) return <div key={i} className="flex-1 h-1 rounded-sm bg-[var(--border)]" />
                    const h = Math.max(4, Math.round((val / 100) * 32))
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                        <div
                          className="w-full rounded-sm"
                          style={{ height: h, background: bodyBatteryColor(val) }}
                          title={`${d.fecha}: ${val}`}
                        />
                        <span className="text-[8px] text-[var(--text-muted)] hidden sm:block">
                          {new Date(d.fecha).toLocaleDateString('es-ES', { weekday: 'narrow' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Nota sobre sueño — solo si no hay datos */}
            {!garminResumen?.dias.some(d => d.sueno_h != null) && (
              <p className="text-[10px] text-[var(--text-muted)] mt-2 italic">
                Los datos de sueño aparecerán cuando duermas con el reloj puesto.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Resumen Strava ──────────────────────────────────────────────── */}
      {getEstado('strava')?.activa && (
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FC4C0220' }}>
                <StravaIcon size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">Strava</span>
                  <CheckCircle size={14} className="text-green-500" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">Entrenos registrados que el coach tendrá en cuenta</p>
              </div>
            </div>
            <span className="text-[10px] font-medium rounded-full px-2 py-0.5" style={{ background: '#FC4C021A', color: '#FC4C02' }}>
              {stravaResumen?.sesiones_14d ?? 0} sesiones
            </span>
            <button
              onClick={() => handleDisconnect('strava')}
              className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
            >
              Desconectar
            </button>
          </div>

          {(stravaResumen?.actividades?.length ?? 0) > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatPill label="Sesiones" value={stravaResumen?.sesiones_14d ?? 0} color="#FC4C02" />
                <StatPill label="Tiempo" value={stravaResumen?.minutos_14d ?? 0} unit="min" />
                <StatPill label="Distancia" value={stravaResumen?.distancia_14d ?? 0} unit="km" />
              </div>
              <div className="space-y-2">
                {(stravaResumen?.actividades ?? []).slice(0, 4).map((actividad, index) => (
                  <div key={`${actividad.fecha}-${index}`} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <Route size={14} style={{ color: '#FC4C02' }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--text)] capitalize">
                        {actividad.tipo_entreno ?? 'Entreno'} · {new Date(actividad.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {actividad.duracion_min ? `${actividad.duracion_min} min` : 'Duración no disponible'}
                        {actividad.distancia_entreno_km ? ` · ${actividad.distancia_entreno_km} km` : ''}
                        {actividad.fc_media ? ` · FC ${actividad.fc_media}` : ''}
                      </p>
                    </div>
                    {actividad.pace_min_km ? (
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{actividad.pace_min_km}/km</span>
                    ) : actividad.calorias_activas ? (
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">{actividad.calorias_activas} kcal</span>
                    ) : (
                      <Clock size={12} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
              <p className="text-xs font-medium text-[var(--text)]">Strava conectado, sin entrenos recientes importados</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Pulsa Actualizar después de subir una actividad para que aparezca aquí y entre en los cálculos del coach.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Proveedores OAuth ────────────────────────────────────────────── */}
      {OAUTH_PROVEEDORES.filter(provider => provider.key !== 'strava' || !getEstado('strava')?.activa).map(({ key, nombre, descripcion, icono: Icono, color, disponible }) => {
        const estado = getEstado(key)
        const conectado = estado?.activa ?? false
        const ultimaSync = estado?.ultima_sync
          ? new Date(estado.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
          : null

        return (
          <div
            key={key}
            className="card p-4 flex items-center justify-between gap-4"
            style={{ opacity: disponible ? 1 : 0.5 }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
                {key === 'strava' ? <StravaIcon size={22} />
                  : key === 'coros' ? <CorosIcon size={22} />
                  : <Icono size={20} style={{ color }} />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text)]">{nombre}</span>
                  {!disponible && (
                    <span className="text-[10px] bg-[var(--surface)] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full">Próximamente</span>
                  )}
                  {conectado && <CheckCircle size={14} className="text-green-500" />}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{descripcion}</p>
                {ultimaSync && <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Última sync: {ultimaSync}</p>}
                {estado?.error_ultimo && (
                  <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                    <XCircle size={10} /> Error de conexión
                  </p>
                )}
              </div>
            </div>

            {disponible && (
              conectado ? (
                <button
                  onClick={() => handleDisconnect(key)}
                  className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors shrink-0"
                >
                  Desconectar
                </button>
              ) : (
                <button
                  onClick={() => handleConnect(key)}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >
                  Conectar
                </button>
              )
            )}
          </div>
        )
      })}

      {/* ── TrainingPeaks ──────────────────────────────────────────────────── */}
      {(() => {
        const conn = terraConexiones.find(c => c.provider.toUpperCase() === 'TRAININGPEAKS')
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#5C33F620' }}>
                  <TrainingPeaksIcon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">TrainingPeaks</span>
                    {conn ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-[var(--text-muted)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Plan de entrenamiento, TSS y carga de trabajo</p>
                  {conn?.ultima_sync && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Última sync: {new Date(conn.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              {conn ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Activo</span>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Desconectar TrainingPeaks?')) return
                      await fetch(`/api/integraciones/terra/disconnect?terra_user_id=${conn.terra_user_id}&codigo=${codigo}`, { method: 'DELETE' })
                      setTerraConexiones(prev => prev.filter(x => x.terra_user_id !== conn.terra_user_id))
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                  >Desconectar</button>
                </div>
              ) : (
                <button
                  onClick={() => { window.location.href = `/api/integraciones/terra/widget?codigo=${codigo}&provider=TRAININGPEAKS` }}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >Conectar</button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Whoop ──────────────────────────────────────────────────────────── */}
      {(() => {
        const conn = terraConexiones.find(c => c.provider.toUpperCase() === 'WHOOP')
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#11111120' }}>
                  <WhoopIcon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">Whoop</span>
                    {conn ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-[var(--text-muted)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">HRV, recuperación, sueño y strain diario</p>
                  {conn?.ultima_sync && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Última sync: {new Date(conn.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              {conn ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Activo</span>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Desconectar Whoop?')) return
                      await fetch(`/api/integraciones/terra/disconnect?terra_user_id=${conn.terra_user_id}&codigo=${codigo}`, { method: 'DELETE' })
                      setTerraConexiones(prev => prev.filter(x => x.terra_user_id !== conn.terra_user_id))
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                  >Desconectar</button>
                </div>
              ) : (
                <button
                  onClick={() => { window.location.href = `/api/integraciones/terra/widget?codigo=${codigo}&provider=WHOOP` }}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >Conectar</button>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── COROS (via Terra) ────────────────────────────────────────────── */}
      {(() => {
        const connTerra = terraConexiones.find(c => c.provider.toUpperCase() === 'COROS')
        const connOAuth = getEstado('coros')
        const conn = connTerra ?? (connOAuth?.activa ? { terra_user_id: '', provider: 'COROS', ultima_sync: connOAuth.ultima_sync } : undefined)
        const isTerra = !!connTerra
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1A1A2E20' }}>
                  <CorosIcon size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text)]">COROS</span>
                    {conn ? <CheckCircle size={14} className="text-green-500" /> : <XCircle size={14} className="text-[var(--text-muted)]" />}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">Entrenos GPS, frecuencia cardíaca y recuperación</p>
                  {conn?.ultima_sync && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      Última sync: {new Date(conn.ultima_sync).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              {conn ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Activo</span>
                  <button
                    onClick={async () => {
                      if (!confirm('¿Desconectar COROS?')) return
                      if (isTerra && connTerra.terra_user_id) {
                        await fetch(`/api/integraciones/terra/disconnect?terra_user_id=${connTerra.terra_user_id}&codigo=${codigo}`, { method: 'DELETE' })
                        setTerraConexiones(prev => prev.filter(x => x.terra_user_id !== connTerra.terra_user_id))
                      } else {
                        await fetch(`/api/integraciones/coros/disconnect?cliente_id=${clienteId}`, { method: 'DELETE' })
                        setIntegraciones(prev => prev.filter(i => i.proveedor !== 'coros'))
                      }
                    }}
                    className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors"
                  >Desconectar</button>
                </div>
              ) : (
                <button
                  onClick={() => { window.location.href = `/api/integraciones/terra/widget?codigo=${codigo}&provider=COROS` }}
                  className="btn-primary text-xs px-3 py-1.5 shrink-0"
                >Conectar</button>
              )}
            </div>
          </div>
        )
      })()}

      <div className="card p-4 flex items-start gap-3" style={{ background: 'var(--surface)' }}>
        <Zap size={16} className="text-[var(--primary)] mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-medium text-[var(--text)]">¿Para qué sirve conectar mis apps?</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Tu coach recibe datos reales de actividad: pasos, calorías quemadas, HRV y carga de entrenamiento.
            Con estos datos el sistema ajusta automáticamente tus macros y detecta cuándo necesitas más o menos calorías según tu vida real.
          </p>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { Activity, Watch, Smartphone, Heart, Zap, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface IntegracionInfo {
  proveedor: string
  activa: boolean
  ultima_sync: string | null
  error_ultimo: string | null
}

const PROVEEDORES_CONFIG = [
  {
    key: 'strava',
    nombre: 'Strava',
    descripcion: 'Actividades de running, ciclismo y natación',
    icono: Activity,
    color: '#FC4C02',
    disponible: true,
  },
  {
    key: 'garmin',
    nombre: 'Garmin',
    descripcion: 'Pasos, HRV, sueño y carga de entrenamiento',
    icono: Watch,
    color: '#007CC3',
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
  {
    key: 'whoop',
    nombre: 'Whoop',
    descripcion: 'HRV, recuperación y strain diario',
    icono: Heart,
    color: '#111111',
    disponible: false, // pendiente aprobación partner
  },
]

interface Props {
  codigo: string
  clienteId: string
}

export default function IntegracionesPanel({ codigo, clienteId }: Props) {
  const [integraciones, setIntegraciones] = useState<IntegracionInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/${codigo}/integraciones`)
      .then(r => r.json())
      .then(d => setIntegraciones(d.integraciones ?? []))
      .finally(() => setLoading(false))
  }, [codigo])

  const getEstado = (key: string) => integraciones.find(i => i.proveedor === key)

  const handleConnect = (proveedor: string) => {
    window.location.href = `/api/integraciones/${proveedor}/connect?cliente_id=${clienteId}`
  }

  const handleDisconnect = async (proveedor: string) => {
    if (!confirm(`¿Desconectar ${proveedor}?`)) return
    await fetch(`/api/integraciones/${proveedor}/disconnect?cliente_id=${clienteId}`, { method: 'DELETE' })
    setIntegraciones(prev => prev.filter(i => i.proveedor !== proveedor))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="animate-spin text-[var(--primary)]" size={24} />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h2 className="text-base font-bold text-[var(--text)]">Mis apps y dispositivos</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Conecta tus apps para que tu coach tenga datos más precisos y tus planes se adapten mejor a tu actividad real.
        </p>
      </div>

      {PROVEEDORES_CONFIG.map(({ key, nombre, descripcion, icono: Icono, color, disponible }) => {
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
                <Icono size={20} style={{ color }} />
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

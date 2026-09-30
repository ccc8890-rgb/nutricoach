'use client'

import { useEffect, useState } from 'react'
import { CaretDown, CheckCircle, Clock, Pulse, WarningCircle } from '@phosphor-icons/react'
import { formatearDuracionEjecucion, type AgenteEjecucion } from '@/lib/agentes/ejecuciones'

const ESTADOS = {
  ejecutando: { label: 'En curso', color: 'var(--info)', bg: 'var(--info-bg)' },
  completado: { label: 'Completado', color: 'var(--success)', bg: 'var(--success-bg)' },
  completado_con_errores: { label: 'Con errores', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  fallido: { label: 'Fallido', color: 'var(--error)', bg: 'var(--error-bg)' },
} as const

export default function HistorialEjecucionesAgentes({ refreshKey }: { refreshKey: number }) {
  const [ejecuciones, setEjecuciones] = useState<AgenteEjecucion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch('/api/agentes/ejecuciones?limite=10')
      .then(async res => {
        if (!res.ok) throw new Error('Error cargando ejecuciones')
        return res.json()
      })
      .then(data => {
        if (active) setEjecuciones(data.ejecuciones ?? [])
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [refreshKey])

  return (
    <details className="group rounded-3xl mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <summary className="list-none cursor-pointer flex items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Pulse size={19} weight="duotone" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-sm sm:text-base" style={{ color: 'var(--text)' }}>Actividad del director</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>Últimas ejecuciones automáticas y manuales</p>
          </div>
        </div>
        <CaretDown size={18} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: 'var(--text-muted)' }} />
      </summary>

      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        {loading ? (
          <div className="h-20 skeleton rounded-2xl" />
        ) : error ? (
          <p className="rounded-2xl p-4 text-sm" style={{ color: 'var(--error)', background: 'var(--error-bg)' }}>No se pudo cargar el historial.</p>
        ) : ejecuciones.length === 0 ? (
          <p className="rounded-2xl p-4 text-sm text-center" style={{ color: 'var(--text-muted)', background: 'var(--bg-subtle)' }}>Todavía no hay ejecuciones registradas.</p>
        ) : (
          <div className="grid gap-2">
            {ejecuciones.map(ejecucion => {
              const estado = ESTADOS[ejecucion.estado]
              return (
                <article key={ejecucion.id} className="rounded-2xl p-3 sm:p-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {ejecucion.estado === 'completado' ? <CheckCircle size={20} weight="fill" style={{ color: estado.color }} /> : <WarningCircle size={20} weight="fill" style={{ color: estado.color }} />}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-bold capitalize" style={{ color: 'var(--text)' }}>{ejecucion.modo}</span>
                          {ejecucion.dry_run && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-hover)', color: 'var(--text-muted)' }}>Simulación</span>}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: estado.bg, color: estado.color }}>{estado.label}</span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {new Date(ejecucion.iniciado_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} · {ejecucion.origen === 'cron' ? 'Automática' : ejecucion.origen === 'manual' ? 'Manual' : 'Sistema'}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-5 text-center sm:text-right">
                      <Dato label="Clientes" value={ejecucion.clientes_procesados} />
                      <Dato label="Acciones" value={ejecucion.tareas_generadas} />
                      <Dato label="Duración" value={formatearDuracionEjecucion(ejecucion.duracion_ms)} icon />
                    </div>
                  </div>
                  {ejecucion.errores.length > 0 && <p className="text-xs mt-3 pt-3" style={{ color: 'var(--error)', borderTop: '1px solid var(--border)' }}>{ejecucion.errores.join(' · ')}</p>}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </details>
  )
}

function Dato({ label, value, icon = false }: { label: string; value: string | number; icon?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xs sm:text-sm font-black mt-0.5 flex items-center justify-center sm:justify-end gap-1" style={{ color: 'var(--text)' }}>
        {icon && <Clock size={12} />}{value}
      </p>
    </div>
  )
}

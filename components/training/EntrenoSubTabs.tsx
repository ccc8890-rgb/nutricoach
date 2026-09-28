'use client'
import { useEffect, useState } from 'react'
import { ChevronDown, Dumbbell, Footprints, Loader2, CheckCircle2, CircleDashed } from 'lucide-react'
import CalendarioMesEntreno from './CalendarioMesEntreno'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios_count: number
  tipo_sesion: 'hibrido' | 'carrera' | 'mixto'
  fecha: string
  registros_count: number
  completada: boolean
  esHoy: boolean
}

function iconoTipo(tipo: SesionSemana['tipo_sesion'], size = 16) {
  return tipo === 'carrera' ? <Footprints size={size} /> : <Dumbbell size={size} />
}

export default function EntrenoSubTabs({ planNombre }: { planId: string; planNombre: string }) {
  const [subTab, setSubTab] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  const [sesiones, setSesiones] = useState<SesionSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [bloque, setBloque] = useState<{ fase: string; semana_actual: number; semanas_totales: number } | null>(null)
  const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/entrenos/semana-completa')
      .then(r => r.ok ? r.json() : { sesiones: [] })
      .then(data => {
        setSesiones(data.sesiones ?? [])
        setBloque(data.bloque ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  async function cargarDetalle(sesionId: string) {
    if (detalles[sesionId] && detalles[sesionId] !== 'cargando') return
    setDetalles(prev => ({ ...prev, [sesionId]: 'cargando' }))
    try {
      const res = await fetch(`/api/cliente/sesion/${sesionId}`)
      const data = await res.json()
      setDetalles(prev => ({ ...prev, [sesionId]: data.sesion?.ejercicios ?? [] }))
    } catch {
      setDetalles(prev => ({ ...prev, [sesionId]: [] }))
    }
  }

  function toggleExpandido(sesionId: string) {
    const next = expandido === sesionId ? null : sesionId
    setExpandido(next)
    if (next) cargarDetalle(next)
  }

  const sesionHoy = sesiones.find(s => s.esHoy)

  useEffect(() => {
    if (subTab === 'hoy' && sesionHoy) cargarDetalle(sesionHoy.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, sesionHoy?.id])

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-bold" style={{ color: 'var(--text)' }}>{planNombre}</p>
        {bloque && (
          <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--accent)' }}>
            Bloque {bloque.fase} · Semana {bloque.semana_actual}/{bloque.semanas_totales}
          </p>
        )}
      </div>

      <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
        {(['hoy', 'semana', 'mes'] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setSubTab(t)}
            className="flex-1 py-2.5 text-sm font-semibold capitalize transition-colors"
            style={{
              background: subTab === t ? 'var(--primary)' : 'transparent',
              color: subTab === t ? 'var(--bg)' : 'var(--text-muted)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : subTab === 'hoy' ? (
        sesionHoy ? (
          <div className="rounded-3xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                style={{ background: sesionHoy.tipo_sesion === 'carrera' ? 'var(--semantic-info-bg)' : 'rgba(99,102,241,0.12)' }}
              >
                {iconoTipo(sesionHoy.tipo_sesion, 18)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Hoy · {sesionHoy.dia_semana}</p>
                <p className="font-bold leading-tight" style={{ color: 'var(--text)' }}>{sesionHoy.nombre}</p>
              </div>
            </div>
            {sesionHoy.contexto_ia && (
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{sesionHoy.contexto_ia}</p>
            )}
            <div className="mt-3">
              {detalles[sesionHoy.id] === 'cargando' ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
              ) : (
                <ListaEjerciciosExpandible ejercicios={(detalles[sesionHoy.id] as EjercicioDetalle[]) ?? []} />
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl p-8 flex flex-col items-center gap-2 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <CircleDashed size={22} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Hoy toca descanso</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No hay sesión programada para hoy.</p>
          </div>
        )
      ) : subTab === 'semana' ? (
        <div className="flex flex-col gap-2">
          {sesiones.map(s => {
            const abierto = expandido === s.id
            return (
              <div key={s.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => toggleExpandido(s.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: s.completada ? 'var(--semantic-active-bg)' : s.esHoy ? 'var(--accent-bg, rgba(232,232,240,0.1))' : 'var(--bg)' }}
                  >
                    {s.completada ? <CheckCircle2 size={16} style={{ color: 'var(--semantic-active)' }} /> : iconoTipo(s.tipo_sesion, 16)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: s.esHoy ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {s.dia_semana}{s.esHoy ? ' · Hoy' : ''}
                    </p>
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{s.nombre}</p>
                  </div>
                  <p className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{s.ejercicios_count} ej.</p>
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: abierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {abierto && (
                  <div className="px-4 pb-4">
                    {s.contexto_ia && <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{s.contexto_ia}</p>}
                    {detalles[s.id] === 'cargando' ? (
                      <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    ) : (
                      <ListaEjerciciosExpandible ejercicios={(detalles[s.id] as EjercicioDetalle[]) ?? []} />
                    )}
                  </div>
                )}
              </div>
            )
          })}
          {sesiones.length === 0 && (
            <div className="rounded-3xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach todavía no ha cargado sesiones para esta semana.</p>
            </div>
          )}
        </div>
      ) : (
        <CalendarioMesEntreno mostrarToggleSemanaMes={false} />
      )}
    </div>
  )
}

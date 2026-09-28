'use client'
import { useEffect, useState } from 'react'
import { Dumbbell, Footprints, Loader2, CircleDashed } from 'lucide-react'
import CalendarioMesEntreno from './CalendarioMesEntreno'
import EntrenoKanban from './EntrenoKanban'
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
        sesiones.length > 0 ? (
          <EntrenoKanban sesiones={sesiones} />
        ) : (
          <div className="rounded-3xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu coach todavía no ha cargado sesiones para esta semana.</p>
          </div>
        )
      ) : (
        <CalendarioMesEntreno mostrarToggleSemanaMes={false} />
      )}
    </div>
  )
}

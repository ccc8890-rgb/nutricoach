'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { fetchJson } from '@/lib/cliente/cache-swr'
import { Dumbbell, Loader2, CircleDashed } from 'lucide-react'
import { SneakerMove } from '@phosphor-icons/react'
import CalendarioMesEntreno from './CalendarioMesEntreno'
import EntrenoKanban from './EntrenoKanban'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'
import { EditorialMasthead, IndustrialTabs } from '@/components/PortalCliente/editorial'

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
  return tipo === 'carrera' ? <SneakerMove size={size} weight="regular" /> : <Dumbbell size={size} />
}

export default function EntrenoSubTabs({ planNombre }: { planId: string; planNombre: string }) {
  const [subTab, setSubTab] = useState<'hoy' | 'semana' | 'mes'>('hoy')
  // Datos desde la caché compartida (precargada por el portal): sin espera al abrir la pestaña.
  const { data: semana, isLoading } = useSWR<{
    sesiones?: SesionSemana[]
    bloque?: { fase: string; semana_actual: number; semanas_totales: number } | null
  }>('/api/entrenos/semana-completa', fetchJson)
  const sesiones = semana?.sesiones ?? []
  const bloque = semana?.bloque ?? null
  const loading = isLoading && !semana
  const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})

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
      <EditorialMasthead
        index="02 / TRAIN"
        eyebrow={bloque ? `Bloque ${bloque.fase} · Semana ${bloque.semana_actual}/${bloque.semanas_totales}` : 'Plan de entrenamiento'}
        title={planNombre}
        meta="SESIÓN / CARGA / EJECUCIÓN"
      />

      <IndustrialTabs
        ariaLabel="Vista del entrenamiento"
        activeKey={subTab}
        items={[{ key: 'hoy', label: 'Hoy' }, { key: 'semana', label: 'Semana' }, { key: 'mes', label: 'Mes' }]}
        onChange={setSubTab}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : subTab === 'hoy' ? (
        sesionHoy ? (
          <section className="training-sheet">
            <div className="flex items-center gap-3">
              <div className="training-session-mark">
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
          </section>
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

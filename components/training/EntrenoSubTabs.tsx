'use client'
import { useEffect, useState } from 'react'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import useSWR from 'swr'
import { fetchJson } from '@/lib/cliente/cache-swr'
import { Dumbbell, Loader2, CircleDashed } from 'lucide-react'
import { SneakerMove } from '@phosphor-icons/react'
import CalendarioMesEntreno from './CalendarioMesEntreno'
import TuBloque from './TuBloque'
import CierreBloque from './CierreBloque'
import type { TuBloque as TuBloqueDatos } from '@/lib/entrenos/tu-bloque'
import EntrenoKanban from './EntrenoKanban'
import { textoKm } from '@/lib/entrenos/km-sesion'
import ListaEjerciciosExpandible, { type EjercicioDetalle } from './ExpandableExercises'
import CompartirSesion from './CompartirSesion'
import { dibujarTarjeta, ejerciciosPrincipales } from '@/lib/entrenos/tarjeta-story'
import PasosSesion, { extrasDeRespuesta, type ExtrasSesion } from './PasosSesion'
import { EditorialMasthead, IndustrialTabs } from '@/components/PortalCliente/editorial'
import { buildExerciseChecklistKey } from '@/lib/training/exercise-checklist'
import { etiquetaTipoSesion, tituloSesionSinModalidad } from '@/lib/training/session-type-presentation'

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios_count: number
  km?: number | null
  tipo_sesion: 'hibrido' | 'carrera' | 'mixto'
  fecha: string
  registros_count: number
  completada: boolean
  esHoy: boolean
}

function iconoTipo(tipo: SesionSemana['tipo_sesion'], size = 16) {
  return tipo === 'carrera' ? <SneakerMove size={size} weight="regular" /> : <Dumbbell size={size} />
}

const fechaLocalHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function EntrenoSubTabs({ planNombre }: { planId: string; planNombre: string }) {
  const [subTab, setSubTab] = useEstadoUrl<'hoy' | 'semana' | 'mes'>('et', 'hoy', ['hoy', 'semana', 'mes'])
  // Datos desde la caché compartida (precargada por el portal): sin espera al abrir la pestaña.
  const { data: semana, isLoading } = useSWR<{
    sesiones?: SesionSemana[]
    bloque?: { fase: string; semana_actual: number; semanas_totales: number } | null
    tu_bloque?: TuBloqueDatos | null
  }>('/api/entrenos/semana-completa', fetchJson)
  const sesiones = semana?.sesiones ?? []
  const bloque = semana?.bloque ?? null
  const tuBloque = semana?.tu_bloque ?? null
  const loading = isLoading && !semana
  const [detalles, setDetalles] = useState<Record<string, EjercicioDetalle[] | 'cargando'>>({})
  const [extras, setExtras] = useState<Record<string, ExtrasSesion | null>>({})

  async function cargarDetalle(sesionId: string) {
    if (detalles[sesionId] && detalles[sesionId] !== 'cargando') return
    setDetalles(prev => ({ ...prev, [sesionId]: 'cargando' }))
    try {
      const res = await fetch(`/api/cliente/sesion/${sesionId}?fecha=${fechaLocalHoy()}`)
      const data = await res.json()
      setDetalles(prev => ({ ...prev, [sesionId]: data.sesion?.ejercicios ?? [] }))
      setExtras(prev => ({ ...prev, [sesionId]: extrasDeRespuesta(data.sesion) }))
    } catch {
      setDetalles(prev => ({ ...prev, [sesionId]: [] }))
    }
  }

  const sesionesHoy = sesiones.filter(s => s.esHoy)
  const idsHoy = sesionesHoy.map(s => s.id).join(',')

  useEffect(() => {
    if (subTab === 'hoy') idsHoy.split(',').filter(Boolean).forEach(id => cargarDetalle(id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, idsHoy])

  return (
    <div className="flex flex-col gap-4">
      <EditorialMasthead
        index="04 / TRAIN"
        eyebrow={bloque ? `Bloque ${bloque.fase} · Semana ${bloque.semana_actual}/${bloque.semanas_totales}` : 'Plan de entrenamiento'}
        title={planNombre}
      />

      {!loading && tuBloque && <TuBloque datos={tuBloque} fase={bloque?.fase} semanaActual={bloque?.semana_actual} semanasTotales={bloque?.semanas_totales} />}

      <CierreBloque />

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
        sesionesHoy.length > 0 ? (
          <div className="flex flex-col gap-4">
            {sesionesHoy.map((sesionDia, i) => (
          <section key={sesionDia.id} className="training-sheet">
            <div className="flex items-center gap-3">
              <div className="training-session-mark">
                {iconoTipo(sesionDia.tipo_sesion, 18)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Hoy · {sesionDia.dia_semana}{sesionesHoy.length > 1 ? ` · sesión ${i + 1} de ${sesionesHoy.length}` : ''}</p>
                <p className="mt-2 font-mono text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>
                  {etiquetaTipoSesion(sesionDia.tipo_sesion)}
                </p>
                <p className="mt-1 font-bold leading-tight" style={{ color: 'var(--text)' }}>
                  {tituloSesionSinModalidad(sesionDia.nombre, sesionDia.tipo_sesion)}
                </p>
                {textoKm(sesionDia.km) && <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{textoKm(sesionDia.km)}</p>}
                {Array.isArray(detalles[sesionDia.id]) && (
                  <CompartirSesion generar={(tema) => dibujarTarjeta({
                    fecha: sesionDia.fecha,
                    tipo: etiquetaTipoSesion(sesionDia.tipo_sesion),
                    titulo: tituloSesionSinModalidad(sesionDia.nombre, sesionDia.tipo_sesion),
                    semana: bloque ? `SEMANA ${bloque.semana_actual}/${bloque.semanas_totales}` : null,
                    duracionMin: sesionDia.duracion_estimada_min,
                    km: sesionDia.km,
                    ejercicios: ejerciciosPrincipales((detalles[sesionDia.id] as EjercicioDetalle[]).map(e => ({
                      nombre: e.ejercicio?.nombre ?? '', series: e.series, repeticiones: e.repeticiones, peso: e.peso_sugerido, bloque: e.bloque,
                    })).filter(e => e.nombre)),
                  }, tema)} />
                )}
              </div>
            </div>
            {sesionDia.contexto_ia && (
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{sesionDia.contexto_ia}</p>
            )}
            <div className="mt-3">
              {detalles[sesionDia.id] === 'cargando' ? (
                <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
              ) : (
                <>
                  {extras[sesionDia.id] && <PasosSesion sesionId={sesionDia.id} {...extras[sesionDia.id]!} />}
                  <ListaEjerciciosExpandible
                    ejercicios={(detalles[sesionDia.id] as EjercicioDetalle[]) ?? []}
                    checklistKey={buildExerciseChecklistKey(sesionDia.id)}
                  />
                </>
              )}
            </div>
          </section>
            ))}
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

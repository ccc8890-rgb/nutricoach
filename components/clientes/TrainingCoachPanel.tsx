'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  CheckCircle2,
  Dumbbell,
  Loader2,
  RefreshCw,
  Route,
  Target,
  Zap,
} from 'lucide-react'

type Tone = 'critico' | 'atencion' | 'ok' | 'neutro'

interface TrainingOSData {
  perfil: {
    sport_modality?: string
    objetivo_especifico?: string
    nivel?: string
    dias_disponibles?: number
    capacidad_recuperacion?: string
    respuesta_a_volumen?: string
    respuesta_psicologica?: string
    ftp_watts?: number
    vdot?: number
    vo2max_estimado?: number
    rm_sentadilla_kg?: number
    rm_banca_kg?: number
    rm_peso_muerto_kg?: number
    dominadas_max_reps?: number
  } | null
  plan: {
    id: string
    nombre: string
    duracion_semanas?: number | null
    sesiones_por_semana?: number | null
  } | null
  recomendacion: {
    tier: 'elite' | 'general'
    dias_semana: number
    intensidad: 'baja' | 'moderada' | 'alta'
    volumen: 'bajo' | 'medio' | 'alto'
    foco_principal: string
    advertencias: string[]
    ajustes_adicionales: string[]
  } | null
  actividad: {
    resumen: {
      tiene_datos: boolean
      sesiones: number
      tss_total: number
      tdee_media: number | null
      hrv_media: number | null
      readiness_media: number | null
      pasos_media: number
      distancia_entreno_km_total: number
    }
    flags: Array<{ tipo: string; severidad: 'alta' | 'media' | 'baja'; titulo: string; accion: string }>
  } | null
  rendimiento: {
    sesiones_7d: number
    sesiones_28d: number
    sesiones_objetivo_semana: number | null
    adherencia_7d_pct: number | null
    rpe_media_7d: number | null
  }
  decisiones: Array<{ titulo: string; detalle: string; tono: Tone }>
  tareas_pendientes: Array<{ id: string; tipo: string; prioridad: number; propuesta: string }>
}

const MODALIDAD_LABEL: Record<string, string> = {
  gym_estetica: 'Gimnasio estética',
  gym_fuerza: 'Gimnasio fuerza',
  funcional: 'Funcional',
  hyrox: 'Hyrox',
  ciclismo: 'Ciclismo',
  running: 'Running',
  hibrido: 'Híbrido',
  calistenia: 'Calistenia',
  natacion: 'Natación',
  triatlon: 'Triatlón',
}

function toneStyle(tone: Tone) {
  if (tone === 'critico') return { border: 'rgba(239,68,68,0.35)', bg: 'rgba(239,68,68,0.08)', fg: 'rgb(248,113,113)' }
  if (tone === 'atencion') return { border: 'rgba(245,158,11,0.35)', bg: 'rgba(245,158,11,0.08)', fg: 'rgb(245,158,11)' }
  if (tone === 'ok') return { border: 'rgba(34,197,94,0.35)', bg: 'rgba(34,197,94,0.08)', fg: 'rgb(34,197,94)' }
  return { border: 'var(--border)', bg: 'var(--surface)', fg: 'var(--text-muted)' }
}

function metricLabel(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) return 'Sin dato'
  return `${value}${suffix}`
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums leading-none" style={{ color: 'var(--text)' }}>{value}</p>
    </div>
  )
}

export default function TrainingCoachPanel({ clienteId }: { clienteId: string }) {
  const [data, setData] = useState<TrainingOSData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analizando, setAnalizando] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/training-os`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'No se pudo cargar training OS')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar training OS')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId])

  const healthTone = useMemo<Tone>(() => {
    if (!data) return 'neutro'
    if (data.decisiones.some(d => d.tono === 'critico')) return 'critico'
    if (data.decisiones.some(d => d.tono === 'atencion')) return 'atencion'
    return 'ok'
  }, [data])

  async function analizar() {
    setAnalizando(true)
    setError(null)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/training-os/analizar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semanal: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'No se pudo ejecutar el análisis')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo ejecutar el análisis')
    } finally {
      setAnalizando(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl p-4 sm:p-5 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="h-5 w-44 rounded-lg mb-4" style={{ background: 'var(--border)' }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl" style={{ background: 'var(--bg)' }} />)}
        </div>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>No se pudo cargar entrenamiento.</p>
        {error && <p className="text-xs mt-1" style={{ color: 'rgb(248,113,113)' }}>{error}</p>}
      </section>
    )
  }

  const tone = toneStyle(healthTone)
  const modalidad = data.perfil?.sport_modality ? MODALIDAD_LABEL[data.perfil.sport_modality] ?? data.perfil.sport_modality : 'Sin modalidad'
  const resumen = data.actividad?.resumen
  const ready = resumen?.readiness_media ?? null
  const hrv = resumen?.hrv_media ?? null

  return (
    <section className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="p-4 sm:p-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Brain size={16} style={{ color: tone.fg }} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>Training OS</span>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold leading-tight" style={{ color: 'var(--text)' }}>
              Decisiones de entrenamiento, carga y recuperación
            </h3>
            <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              Vista de trabajo para programar running, Hyrox, fuerza o disciplinas híbridas usando perfil atleta, ejecución real y datos externos.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary btn-sm" onClick={load}>
              <RefreshCw size={13} /> Actualizar
            </button>
            <button className="btn-primary btn-sm" onClick={analizar} disabled={analizando}>
              {analizando ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              Analizar con IA
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(248,113,113)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-4 p-4 sm:p-5">
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Metric label="Disciplina" value={modalidad} icon={Route} />
            <Metric label="Semana" value={`${data.rendimiento.sesiones_7d}/${data.rendimiento.sesiones_objetivo_semana ?? '-'} sesiones`} icon={Dumbbell} />
            <Metric label="Readiness" value={metricLabel(ready, ready !== null ? '/100' : '')} icon={Activity} />
            <Metric label="HRV" value={metricLabel(hrv, hrv !== null ? ' ms' : '')} icon={BarChart3} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                {healthTone === 'ok' ? <CheckCircle2 size={15} style={{ color: tone.fg }} /> : <AlertTriangle size={15} style={{ color: tone.fg }} />}
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Prioridad del coach</p>
              </div>
              <div className="space-y-3">
                {data.decisiones.map((decision, index) => {
                  const itemTone = toneStyle(decision.tono)
                  return (
                    <div key={`${decision.titulo}-${index}`} className="pl-3" style={{ borderLeft: `2px solid ${itemTone.fg}` }}>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{decision.titulo}</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{decision.detalle}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <Target size={15} style={{ color: 'rgb(201,169,110)' }} />
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Motor de programación</p>
              </div>
              {data.recomendacion ? (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{data.recomendacion.foco_principal}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(201,169,110,0.12)', color: 'rgb(201,169,110)' }}>{data.recomendacion.tier}</span>
                    <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }}>{data.recomendacion.volumen} volumen</span>
                    <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }}>{data.recomendacion.intensidad}</span>
                    <span className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }}>{data.recomendacion.dias_semana} d/sem</span>
                  </div>
                  {[...data.recomendacion.advertencias, ...data.recomendacion.ajustes_adicionales].slice(0, 3).map((item, index) => (
                    <p key={index} className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Completa el perfil atleta para activar recomendaciones de modalidad, volumen, intensidad y filtros de plantilla.
                </p>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Lectura rápida</p>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="TSS 14d" value={metricLabel(resumen?.tss_total)} icon={Zap} />
              <Metric label="TDEE medio" value={metricLabel(resumen?.tdee_media, resumen?.tdee_media ? ' kcal' : '')} icon={BarChart3} />
              <Metric label="Pasos/día" value={metricLabel(resumen?.pasos_media)} icon={Activity} />
              <Metric label="Distancia" value={metricLabel(resumen?.distancia_entreno_km_total, resumen?.distancia_entreno_km_total ? ' km' : '')} icon={Route} />
            </div>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Agentes pendientes</p>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{data.tareas_pendientes.length}</span>
            </div>
            {data.tareas_pendientes.length ? (
              <div className="space-y-2">
                {data.tareas_pendientes.slice(0, 3).map(tarea => (
                  <div key={tarea.id} className="rounded-lg p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: 'var(--text-muted)' }}>{tarea.tipo.replaceAll('_', ' ')}</p>
                    <p className="text-xs leading-relaxed line-clamp-3" style={{ color: 'var(--text)' }}>{tarea.propuesta}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                No hay tareas pendientes de entrenamiento. Puedes lanzar el análisis cuando haya nuevos datos de Garmin, Strava o registros internos.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

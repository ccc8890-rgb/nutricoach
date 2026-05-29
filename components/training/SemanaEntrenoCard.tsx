'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Dumbbell, Zap, CheckCircle2, Loader2, Play } from 'lucide-react'
import Link from 'next/link'
import { getRecomendacionDescanso } from '@/lib/entrenos/descanso'

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  ejercicios_count: number
  duracion_estimada_min?: number
  contexto_ia?: string | null
}

interface SemanaEntrenoCardProps {
  planId: string
  planNombre: string
}

const DIA_ORDER: Record<string, number> = {
  Lunes: 1, Martes: 2, Miércoles: 3, Jueves: 4,
  Viernes: 5, Sábado: 6, Domingo: 7,
}
const DIA_ABR: Record<string, string> = {
  Lunes: 'L', Martes: 'M', Miércoles: 'X', Jueves: 'J',
  Viernes: 'V', Sábado: 'S', Domingo: 'D',
}
const TODAY_NAME = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()]

export default function SemanaEntrenoCard({ planId, planNombre }: SemanaEntrenoCardProps) {
  const [sesiones, setSesiones] = useState<SesionSemana[]>([])
  const [loading, setLoading] = useState(true)
  const [completadasHoy, setCompletadasHoy] = useState<Set<string>>(new Set())
  const [completandoId, setCompletandoId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('sesiones_entrenamiento')
        .select('id, nombre, dia_semana, orden, duracion_estimada_min, contexto_ia, ejercicios:sesion_ejercicios(id)')
        .eq('plan_id', planId)
        .order('orden')

      if (data) {
        setSesiones(
          data.map(s => ({
            id: s.id,
            nombre: s.nombre,
            dia_semana: s.dia_semana ?? '',
            orden: s.orden,
            ejercicios_count: Array.isArray(s.ejercicios) ? s.ejercicios.length : 0,
            duracion_estimada_min: s.duracion_estimada_min ?? undefined,
            contexto_ia: (s as { contexto_ia?: string }).contexto_ia ?? null,
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [planId])

  // Fetch today's completions
  useEffect(() => {
    async function fetchEstado() {
      try {
        const res = await fetch(`/api/entrenos/estado-sesiones?plan_id=${planId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.completadas_hoy) {
          setCompletadasHoy(new Set(data.completadas_hoy))
        }
      } catch {
        // silent
      }
    }
    if (planId) fetchEstado()
  }, [planId])

  async function completarSesion(sesionId: string) {
    setCompletandoId(sesionId)
    try {
      const res = await fetch('/api/entrenos/completar-sesion-rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('[completar]', err)
        return
      }
      const data = await res.json()
      if (data.ok) {
        setCompletadasHoy(prev => new Set(prev).add(sesionId))
      }
    } catch {
      // silent
    } finally {
      setCompletandoId(null)
    }
  }

  if (loading) return (
    <div className="rounded-2xl p-4 animate-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="h-4 w-40 rounded mb-3" style={{ background: 'rgba(128,128,128,0.15)' }} />
      <div className="flex gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-9 h-9 rounded-full" style={{ background: 'rgba(128,128,128,0.15)' }} />
        ))}
      </div>
    </div>
  )

  if (!sesiones.length) return null

  // Sort by day order, fallback to orden field
  const sesionesOrdenadas = [...sesiones].sort((a, b) => {
    const da = DIA_ORDER[a.dia_semana] ?? a.orden + 10
    const db = DIA_ORDER[b.dia_semana] ?? b.orden + 10
    return da - db
  })

  const todaySession = sesionesOrdenadas.find(s => s.dia_semana === TODAY_NAME)
  const nextSession = todaySession ?? sesionesOrdenadas[0]
  const nextSessionCompleted = nextSession ? completadasHoy.has(nextSession.id) : false

  // Days that have a session this week
  const diasConSesion = new Set(sesionesOrdenadas.map(s => s.dia_semana))

  // Day dot color: check if completed
  function dayDotStyle(dia: string) {
    const hasSesion = diasConSesion.has(dia)
    const isToday = dia === TODAY_NAME
    const sesionDelDia = sesionesOrdenadas.find(s => s.dia_semana === dia)
    const estaCompletada = sesionDelDia ? completadasHoy.has(sesionDelDia.id) : false

    if (isToday && hasSesion && estaCompletada) {
      return { background: 'rgba(72,199,142,0.2)', color: '#48C78E' }
    }
    if (isToday && hasSesion) {
      return { background: 'rgb(168,85,247)', color: 'white' }
    }
    if (hasSesion && estaCompletada) {
      return { background: 'rgba(72,199,142,0.15)', color: '#48C78E' }
    }
    if (hasSesion) {
      return { background: 'rgba(168,85,247,0.15)', color: 'rgb(192,132,252)' }
    }
    return { background: 'rgba(128,128,128,0.08)', color: 'var(--text-muted)' }
  }

  function dayDotIcon(dia: string) {
    const sesionDelDia = sesionesOrdenadas.find(s => s.dia_semana === dia)
    if (!sesionDelDia) return null
    if (completadasHoy.has(sesionDelDia.id)) {
      return <CheckCircle2 size={12} style={{ color: '#48C78E' }} />
    }
    return null
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header strip */}
      <div
        className="px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.15)' }}
          >
            <Dumbbell size={14} style={{ color: 'rgb(168,85,247)' }} />
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{planNombre}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {sesionesOrdenadas.length} sesión{sesionesOrdenadas.length !== 1 ? 'es' : ''} / semana
              {completadasHoy.size > 0 && ` · ${completadasHoy.size} hecha${completadasHoy.size !== 1 ? 's' : ''} hoy`}
            </p>
          </div>
        </div>
      </div>

      {/* Day dots row */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          {(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const).map(dia => {
            const hasSesion = diasConSesion.has(dia)
            const isToday = dia === TODAY_NAME
            const sesionDelDia = sesionesOrdenadas.find(s => s.dia_semana === dia)
            const estaCompletada = sesionDelDia ? completadasHoy.has(sesionDelDia.id) : false
            return (
              <div
                key={dia}
                className="flex flex-col items-center gap-1"
                style={{ flex: 1 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                  style={dayDotStyle(dia)}
                  title={hasSesion ? sesionDelDia?.nombre : 'Descanso'}
                >
                  {estaCompletada ? <CheckCircle2 size={14} /> : DIA_ABR[dia]}
                </div>
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: hasSesion ? 'rgba(168,85,247,0.5)' : 'transparent' }}
                />
              </div>
            )
          })}
        </div>
        <p className="text-[10px] mb-3" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: 'rgb(192,132,252)' }}>●</span> Entreno &nbsp;
          <span style={{ color: 'rgba(128,128,128,0.5)' }}>●</span> Descanso &nbsp;
          <span style={{ color: '#48C78E' }}>✓</span> Completado
        </p>

        {/* Rest day mini panel — solo cuando hoy es día de descanso */}
        {!todaySession && (() => {
          const rec = getRecomendacionDescanso(sesionesOrdenadas.length, TODAY_NAME)
          return (
            <div
              className="rounded-xl px-3.5 py-2.5 mb-2 flex items-start gap-2.5"
              style={{
                background: 'rgba(128,128,128,0.06)',
                border: '1px solid rgba(128,128,128,0.12)',
              }}
            >
              <span className="text-base leading-tight flex-shrink-0 mt-0.5">{rec.icono}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text)' }}>
                  {rec.titulo}
                </p>
                <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                  {rec.consejo}
                </p>
              </div>
            </div>
          )
        })()}

        {/* Next session CTA */}
        {nextSession && (
          <div className="rounded-xl" style={{
            background: nextSessionCompleted ? 'rgba(72,199,142,0.08)' : 'rgba(168,85,247,0.1)',
            border: `1px solid ${nextSessionCompleted ? 'rgba(72,199,142,0.2)' : 'rgba(168,85,247,0.2)'}`,
          }}>
            {/* Session info row */}
            <Link
              href={`/cliente/sesion/${nextSession.id}`}
              className="flex items-center gap-3 px-3.5 pt-3 pb-2 transition-opacity hover:opacity-80"
            >
              <div
                className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
                style={{ background: nextSessionCompleted ? 'rgba(72,199,142,0.2)' : 'rgba(168,85,247,0.2)' }}
              >
                {nextSessionCompleted ? (
                  <CheckCircle2 size={16} style={{ color: '#48C78E' }} />
                ) : (
                  <Zap size={16} style={{ color: 'rgb(192,132,252)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                  {nextSession.nombre}
                </p>
                {nextSession.contexto_ia && (
                  <p
                    className="text-[11px] mt-0.5 leading-snug"
                    style={{ color: 'var(--text-muted)', opacity: 0.75 }}
                  >
                    {nextSession.contexto_ia.length > 80
                      ? nextSession.contexto_ia.slice(0, 80) + '…'
                      : nextSession.contexto_ia}
                  </p>
                )}
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {nextSession.dia_semana || 'Sesión'}
                  {nextSession.ejercicios_count > 0 && ` · ${nextSession.ejercicios_count} ej.`}
                  {nextSession.duracion_estimada_min && ` · ${nextSession.duracion_estimada_min} min`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {nextSessionCompleted ? (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: 'rgba(72,199,142,0.15)', color: '#48C78E' }}
                  >
                    <CheckCircle2 size={11} />
                    Hecha
                  </span>
                ) : nextSession.dia_semana === TODAY_NAME ? (
                  <span
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(168,85,247,0.9)', color: 'white' }}
                  >
                    <Play size={11} />
                    Empezar
                  </span>
                ) : (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(168,85,247,0.2)', color: 'rgb(192,132,252)' }}
                  >
                    Iniciar
                  </span>
                )}
                <ChevronRight size={14} style={{ color: nextSessionCompleted ? 'rgba(72,199,142,0.5)' : 'rgba(168,85,247,0.7)' }} />
              </div>
            </Link>

            {/* Quick-complete button for next session (only if not completed and has exercises) */}
            {!nextSessionCompleted && nextSession.ejercicios_count > 0 && (
              <div className="px-3.5 pb-3 pt-1">
                <button
                  onClick={() => completarSesion(nextSession.id)}
                  disabled={completandoId === nextSession.id}
                  className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-medium transition-all active:scale-[0.98]"
                  style={{
                    background: 'transparent',
                    border: '1px dashed rgba(168,85,247,0.3)',
                    color: 'rgb(192,132,252)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(168,85,247,0.08)'
                      ; (e.currentTarget as HTMLButtonElement).style.border = '1px dashed rgba(168,85,247,0.5)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                      ; (e.currentTarget as HTMLButtonElement).style.border = '1px dashed rgba(168,85,247,0.3)'
                  }}
                >
                  {completandoId === nextSession.id ? (
                    <><Loader2 size={12} className="animate-spin" /> Completando…</>
                  ) : (
                    <><CheckCircle2 size={12} /> Completar sesión rápida</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* All sessions list */}
        {sesionesOrdenadas.length > 1 && (
          <div className="mt-2 flex flex-col gap-1">
            {sesionesOrdenadas.filter(s => s.id !== nextSession?.id).map(s => {
              const completada = completadasHoy.has(s.id)
              return (
                <div key={s.id} className="flex flex-col">
                  <Link
                    href={`/cliente/sesion/${s.id}`}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-opacity hover:opacity-70"
                    style={{ color: completada ? '#48C78E' : 'var(--text-muted)' }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        background: completada
                          ? 'rgba(72,199,142,0.15)'
                          : 'rgba(128,128,128,0.1)',
                      }}
                    >
                      {completada ? <CheckCircle2 size={12} /> : (DIA_ABR[s.dia_semana] ?? '?')}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm truncate" style={{ color: completada ? '#48C78E' : 'var(--text)' }}>
                        {s.nombre}
                        {completada && ' ✓'}
                      </span>
                      {s.contexto_ia && (
                        <span
                          className="block text-[11px] mt-0.5 leading-snug truncate"
                          style={{ color: 'var(--text-muted)', opacity: 0.75 }}
                        >
                          {s.contexto_ia.length > 80
                            ? s.contexto_ia.slice(0, 80) + '…'
                            : s.contexto_ia}
                        </span>
                      )}
                    </span>
                    {s.ejercicios_count > 0 && !completada && (
                      <span className="text-[11px]">{s.ejercicios_count} ej.</span>
                    )}
                    {completada && (
                      <span className="text-[10px] font-medium" style={{ color: '#48C78E' }}>Completada</span>
                    )}
                  </Link>

                  {/* Quick-complete for non-completed sessions */}
                  {!completada && s.ejercicios_count > 0 && (
                    <button
                      onClick={() => completarSesion(s.id)}
                      disabled={completandoId === s.id}
                      className="ml-9 mr-2 mb-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-lg font-medium transition-all active:scale-[0.98]"
                      style={{
                        background: 'rgba(128,128,128,0.04)',
                        border: '1px dashed rgba(128,128,128,0.2)',
                        color: 'var(--text-muted)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(168,85,247,0.06)'
                          ; (e.currentTarget as HTMLButtonElement).style.border = '1px dashed rgba(168,85,247,0.3)'
                          ; (e.currentTarget as HTMLButtonElement).style.color = 'rgb(192,132,252)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(128,128,128,0.04)'
                          ; (e.currentTarget as HTMLButtonElement).style.border = '1px dashed rgba(128,128,128,0.2)'
                          ; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'
                      }}
                    >
                      {completandoId === s.id ? (
                        <><Loader2 size={10} className="animate-spin" /> Completando…</>
                      ) : (
                        <><CheckCircle2 size={10} /> Completar</>
                      )}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

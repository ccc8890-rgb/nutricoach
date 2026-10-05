'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Dumbbell, Loader2 } from 'lucide-react'
import { DIAS_SEMANA_ORDEN } from '@/lib/entrenos/bloques'
import { useToast } from '@/components/ui/Toast'

const HOY_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date().getDay()]

interface Ejercicio {
  id: string
  series: number | null
  repeticiones: string | null
  descanso_segundos: number | null
  peso_sugerido: string | null
  rpe: string | null
  notas: string | null
  orden: number | null
  ejercicio: { nombre: string; grupo_muscular: string | null } | null
}

interface Sesion {
  id: string
  nombre: string
  dia_semana: string
  hora_inicio: string | null
  orden: number | null
  duracion_estimada_min: number | null
  contexto_ia: string | null
  ejercicios: Ejercicio[]
}

// Rutina real de la semana, plegable por día, en el primer plano de "Plan
// activo" — antes había que pulsar "Abrir plan" y salir a otra pantalla
// solo para ver qué toca hacer cada día.
export default function RutinaSemanaAccordion({ planId }: { planId: string }) {
  const [sesiones, setSesiones] = useState<Sesion[] | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [guardandoHora, setGuardandoHora] = useState<string | null>(null)
  const [guardandoDuracion, setGuardandoDuracion] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    let cancelado = false
    fetch(`/api/entrenos/${planId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelado) return
        const ses: Sesion[] = data.sesiones ?? []
        setSesiones(ses)
        setAbiertos(new Set(ses.filter(s => s.dia_semana === HOY_DIA).map(s => s.id)))
      })
      .catch(() => { if (!cancelado) setSesiones([]) })
    return () => { cancelado = true }
  }, [planId])

  function toggle(id: string) {
    setAbiertos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function guardarHora(sesion: Sesion, input: HTMLInputElement) {
    const nuevaHora = input.value || null
    if (nuevaHora === sesion.hora_inicio) return
    const anterior = sesion.hora_inicio
    setSesiones(prev => prev?.map(s => s.id === sesion.id ? { ...s, hora_inicio: nuevaHora } : s) ?? null)
    setGuardandoHora(sesion.id)
    const res = await fetch(`/api/entrenos/sesion/${sesion.id}/hora`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hora_inicio: nuevaHora }),
    }).catch(() => null)
    setGuardandoHora(null)
    if (!res?.ok) {
      input.value = anterior ?? ''
      setSesiones(prev => prev?.map(s => s.id === sesion.id ? { ...s, hora_inicio: anterior } : s) ?? null)
      addToast({ type: 'error', title: 'No se pudo guardar la hora', message: 'Se ha restaurado el valor anterior.' })
    }
  }

  async function guardarDuracion(sesion: Sesion, input: HTMLInputElement) {
    const nuevaDuracion = input.value === '' ? null : Number(input.value)
    if (nuevaDuracion === sesion.duracion_estimada_min) return
    const anterior = sesion.duracion_estimada_min
    setSesiones(prev => prev?.map(s => s.id === sesion.id ? { ...s, duracion_estimada_min: nuevaDuracion } : s) ?? null)
    setGuardandoDuracion(sesion.id)
    const res = await fetch(`/api/entrenos/sesion/${sesion.id}/hora`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duracion_estimada_min: nuevaDuracion }),
    }).catch(() => null)
    setGuardandoDuracion(null)
    if (!res?.ok) {
      input.value = anterior?.toString() ?? ''
      setSesiones(prev => prev?.map(s => s.id === sesion.id ? { ...s, duracion_estimada_min: anterior } : s) ?? null)
      addToast({ type: 'error', title: 'No se pudo guardar la duración', message: 'Se ha restaurado el valor anterior.' })
    }
  }

  if (sesiones === null) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  if (sesiones.length === 0) {
    return <p className="text-sm px-1" style={{ color: 'var(--text-muted)' }}>Sin sesiones programadas en el plan activo.</p>
  }

  const porDia = [...sesiones].sort((a, b) => (DIAS_SEMANA_ORDEN[a.dia_semana] ?? 99) - (DIAS_SEMANA_ORDEN[b.dia_semana] ?? 99))

  return (
    <div className="space-y-2">
      {porDia.map(sesion => {
        const abierto = abiertos.has(sesion.id)
        const esHoy = sesion.dia_semana === HOY_DIA
        return (
          <div key={sesion.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${esHoy ? 'var(--semantic-info-border)' : 'var(--border)'}`, background: esHoy ? 'var(--semantic-info-bg)' : 'var(--bg)' }}>
            <button
              onClick={() => toggle(sesion.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'var(--surface-elevated,var(--border))', color: esHoy ? 'var(--semantic-info-text)' : 'var(--text-muted)' }}>
                  {sesion.dia_semana.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="text-base font-semibold truncate" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {sesion.ejercicios.length} {sesion.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}{sesion.duracion_estimada_min ? ` · ${sesion.duracion_estimada_min} min` : ''}
                    {sesion.contexto_ia && <span className="font-medium" style={{ color: 'var(--semantic-info-text)' }}> · {sesion.contexto_ia}</span>}
                  </p>
                </div>
              </div>
              <ChevronDown size={18} className="flex-shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: abierto ? 'rotate(180deg)' : 'none' }} />
            </button>

            {abierto && (
              <div className="px-4 pb-4 space-y-2">
                <div className="rounded-lg px-3.5 py-3" style={{ background: 'var(--surface-elevated,var(--border))' }}>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    <label className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      Hora de inicio
                      <input
                        type="time"
                        defaultValue={sesion.hora_inicio ?? ''}
                        disabled={guardandoHora === sesion.id}
                        onBlur={e => { void guardarHora(sesion, e.currentTarget) }}
                        className="rounded-lg px-2.5 py-1.5 text-sm disabled:opacity-60"
                        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      />
                      {guardandoHora === sesion.id && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                    </label>
                    <label className="flex flex-wrap items-center gap-2 text-sm font-medium" style={{ color: 'var(--text)' }}>
                      Duración (min)
                      <input
                        type="number"
                        min={10}
                        max={480}
                        step={1}
                        inputMode="numeric"
                        defaultValue={sesion.duracion_estimada_min ?? ''}
                        disabled={guardandoDuracion === sesion.id}
                        onBlur={e => { void guardarDuracion(sesion, e.currentTarget) }}
                        className="w-24 rounded-lg px-2.5 py-1.5 text-sm tabular-nums disabled:opacity-60"
                        style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                      />
                      {guardandoDuracion === sesion.id && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
                    </label>
                  </div>
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    Hora a la que entrena este día. Si la dejas vacía se usa la hora habitual del cuestionario.
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Minutos que dura la sesión; se usa para calcular hidratos y sodio durante el esfuerzo.
                  </p>
                </div>
                {sesion.ejercicios.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin ejercicios cargados.</p>
                ) : (
                  [...sesion.ejercicios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(ej => {
                    const stats = [
                      ej.series && `${ej.series}x${ej.repeticiones ?? '?'}`,
                      ej.peso_sugerido,
                      ej.rpe && `RPE ${ej.rpe}`,
                    ].filter(Boolean)
                    return (
                      <div key={ej.id} className="px-3.5 py-3 rounded-lg" style={{ background: 'var(--surface-elevated,var(--border))' }}>
                        <div className="flex items-center gap-2">
                          <Dumbbell size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</span>
                        </div>
                        {stats.length > 0 && (
                          <p className="text-sm mt-1.5 pl-[22px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                            {stats.join(' · ')}
                          </p>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

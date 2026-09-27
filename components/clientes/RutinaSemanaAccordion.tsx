'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Dumbbell, Loader2 } from 'lucide-react'
import { DIAS_SEMANA_ORDEN } from '@/lib/entrenos/bloques'

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
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
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
              className="w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg flex-shrink-0" style={{ background: 'var(--surface-elevated,var(--border))', color: esHoy ? 'var(--semantic-info-text)' : 'var(--text-muted)' }}>
                  {sesion.dia_semana.slice(0, 3)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{sesion.nombre}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {sesion.ejercicios.length} {sesion.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}{sesion.duracion_estimada_min ? ` · ~${sesion.duracion_estimada_min} min` : ''}
                    {sesion.contexto_ia && <span style={{ color: 'var(--semantic-info-text)' }}> · {sesion.contexto_ia}</span>}
                  </p>
                </div>
              </div>
              <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: abierto ? 'rotate(180deg)' : 'none' }} />
            </button>

            {abierto && (
              <div className="px-3.5 pb-3.5 space-y-1.5">
                {sesion.ejercicios.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin ejercicios cargados.</p>
                ) : (
                  [...sesion.ejercicios].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map(ej => (
                    <div key={ej.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-elevated,var(--border))' }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Dumbbell size={12} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{ej.ejercicio?.nombre ?? 'Ejercicio'}</span>
                      </div>
                      <span className="text-[11px] flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {[
                          ej.series && `${ej.series}x${ej.repeticiones ?? '?'}`,
                          ej.peso_sugerido,
                          ej.rpe && `RPE ${ej.rpe}`,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ChevronRight, Dumbbell, Zap } from 'lucide-react'
import Link from 'next/link'

interface SesionSemana {
  id: string
  nombre: string
  dia_semana: string
  orden: number
  ejercicios_count: number
  duracion_estimada_min?: number
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

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('sesiones_entrenamiento')
        .select('id, nombre, dia_semana, orden, duracion_estimada_min, ejercicios:sesion_ejercicios(id)')
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
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [planId])

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

  // Days that have a session this week
  const diasConSesion = new Set(sesionesOrdenadas.map(s => s.dia_semana))

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
            </p>
          </div>
        </div>
      </div>

      {/* Day dots row */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-4">
          {(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const).map(dia => {
            const hasSesion = diasConSesion.has(dia)
            const isToday = dia === TODAY_NAME
            return (
              <div
                key={dia}
                className="flex flex-col items-center gap-1"
                style={{ flex: 1 }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all"
                  style={
                    isToday && hasSesion
                      ? { background: 'rgb(168,85,247)', color: 'white' }
                      : hasSesion
                        ? { background: 'rgba(168,85,247,0.15)', color: 'rgb(192,132,252)' }
                        : { background: 'rgba(128,128,128,0.08)', color: 'var(--text-muted)' }
                  }
                >
                  {DIA_ABR[dia]}
                </div>
                {/* activity dot */}
                <div
                  className="w-1 h-1 rounded-full"
                  style={{ background: hasSesion ? 'rgba(168,85,247,0.5)' : 'transparent' }}
                />
              </div>
            )
          })}
        </div>

        {/* Next session CTA */}
        {nextSession && (
          <Link
            href={`/cliente/sesion/${nextSession.id}`}
            className="flex items-center gap-3 rounded-xl px-3.5 py-3 transition-opacity hover:opacity-80 active:scale-[0.98]"
            style={{
              background: 'rgba(168,85,247,0.1)',
              border: '1px solid rgba(168,85,247,0.2)',
            }}
          >
            <div
              className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.2)' }}
            >
              <Zap size={16} style={{ color: 'rgb(192,132,252)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                {nextSession.nombre}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {nextSession.dia_semana || 'Sesión'}
                {nextSession.ejercicios_count > 0 && ` · ${nextSession.ejercicios_count} ej.`}
                {nextSession.duracion_estimada_min && ` · ${nextSession.duracion_estimada_min} min`}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(168,85,247,0.2)', color: 'rgb(192,132,252)' }}
              >
                {nextSession.dia_semana === TODAY_NAME ? 'Hoy' : 'Iniciar'}
              </span>
              <ChevronRight size={14} style={{ color: 'rgba(168,85,247,0.7)' }} />
            </div>
          </Link>
        )}

        {/* All sessions list */}
        {sesionesOrdenadas.length > 1 && (
          <div className="mt-2 flex flex-col gap-1">
            {sesionesOrdenadas.filter(s => s.id !== nextSession?.id).map(s => (
              <Link
                key={s.id}
                href={`/cliente/sesion/${s.id}`}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                <span
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                  style={{ background: 'rgba(128,128,128,0.1)' }}
                >
                  {DIA_ABR[s.dia_semana] ?? '?'}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color: 'var(--text)' }}>
                  {s.nombre}
                </span>
                {s.ejercicios_count > 0 && (
                  <span className="text-[11px]">{s.ejercicios_count} ej.</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

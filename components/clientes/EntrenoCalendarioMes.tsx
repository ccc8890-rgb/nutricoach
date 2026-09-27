'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Flag, Loader2 } from 'lucide-react'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS_ABREV = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const FASE_COLOR: Record<string, { bg: string; text: string }> = {
  Base: { bg: 'var(--semantic-info-bg)', text: 'var(--semantic-info-text)' },
  Fuerza: { bg: 'var(--semantic-warn-bg)', text: 'var(--semantic-warn-text)' },
  Resistencia: { bg: 'var(--semantic-active-bg)', text: 'var(--semantic-active-text)' },
  Deload: { bg: 'var(--border)', text: 'var(--text-muted)' },
}

interface DiaMes {
  fecha: string
  dia_semana: string
  sesiones: { id: string; nombre: string; fase_bloque: string | null }[]
  bloque_pendiente: boolean
  competiciones: { id: string; nombre: string; disciplina: string | null }[]
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EntrenoCalendarioMes({ planId }: { planId: string }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1) // 1-12
  const [dias, setDias] = useState<DiaMes[] | null>(null)
  const hoy = hoyISO()

  useEffect(() => {
    let cancelado = false
    setDias(null)
    fetch(`/api/entrenos/mes-coach?plan_id=${planId}&year=${year}&month=${month}`)
      .then(r => r.json())
      .then(data => { if (!cancelado) setDias(data.dias ?? []) })
      .catch(() => { if (!cancelado) setDias([]) })
    return () => { cancelado = true }
  }, [planId, year, month])

  function cambiarMes(delta: number) {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setMonth(m); setYear(y)
  }

  if (dias === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    )
  }

  // Padding para que la semana empiece en lunes
  const primerDia = new Date(year, month - 1, 1)
  const offset = (primerDia.getDay() + 6) % 7 // 0=lunes

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{MESES[month - 1]} {year}</p>
        <div className="flex gap-1">
          <button onClick={() => cambiarMes(-1)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}><ChevronLeft size={14} /></button>
          <button onClick={() => cambiarMes(1)} className="p-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}><ChevronRight size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_ABREV.map(d => (
          <p key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider py-1" style={{ color: 'var(--text-muted)' }}>{d}</p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: offset }).map((_, i) => <div key={`pad-${i}`} />)}
        {dias.map(dia => {
          const esHoy = dia.fecha === hoy
          const numeroDia = parseInt(dia.fecha.slice(8, 10), 10)
          return (
            <div
              key={dia.fecha}
              className="rounded-lg p-1.5 min-h-[72px] flex flex-col"
              style={{
                background: esHoy ? 'var(--semantic-info-bg)' : 'var(--bg)',
                border: `1px solid ${esHoy ? 'var(--semantic-info-border)' : 'var(--border)'}`,
              }}
            >
              <p className="text-[10px] font-semibold mb-1" style={{ color: esHoy ? 'var(--semantic-info-text)' : 'var(--text-muted)' }}>{numeroDia}</p>

              {dia.competiciones.length > 0 && (
                <div className="flex items-center gap-1 mb-1 px-1 py-0.5 rounded" style={{ background: 'var(--semantic-alert-bg)' }}>
                  <Flag size={9} style={{ color: 'var(--semantic-alert-text)' }} />
                  <span className="text-[9px] font-semibold truncate" style={{ color: 'var(--semantic-alert-text)' }}>{dia.competiciones[0].nombre}</span>
                </div>
              )}

              {dia.bloque_pendiente ? (
                <span className="text-[9px]" style={{ color: 'var(--text-disabled)' }}>Bloque siguiente sin generar</span>
              ) : (
                dia.sesiones.slice(0, 2).map(s => {
                  const color = s.fase_bloque ? FASE_COLOR[s.fase_bloque] : undefined
                  return (
                    <p
                      key={s.id}
                      className="text-[9px] font-medium truncate px-1 py-0.5 rounded mb-0.5"
                      style={{ background: color?.bg ?? 'var(--surface-elevated,var(--border))', color: color?.text ?? 'var(--text-muted)' }}
                    >
                      {s.nombre}
                    </p>
                  )
                })
              )}
              {dia.sesiones.length > 2 && (
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>+{dia.sesiones.length - 2} más</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

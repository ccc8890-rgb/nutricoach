'use client'
import { useState } from 'react'
import { Check, ClockCounterClockwise, X } from '@phosphor-icons/react'
import type { SetData } from './SesionCardMobile'

type Modo = 'fuerza' | 'cardio'

interface Props {
  setNum: number
  totalSets: number
  ejercicioNombre: string
  pesoSugerido: string
  repsSugeridas: string
  pesoInicialKg?: number
  modo: Modo
  onGuardar: (data: Omit<SetData, 'hecho'>) => void
  onCerrar: () => void
}

function formatTiempo(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

export default function SetRegistroSheet({
  setNum, totalSets, ejercicioNombre, pesoSugerido, repsSugeridas,
  pesoInicialKg, modo, onGuardar, onCerrar,
}: Props) {
  // Fuerza
  const [kg, setKg] = useState(pesoInicialKg != null ? pesoInicialKg : parseFloat(pesoSugerido) || 0)
  const [reps, setReps] = useState(parseInt(repsSugeridas) || 0)
  // Cardio
  const [metros, setMetros] = useState(0)
  const [calorias, setCalorias] = useState(0)
  const [tiempoS, setTiempoS] = useState(0)
  // Común
  const [rpe, setRpe] = useState(7)

  function handleGuardar() {
    if (modo === 'cardio') {
      onGuardar({ metros, calorias, tiempo_s: tiempoS, rpe })
    } else {
      onGuardar({ kg, reps, rpe })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Set {setNum} / {totalSets}</p>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>{ejercicioNombre}</p>
            {modo === 'fuerza' && pesoInicialKg != null && pesoInicialKg > 0 && (
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--semantic-info)' }}>
                <ClockCounterClockwise size={12} /> Última vez: {pesoInicialKg} kg
              </p>
            )}
          </div>
          <button onClick={onCerrar} style={{ color: 'var(--text-muted)' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {modo === 'fuerza' ? (
          /* ── Fuerza: kg + reps ── */
          <div className="flex gap-4 justify-center mb-6">
            {([
              { label: 'kg', value: kg, setValue: setKg, step: 2.5 },
              { label: 'reps', value: reps, setValue: setReps, step: 1 },
            ] as const).map(({ label, value, setValue, step }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setValue((v: number) => Math.max(0, +(v + step).toFixed(1)))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                  aria-label={`Aumentar ${label}`}
                >+</button>
                <div className="text-center min-w-[60px]">
                  <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <button
                  onClick={() => setValue((v: number) => Math.max(0, +(v - step).toFixed(1)))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  aria-label={`Reducir ${label}`}
                >−</button>
              </div>
            ))}
          </div>
        ) : (
          /* ── Cardio: metros + calorias + tiempo ── */
          <div className="flex gap-3 justify-center mb-6">
            {([
              { label: 'm', value: metros, setValue: setMetros, step: 10 },
              { label: 'cal', value: calorias, setValue: setCalorias, step: 1 },
            ] as const).map(({ label, value, setValue, step }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <button
                  onClick={() => setValue((v: number) => Math.max(0, v + step))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                  aria-label={`Aumentar ${label}`}
                >+</button>
                <div className="text-center min-w-[52px]">
                  <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
                </div>
                <button
                  onClick={() => setValue((v: number) => Math.max(0, v - step))}
                  className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                  style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  aria-label={`Reducir ${label}`}
                >−</button>
              </div>
            ))}
            {/* Tiempo MM:SS */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => setTiempoS(v => v + 5)}
                className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                style={{ background: 'var(--semantic-info-bg)', color: 'var(--semantic-info)', border: '1px solid var(--semantic-info-border)' }}
                aria-label="Aumentar tiempo 5s"
              >+</button>
              <div className="text-center min-w-[52px]">
                <span className="text-2xl font-bold font-data" style={{ color: 'var(--text)' }}>{formatTiempo(tiempoS)}</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>tiempo</p>
              </div>
              <button
                onClick={() => setTiempoS(v => Math.max(0, v - 5))}
                className="w-10 h-10 rounded-full text-xl font-bold transition-transform active:scale-[0.95]"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                aria-label="Reducir tiempo 5s"
              >−</button>
            </div>
          </div>
        )}

        {/* RPE — igual para ambos modos */}
        <div className="mb-5">
          <p className="text-xs text-center mb-2" style={{ color: 'var(--text-muted)' }}>RPE percibido</p>
          <div className="flex justify-center gap-1.5">
            {[6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className="w-10 h-10 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: rpe === n ? 'var(--accent)' : 'var(--bg)',
                  color: rpe === n ? 'var(--bg)' : 'var(--text-muted)',
                  border: `1px solid ${rpe === n ? 'var(--accent)' : 'var(--border)'}`,
                }}
                aria-label={`RPE ${n}`}
                aria-pressed={rpe === n}
              >{n}</button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGuardar}
          className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          <Check size={16} /> Guardar set
        </button>
      </div>
    </div>
  )
}

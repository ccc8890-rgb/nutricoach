'use client'
import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  setNum: number
  totalSets: number
  ejercicioNombre: string
  pesoSugerido: string
  repsSugeridas: string
  pesoInicialKg?: number
  onGuardar: (kg: number, reps: number, rpe: number) => void
  onCerrar: () => void
}

export default function SetRegistroSheet({
  setNum, totalSets, ejercicioNombre, pesoSugerido, repsSugeridas, pesoInicialKg, onGuardar, onCerrar
}: Props) {
  const [kg, setKg] = useState(pesoInicialKg != null ? pesoInicialKg : pesoSugerido ? parseFloat(pesoSugerido) || 0 : 0)
  const [reps, setReps] = useState(parseInt(repsSugeridas) || 0)
  const [rpe, setRpe] = useState(7)

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
            {pesoInicialKg != null && pesoInicialKg > 0 && (
              <p className="text-xs mt-0.5" style={{ color: 'rgb(168,85,247)' }}>Última vez: {pesoInicialKg} kg</p>
            )}
          </div>
          <button onClick={onCerrar} style={{ color: 'var(--text-muted)' }} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-4 justify-center mb-6">
          {([
            { label: 'kg', value: kg, setValue: setKg, step: 2.5 },
            { label: 'reps', value: reps, setValue: setReps, step: 1 },
          ] as const).map(({ label, value, setValue, step }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <button
                onClick={() => setValue((v: number) => Math.max(0, +(v + step).toFixed(1)))}
                className="w-10 h-10 rounded-full text-xl font-bold"
                style={{ background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)' }}
                aria-label={`Aumentar ${label}`}
              >+</button>
              <div className="text-center min-w-[60px]">
                <span className="text-3xl font-bold" style={{ color: 'var(--text)' }}>{value}</span>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
              <button
                onClick={() => setValue((v: number) => Math.max(0, +(v - step).toFixed(1)))}
                className="w-10 h-10 rounded-full text-xl font-bold"
                style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                aria-label={`Reducir ${label}`}
              >−</button>
            </div>
          ))}
        </div>

        <div className="mb-5">
          <p className="text-xs text-center mb-2" style={{ color: 'var(--text-muted)' }}>RPE percibido</p>
          <div className="flex justify-center gap-1.5">
            {[6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className="w-10 h-10 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: rpe === n ? 'rgb(168,85,247)' : 'var(--bg)',
                  color: rpe === n ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${rpe === n ? 'rgb(168,85,247)' : 'var(--border)'}`,
                }}
                aria-label={`RPE ${n}`}
                aria-pressed={rpe === n}
              >{n}</button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onGuardar(kg, reps, rpe)}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ background: 'rgb(168,85,247)' }}
        >
          ✓ Guardar set
        </button>
      </div>
    </div>
  )
}

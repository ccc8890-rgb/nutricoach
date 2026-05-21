'use client'
import { Check } from 'lucide-react'

export type Segmento = 'standard' | 'recomposicion' | 'performance' | 'elite'

const OPCIONES: { value: Segmento; label: string; sub: string }[] = [
  { value: 'standard',     label: 'Ponerme en forma',       sub: 'Mejorar hábitos y bajar de peso' },
  { value: 'recomposicion', label: 'Cambiar mi cuerpo',      sub: 'Ganar músculo y perder grasa' },
  { value: 'performance',  label: 'Rendir mejor',            sub: 'Deportista con objetivos de rendimiento' },
  { value: 'elite',        label: 'Nivel de competición',    sub: 'Atleta con periodización precisa' },
]

interface Props {
  value: Segmento | ''
  onChange: (v: Segmento) => void
}

export default function StepSegment({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Tu perfil
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        ¿Cuál es tu situación?
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Determina el nivel de detalle de tu plan.
      </p>
      <div className="flex flex-col gap-2.5">
        {OPCIONES.map(op => {
          const sel = value === op.value
          return (
            <button
              key={op.value}
              type="button"
              onClick={() => onChange(op.value)}
              className="flex items-center justify-between px-5 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200 active:scale-[0.98]"
              style={{
                background: sel ? 'rgba(161,161,166,0.1)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <div>
                <p className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--text)' }}>
                  {op.label}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {op.sub}
                </p>
              </div>
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ml-4 transition-all duration-200"
                style={{
                  background: sel ? 'var(--accent)' : 'transparent',
                  border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {sel && <Check size={11} strokeWidth={3} style={{ color: '#1C1C1E' }} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

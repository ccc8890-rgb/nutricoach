'use client'
import { Check } from 'lucide-react'

export type Objetivo = 'perder_grasa' | 'ganar_musculo' | 'rendimiento' | 'mantener' | 'salud_general'

const OPCIONES: { value: Objetivo; label: string; sub: string }[] = [
  { value: 'perder_grasa',   label: 'Perder grasa',       sub: 'Reducir porcentaje de grasa corporal' },
  { value: 'ganar_musculo',  label: 'Ganar músculo',      sub: 'Aumentar masa muscular' },
  { value: 'rendimiento',    label: 'Rendimiento',         sub: 'Mejorar en mi deporte o actividad' },
  { value: 'mantener',       label: 'Mantener',            sub: 'Mantener el peso y composición actual' },
  { value: 'salud_general',  label: 'Salud general',       sub: 'Mejorar hábitos y bienestar' },
]

interface Props {
  value: Objetivo | ''
  onChange: (v: Objetivo) => void
}

export default function StepGoal({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Objetivo
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        ¿Qué quieres conseguir?
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Personaliza tu plan nutricional desde el primer día.
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
                {sel && <Check size={11} strokeWidth={3} style={{ color: '#ffffff' }} />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

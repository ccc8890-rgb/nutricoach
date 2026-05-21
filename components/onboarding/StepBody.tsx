'use client'
import { Check } from 'lucide-react'

export interface BodyData {
  peso: number
  altura: number
  edad: number
  sexo: 'hombre' | 'mujer' | ''
}

interface Props {
  value: BodyData
  onChange: (v: BodyData) => void
}

export default function StepBody({ value, onChange }: Props) {
  const set = (field: keyof BodyData, v: string | number) =>
    onChange({ ...value, [field]: v })

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Datos corporales
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        Cuéntame sobre tu cuerpo
      </h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
        Calculamos tus necesidades calóricas reales con estos datos.
      </p>

      {/* Sexo */}
      <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Sexo biológico</p>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {(['hombre', 'mujer'] as const).map(s => {
          const sel = value.sexo === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => set('sexo', s)}
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-200 active:scale-[0.98]"
              style={{
                background: sel ? 'rgba(161,161,166,0.1)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <span className="font-semibold text-sm capitalize" style={{ color: 'var(--text)' }}>
                {s === 'hombre' ? 'Hombre' : 'Mujer'}
              </span>
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: sel ? 'var(--accent)' : 'transparent',
                  border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {sel && <Check size={9} strokeWidth={3} style={{ color: '#1C1C1E' }} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { field: 'peso' as const,   label: 'Peso',   unit: 'kg',  min: 30,  max: 250, step: 0.1, placeholder: '70' },
          { field: 'altura' as const, label: 'Altura', unit: 'cm',  min: 100, max: 250, step: 1,   placeholder: '170' },
          { field: 'edad' as const,   label: 'Edad',   unit: 'años', min: 12, max: 100, step: 1,   placeholder: '28' },
        ].map(({ field, label, unit, min, max, step, placeholder }) => (
          <div key={field}>
            <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={min} max={max} step={step}
                value={value[field] || ''}
                onChange={e => set(field, field === 'peso' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0)}
                className="input w-full pr-9 text-center font-semibold text-base rounded-2xl"
                placeholder={placeholder}
                style={{ fontSize: '1.1rem' }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium pointer-events-none"
                style={{ color: 'var(--text-muted)' }}>
                {unit}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

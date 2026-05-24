'use client'
import { Check } from 'lucide-react'

export type NivelCocina = 'no_cocina' | 'basico' | 'intermedio' | 'avanzado'

const NIVELES: { value: NivelCocina; label: string; desc: string }[] = [
  { value: 'no_cocina',   label: 'Muy simple',    desc: 'Prefiero comidas rápidas o precocinadas' },
  { value: 'basico',      label: 'Básico',         desc: 'Recetas sencillas de pocos pasos' },
  { value: 'intermedio',  label: 'Intermedio',     desc: 'Me manejo bien en la cocina' },
  { value: 'avanzado',    label: 'Avanzado',        desc: 'Disfruto cocinando y me gustan recetas elaboradas' },
]

interface Props {
  nivelCocina: NivelCocina | ''
  tiempoCocinaMin: number
  presupuestoSemanal: number
  onNivelChange: (v: NivelCocina) => void
  onTiempoChange: (v: number) => void
  onPresupuestoChange: (v: number) => void
}

export default function StepCooking({
  nivelCocina, tiempoCocinaMin, presupuestoSemanal,
  onNivelChange, onTiempoChange, onPresupuestoChange,
}: Props) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Cocina
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        ¿Cómo es tu relación con la cocina?
      </h2>
      <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
        Un buen plan se adapta a tu realidad.
      </p>

      <div className="flex flex-col gap-2.5 mb-7">
        {NIVELES.map(n => {
          const sel = nivelCocina === n.value
          return (
            <button
              key={n.value}
              type="button"
              onClick={() => onNivelChange(n.value)}
              className="flex items-center justify-between px-5 py-4 rounded-2xl text-left cursor-pointer transition-all duration-200 active:scale-[0.98]"
              style={{
                background: sel ? 'rgba(161,161,166,0.1)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <div>
                <p className="font-semibold text-[15px] leading-tight" style={{ color: 'var(--text)' }}>{n.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{n.desc}</p>
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

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Tiempo para cocinar / día', value: tiempoCocinaMin, min: 0, max: 180, step: 5, onChange: onTiempoChange, unit: 'min' },
          { label: 'Presupuesto semanal', value: presupuestoSemanal, min: 0, max: 500, step: 5, onChange: onPresupuestoChange, unit: '€', placeholder: 'Libre' },
        ].map(({ label, value, min, max, step, onChange, unit }) => (
          <div key={label}>
            <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <div className="relative">
              <input
                type="number" inputMode="numeric"
                min={min} max={max} step={step}
                value={value || ''}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                className="input w-full pr-9 text-center font-semibold rounded-2xl"
                style={{ fontSize: '1.05rem' }}
                placeholder="0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                style={{ color: 'var(--text-muted)' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

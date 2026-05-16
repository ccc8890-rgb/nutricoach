'use client'

export type Objetivo = 'perder_grasa' | 'ganar_musculo' | 'rendimiento' | 'mantener' | 'salud_general'

const OPCIONES: { value: Objetivo; label: string; desc: string; emoji: string }[] = [
  { value: 'perder_grasa', label: 'Perder grasa', desc: 'Reducir porcentaje de grasa corporal', emoji: '🔥' },
  { value: 'ganar_musculo', label: 'Ganar músculo', desc: 'Aumentar masa muscular', emoji: '💪' },
  { value: 'rendimiento', label: 'Rendimiento', desc: 'Mejorar en mi deporte o actividad', emoji: '⚡' },
  { value: 'mantener', label: 'Mantener', desc: 'Mantener el peso y composición actual', emoji: '⚖️' },
  { value: 'salud_general', label: 'Salud general', desc: 'Mejorar hábitos y bienestar general', emoji: '🌱' },
]

interface Props {
  value: Objetivo | ''
  onChange: (v: Objetivo) => void
}

export default function StepGoal({ value, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">¿Cuál es tu objetivo principal?</h2>
      <p className="text-[var(--text-muted)] mb-6">Esto ayuda a personalizar tu plan nutricional desde el primer día.</p>
      <div className="grid gap-3">
        {OPCIONES.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              value === op.value
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'
            }`}
          >
            <span className="text-2xl">{op.emoji}</span>
            <div>
              <div className="font-medium text-[var(--text)]">{op.label}</div>
              <div className="text-sm text-[var(--text-muted)]">{op.desc}</div>
            </div>
            {value === op.value && (
              <div className="ml-auto w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs">✓</div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

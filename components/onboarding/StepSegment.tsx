'use client'

export type Segmento = 'standard' | 'recomposicion' | 'performance' | 'elite'

const OPCIONES: {
  value: Segmento
  label: string
  sublabel: string
  desc: string
  emoji: string
  tier: string
  tierColor: string
}[] = [
  {
    value: 'standard',
    label: 'Quiero perder grasa y ponerme en forma',
    sublabel: 'Pérdida de peso / salud general',
    desc: 'Entreno poco o nada. Quiero mejorar mis hábitos, bajar de peso y sentirme mejor.',
    emoji: '🔥',
    tier: 'Esencial',
    tierColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
  },
  {
    value: 'recomposicion',
    label: 'Entreno y quiero cambiar mi cuerpo',
    sublabel: 'Recomposición corporal / estética',
    desc: 'Voy al gym o hago deporte regularmente. Quiero ganar músculo, perder grasa o cambiar mi composición corporal.',
    emoji: '💪',
    tier: 'Avanzado',
    tierColor: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
  },
  {
    value: 'performance',
    label: 'Hago deporte y quiero rendir mejor',
    sublabel: 'Atleta recreacional / semi-atleta',
    desc: 'Corro, hago crossfit, ciclismo, natación u otro deporte con regularidad. El rendimiento y la recuperación son mi prioridad.',
    emoji: '⚡',
    tier: 'Pro',
    tierColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  },
  {
    value: 'elite',
    label: 'Compito o entreno a muy alto nivel',
    sublabel: 'Atleta de competición / físico élite',
    desc: 'Tengo competiciones, categorías de peso, periodos de puesta a punto. Necesito nutrición muy precisa y periodizada.',
    emoji: '🏆',
    tier: 'Élite',
    tierColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  },
]

interface Props {
  value: Segmento | ''
  onChange: (v: Segmento) => void
}

export default function StepSegment({ value, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">¿Cuál es tu situación?</h2>
      <p className="text-[var(--text-muted)] mb-6">
        Esto determina el nivel de detalle del cuestionario y la precisión del plan que recibirás.
      </p>
      <div className="grid gap-3">
        {OPCIONES.map(op => (
          <button
            key={op.value}
            type="button"
            onClick={() => onChange(op.value)}
            className={`relative flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all ${
              value === op.value
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'
            }`}
          >
            <span className="text-2xl mt-0.5">{op.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text)]">{op.label}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${op.tierColor}`}>
                  {op.tier}
                </span>
              </div>
              <div className="text-xs font-medium text-[var(--primary)] mt-0.5">{op.sublabel}</div>
              <div className="text-sm text-[var(--text-muted)] mt-1 leading-snug">{op.desc}</div>
            </div>
            {value === op.value && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs flex-shrink-0">
                ✓
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

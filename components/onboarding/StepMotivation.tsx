'use client'

interface Props {
  trigger: string
  autoeficacia: number
  onTriggerChange: (v: string) => void
  onAutoeficaciaChange: (v: number) => void
}

const CONFIANZA_LABELS: Record<number, string> = {
  1: 'Muy baja — necesito mucho apoyo', 2: 'Baja', 3: 'Algo dudoso/a',
  4: 'Regular', 5: 'Moderada', 6: 'Bastante bien',
  7: 'Buena', 8: 'Alta', 9: 'Muy alta', 10: 'Total — estoy listo/a',
}

export default function StepMotivation({ trigger, autoeficacia, onTriggerChange, onAutoeficaciaChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">¿Por qué ahora?</h2>
      <p className="text-[var(--text-muted)] mb-6">Esto me ayuda a entender tu motivación real y diseñar el plan a tu medida.</p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Qué te llevó a buscar ayuda esta semana en concreto?
        </label>
        <textarea
          value={trigger}
          onChange={e => onTriggerChange(e.target.value)}
          className="input w-full"
          rows={3}
          placeholder="Ej: me hice una analítica y el colesterol está alto / tengo una boda en julio / llevo tiempo sintiéndome sin energía..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Cuanto más específico, mejor puedo orientar el plan.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-3">
          Del 1 al 10, ¿cuánta confianza tienes en que podrás seguir el plan durante 4 semanas?
        </label>
        <div className="flex gap-1.5 flex-wrap mb-2">
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => onAutoeficaciaChange(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold border-2 transition-all ${
                autoeficacia === n
                  ? n >= 7 ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : n >= 5 ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {autoeficacia > 0 && (
          <p className={`text-sm font-medium ${
            autoeficacia >= 7 ? 'text-green-600 dark:text-green-400'
            : autoeficacia >= 5 ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400'
          }`}>
            {autoeficacia} — {CONFIANZA_LABELS[autoeficacia]}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {autoeficacia > 0 && autoeficacia < 7 && 'Tranquilo/a — adaptaré el plan para que sea más llevadero y flexible.'}
          {autoeficacia >= 7 && 'Perfecto — podemos diseñar algo más estructurado.'}
        </p>
      </div>
    </div>
  )
}

'use client'

export type NivelCocina = 'no_cocina' | 'basico' | 'intermedio' | 'avanzado'

const NIVELES: { value: NivelCocina; label: string; desc: string; emoji: string }[] = [
  { value: 'no_cocina', label: 'No cocino', desc: 'Prefiero comidas muy simples o precocinadas', emoji: '🥡' },
  { value: 'basico', label: 'Básico', desc: 'Sé hacer recetas sencillas de pocos pasos', emoji: '🍳' },
  { value: 'intermedio', label: 'Intermedio', desc: 'Me manejo bien en la cocina', emoji: '👨‍🍳' },
  { value: 'avanzado', label: 'Avanzado', desc: 'Disfruto cocinando y me gustan recetas elaboradas', emoji: '⭐' },
]

interface Props {
  nivelCocina: NivelCocina | ''
  tiempoCocinaMin: number
  presupuestoSemanal: number
  onNivelChange: (v: NivelCocina) => void
  onTiempoChange: (v: number) => void
  onPresupuestoChange: (v: number) => void
}

export default function StepCooking({ nivelCocina, tiempoCocinaMin, presupuestoSemanal, onNivelChange, onTiempoChange, onPresupuestoChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Cocina y logística</h2>
      <p className="text-[var(--text-muted)] mb-6">Un buen plan se adapta a tu realidad, no al revés.</p>

      <div className="grid gap-2 mb-6">
        {NIVELES.map(n => (
          <button
            key={n.value}
            type="button"
            onClick={() => onNivelChange(n.value)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              nivelCocina === n.value
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'
            }`}
          >
            <span className="text-xl">{n.emoji}</span>
            <div className="flex-1">
              <div className="font-medium text-[var(--text)] text-sm">{n.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{n.desc}</div>
            </div>
            {nivelCocina === n.value && (
              <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs">✓</div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            Tiempo para cocinar al día (min)
          </label>
          <input
            type="number"
            min={0} max={180} step={5}
            value={tiempoCocinaMin}
            onChange={e => onTiempoChange(parseInt(e.target.value) || 0)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            Presupuesto semanal (€, opcional)
          </label>
          <input
            type="number"
            min={0} max={500} step={5}
            value={presupuestoSemanal || ''}
            onChange={e => onPresupuestoChange(parseInt(e.target.value) || 0)}
            className="input w-full"
            placeholder="Sin límite"
          />
        </div>
      </div>
    </div>
  )
}

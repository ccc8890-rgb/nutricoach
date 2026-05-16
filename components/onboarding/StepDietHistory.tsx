'use client'

const DIETAS_OPCIONES = [
  { value: 'ninguna', label: 'Nunca he hecho ninguna', emoji: '🙅' },
  { value: 'deficit_calorico', label: 'Contar calorías / déficit', emoji: '📊' },
  { value: 'keto', label: 'Keto / low carb', emoji: '🥑' },
  { value: 'ayuno_intermitente', label: 'Ayuno intermitente', emoji: '⏰' },
  { value: 'vegana_vegetariana', label: 'Vegana / vegetariana', emoji: '🌱' },
  { value: 'dieta_proteica', label: 'Alta en proteína', emoji: '🍗' },
  { value: 'weight_watchers', label: 'Weight Watchers / puntos', emoji: '⚖️' },
  { value: 'dieta_mediterranea', label: 'Mediterránea', emoji: '🫒' },
  { value: 'otra', label: 'Otra', emoji: '📋' },
]

const ABANDONO_OPCIONES = [
  'Demasiado restrictiva',
  'Mucho tiempo / compleja',
  'No encajaba con mi familia o vida social',
  'Perdí la motivación',
  'No vi resultados',
  'Lo conseguí y lo dejé',
  'Mucha hambre',
  'No me gustaba la comida del plan',
]

const RELACION_OPCIONES = [
  { value: 'funcional', label: 'Funcional', desc: 'Como para vivir, sin darle muchas vueltas', emoji: '😐' },
  { value: 'placer', label: 'Placer', desc: 'Disfruto mucho comiendo y cocinando', emoji: '😋' },
  { value: 'ansiedad', label: 'A veces ansiedad', desc: 'Hay momentos que como sin hambre o por estrés', emoji: '😰' },
  { value: 'conflicto', label: 'Relación difícil', desc: 'Me genera culpa o conflicto con frecuencia', emoji: '😔' },
  { value: 'nc', label: 'Prefiero no contestar', desc: '', emoji: '🔒' },
]

interface Props {
  historialDietas: string[]
  razonesAbandono: string[]
  relacionComida: string
  todoONada: string
  onDietasChange: (v: string[]) => void
  onRazonesChange: (v: string[]) => void
  onRelacionChange: (v: string) => void
  onTodoONadaChange: (v: string) => void
}

export default function StepDietHistory({
  historialDietas, razonesAbandono, relacionComida, todoONada,
  onDietasChange, onRazonesChange, onRelacionChange, onTodoONadaChange,
}: Props) {
  const toggleChip = (arr: string[], val: string, setter: (v: string[]) => void) =>
    setter(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])

  const nuncaHizoNada = historialDietas.includes('ninguna')

  const handleDieta = (val: string) => {
    if (val === 'ninguna') {
      onDietasChange(nuncaHizoNada ? [] : ['ninguna'])
      onRazonesChange([])
    } else {
      const sin = historialDietas.filter(x => x !== 'ninguna')
      toggleChip(sin, val, onDietasChange)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Tu historia con la alimentación</h2>
      <p className="text-[var(--text-muted)] mb-6">Lo que has probado antes me enseña más que cualquier test nutricional.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Qué tipos de dieta o plan has seguido antes?</label>
        <div className="flex flex-wrap gap-2">
          {DIETAS_OPCIONES.map(d => (
            <button
              key={d.value}
              type="button"
              onClick={() => handleDieta(d.value)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm border transition-all ${
                historialDietas.includes(d.value)
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}
            >
              <span>{d.emoji}</span> {d.label}
            </button>
          ))}
        </div>
      </div>

      {historialDietas.length > 0 && !nuncaHizoNada && (
        <div className="mb-5">
          <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Por qué las dejaste? (puede ser más de uno)</label>
          <div className="flex flex-wrap gap-2">
            {ABANDONO_OPCIONES.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => toggleChip(razonesAbandono, r, onRazonesChange)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  razonesAbandono.includes(r)
                    ? 'border-red-400 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 font-medium'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-red-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Cómo describirías tu relación con la comida?</label>
        <div className="grid gap-2">
          {RELACION_OPCIONES.map(r => (
            <button
              key={r.value}
              type="button"
              onClick={() => onRelacionChange(r.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                relacionComida === r.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/40'
              }`}
            >
              <span className="text-xl">{r.emoji}</span>
              <div>
                <div className="font-medium text-[var(--text)] text-sm">{r.label}</div>
                {r.desc && <div className="text-xs text-[var(--text-muted)]">{r.desc}</div>}
              </div>
              {relacionComida === r.value && (
                <div className="ml-auto w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs">✓</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          ¿Eres de &quot;todo o nada&quot; con la dieta? (o lo dejo todo perfecto o lo dejo todo)
        </label>
        <div className="flex gap-3">
          {[
            { value: 'si', label: 'Sí, bastante', emoji: '⚠️' },
            { value: 'a_veces', label: 'A veces', emoji: '🤔' },
            { value: 'no', label: 'No, soy flexible', emoji: '✅' },
          ].map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => onTodoONadaChange(op.value)}
              className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium transition-all flex flex-col items-center gap-1 ${
                todoONada === op.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}
            >
              <span>{op.emoji}</span>
              {op.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

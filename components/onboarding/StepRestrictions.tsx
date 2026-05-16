'use client'

const RESTRICCIONES_OPCIONES = [
  'Sin gluten', 'Sin lactosa', 'Vegetariano', 'Vegano',
  'Sin frutos secos', 'Sin mariscos', 'Sin huevo', 'Sin cerdo',
  'Halal', 'Kosher', 'Sin soja', 'Sin azúcar añadido',
]

interface Props {
  restricciones: string[]
  alimentosNoGustan: string
  onRestriccionesChange: (v: string[]) => void
  onAlimentosNogustanChange: (v: string) => void
}

export default function StepRestrictions({ restricciones, alimentosNoGustan, onRestriccionesChange, onAlimentosNogustanChange }: Props) {
  const toggle = (r: string) =>
    onRestriccionesChange(restricciones.includes(r) ? restricciones.filter(x => x !== r) : [...restricciones, r])

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Restricciones alimentarias</h2>
      <p className="text-[var(--text-muted)] mb-6">Intolerancias, alergias o preferencias que debemos respetar.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {RESTRICCIONES_OPCIONES.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => toggle(r)}
            className={`px-3 py-2 rounded-full text-sm border transition-all ${
              restricciones.includes(r)
                ? 'border-red-400 bg-red-50 text-red-700 font-medium dark:bg-red-900/20 dark:text-red-400'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-red-300'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          Alimentos que no te gustan o no quieres en tu plan
        </label>
        <textarea
          value={alimentosNoGustan}
          onChange={e => onAlimentosNogustanChange(e.target.value)}
          className="input w-full"
          rows={3}
          placeholder="Ej: brócoli, coliflor, pescado azul..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Los evitaremos siempre que sea posible.</p>
      </div>
    </div>
  )
}

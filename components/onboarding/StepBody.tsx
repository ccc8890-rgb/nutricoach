'use client'

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
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Datos corporales</h2>
      <p className="text-[var(--text-muted)] mb-6">Los usamos para calcular tus necesidades calóricas reales.</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Peso (kg)</label>
          <input
            type="number"
            min={30} max={250} step={0.1}
            value={value.peso || ''}
            onChange={e => set('peso', parseFloat(e.target.value) || 0)}
            className="input w-full"
            placeholder="70"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Altura (cm)</label>
          <input
            type="number"
            min={100} max={250}
            value={value.altura || ''}
            onChange={e => set('altura', parseInt(e.target.value) || 0)}
            className="input w-full"
            placeholder="170"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Edad</label>
          <input
            type="number"
            min={12} max={100}
            value={value.edad || ''}
            onChange={e => set('edad', parseInt(e.target.value) || 0)}
            className="input w-full"
            placeholder="30"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Sexo</label>
          <div className="flex gap-2">
            {(['hombre', 'mujer'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => set('sexo', s)}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                  value.sexo === s
                    ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--primary)]'
                    : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
                }`}
              >
                {s === 'hombre' ? '♂ Hombre' : '♀ Mujer'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

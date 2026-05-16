'use client'

interface Props {
  condicionesSalud: string
  horasSueno: number
  calidadSueno: number
  nivelEstres: number
  onCondicionesChange: (v: string) => void
  onHorasSuenoChange: (v: number) => void
  onCalidadSuenoChange: (v: number) => void
  onNivelEstresChange: (v: number) => void
}

function StarScale({
  value, onChange, low, high,
}: { value: number; onChange: (v: number) => void; low: string; high: string }) {
  return (
    <div>
      <div className="flex gap-2 mb-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 h-10 rounded-lg border-2 font-semibold text-sm transition-all ${
              value === n
                ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{low}</span><span>{high}</span>
      </div>
    </div>
  )
}

export default function StepHealth({
  condicionesSalud, horasSueno, calidadSueno, nivelEstres,
  onCondicionesChange, onHorasSuenoChange, onCalidadSuenoChange, onNivelEstresChange,
}: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Salud y bienestar</h2>
      <p className="text-[var(--text-muted)] mb-6">El sueño y el estrés afectan directamente al hambre y al metabolismo. Todo cuenta.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Tienes alguna condición de salud o tomas medicación que debamos tener en cuenta?
          <span className="text-[var(--text-muted)] font-normal ml-1">(opcional)</span>
        </label>
        <textarea
          value={condicionesSalud}
          onChange={e => onCondicionesChange(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Ej: hipotiroidismo, diabetes tipo 2, colesterol alto, tomo metformina... o 'ninguna'"
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Esta información es confidencial y solo la ve tu dietista.</p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Cuántas horas duermes de media?</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={3} max={10} step={0.5}
            value={horasSueno || 7}
            onChange={e => onHorasSuenoChange(parseFloat(e.target.value))}
            className="flex-1 accent-[var(--primary)]"
          />
          <span className="text-lg font-bold text-[var(--primary)] w-12 text-center">
            {horasSueno || 7}h
          </span>
        </div>
        {horasSueno > 0 && horasSueno < 6 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Con menos de 6h de sueño, el cuerpo produce más grelina (hambre). Lo tendremos en cuenta.
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">Calidad del sueño</label>
        <StarScale value={calidadSueno} onChange={onCalidadSuenoChange} low="Muy mala" high="Excelente" />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">Nivel de estrés habitual</label>
        <StarScale value={nivelEstres} onChange={onNivelEstresChange} low="Muy bajo" high="Muy alto" />
        {nivelEstres >= 4 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            El estrés elevado aumenta el cortisol y el apetito por dulces. El plan incluirá estrategias específicas.
          </p>
        )}
      </div>
    </div>
  )
}

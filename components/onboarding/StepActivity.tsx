'use client'

export type ActividadBase = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo'

const ACTIVIDADES: { value: ActividadBase; label: string; desc: string }[] = [
  { value: 'sedentario', label: 'Sedentario', desc: 'Trabajo de oficina, poco o ningún ejercicio' },
  { value: 'ligero', label: 'Ligeramente activo', desc: '1-2 días de ejercicio por semana' },
  { value: 'moderado', label: 'Moderadamente activo', desc: '3-4 días de ejercicio por semana' },
  { value: 'activo', label: 'Activo', desc: '5-6 días de ejercicio o trabajo físico' },
  { value: 'muy_activo', label: 'Muy activo', desc: 'Ejercicio intenso diario o deporte de competición' },
]

const TIPOS_ENTRENO = ['Gym / musculación', 'Running', 'CrossFit', 'Ciclismo', 'Natación', 'HYROX', 'Artes marciales', 'Yoga / Pilates', 'Otro']

interface Props {
  actividad: ActividadBase | ''
  diasEntreno: number
  tipoEntreno: string[]
  duracionSesionMin: number
  onActividadChange: (v: ActividadBase) => void
  onDiasChange: (v: number) => void
  onTipoChange: (v: string[]) => void
  onDuracionChange: (v: number) => void
}

export default function StepActivity({
  actividad, diasEntreno, tipoEntreno, duracionSesionMin,
  onActividadChange, onDiasChange, onTipoChange, onDuracionChange
}: Props) {
  const toggleTipo = (t: string) =>
    onTipoChange(tipoEntreno.includes(t) ? tipoEntreno.filter(x => x !== t) : [...tipoEntreno, t])

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Actividad física</h2>
      <p className="text-[var(--text-muted)] mb-6">Tu nivel de actividad determina las calorías que necesitas.</p>

      <div className="grid gap-2 mb-6">
        {ACTIVIDADES.map(a => (
          <button
            key={a.value}
            type="button"
            onClick={() => onActividadChange(a.value)}
            className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
              actividad === a.value
                ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                : 'border-[var(--border)] hover:border-[var(--primary)]/40'
            }`}
          >
            <div className="flex-1">
              <div className="font-medium text-[var(--text)] text-sm">{a.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{a.desc}</div>
            </div>
            {actividad === a.value && (
              <div className="w-4 h-4 rounded-full bg-[var(--primary)] flex items-center justify-center text-white text-xs">✓</div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Días de entreno / semana</label>
          <input
            type="number"
            min={0} max={7}
            value={diasEntreno}
            onChange={e => onDiasChange(parseInt(e.target.value) || 0)}
            className="input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Duración media (min)</label>
          <input
            type="number"
            min={15} max={300} step={15}
            value={duracionSesionMin}
            onChange={e => onDuracionChange(parseInt(e.target.value) || 60)}
            className="input w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">Tipo de entrenamiento (opcional)</label>
        <div className="flex flex-wrap gap-2">
          {TIPOS_ENTRENO.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => toggleTipo(t)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                tipoEntreno.includes(t)
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-medium'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

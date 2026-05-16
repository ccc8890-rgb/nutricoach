'use client'

const ENERGIA_OPCIONES = [
  { value: 'bajon_postcomida', label: 'Bajón post-comida', emoji: '😴' },
  { value: 'fatiga_tarde', label: 'Fatiga a media tarde', emoji: '🌇' },
  { value: 'hambre_nocturna', label: 'Hambre de noche', emoji: '🌙' },
  { value: 'cansancio_manana', label: 'Muy cansado/a por las mañanas', emoji: '☀️' },
  { value: 'ansiedad_dulce', label: 'Antojos de dulce frecuentes', emoji: '🍫' },
  { value: 'energia_constante', label: 'Energía bastante constante', emoji: '⚡' },
]

interface Props {
  horaPrimeraIngesta: string
  horaComidaPrincipal: string
  horaUltimaIngesta: string
  horaEntreno: string
  patronesEnergia: string[]
  onHoraChange: (field: string, v: string) => void
  onPatronesChange: (v: string[]) => void
  esAtleta: boolean
}

export default function StepTiming({
  horaPrimeraIngesta, horaComidaPrincipal, horaUltimaIngesta, horaEntreno,
  patronesEnergia, onHoraChange, onPatronesChange, esAtleta,
}: Props) {
  const toggle = (val: string) =>
    onPatronesChange(
      patronesEnergia.includes(val)
        ? patronesEnergia.filter(x => x !== val)
        : [...patronesEnergia, val]
    )

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Horarios y energía</h2>
      <p className="text-[var(--text-muted)] mb-6">El cuándo comes importa casi tanto como el qué comes.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Primera ingesta del día</label>
          <input
            type="time"
            value={horaPrimeraIngesta}
            onChange={e => onHoraChange('horaPrimeraIngesta', e.target.value)}
            className="input w-full"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">¿A qué hora desayunas o tomas algo?</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Comida principal</label>
          <input
            type="time"
            value={horaComidaPrincipal}
            onChange={e => onHoraChange('horaComidaPrincipal', e.target.value)}
            className="input w-full"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">Tu comida más completa del día</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Última ingesta</label>
          <input
            type="time"
            value={horaUltimaIngesta}
            onChange={e => onHoraChange('horaUltimaIngesta', e.target.value)}
            className="input w-full"
          />
          <p className="text-xs text-[var(--text-muted)] mt-1">¿A qué hora comes por última vez?</p>
        </div>
        {esAtleta && (
          <div>
            <label className="block text-sm font-medium text-[var(--text)] mb-1">Hora habitual de entreno</label>
            <input
              type="time"
              value={horaEntreno}
              onChange={e => onHoraChange('horaEntreno', e.target.value)}
              className="input w-full"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">Optimizamos la nutrición peri-entreno</p>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          ¿Cuál de estas situaciones te pasa con frecuencia?
          <span className="text-[var(--text-muted)] font-normal ml-1">(marca todas las que apliquen)</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {ENERGIA_OPCIONES.map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => toggle(op.value)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                patronesEnergia.includes(op.value)
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--primary)]/40'
              }`}
            >
              <span>{op.emoji}</span>
              <span className="leading-tight">{op.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

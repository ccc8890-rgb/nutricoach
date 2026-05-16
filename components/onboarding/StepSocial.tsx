'use client'

const CON_QUIEN_OPCIONES = [
  { value: 'solo', label: 'Solo/a casi siempre', emoji: '🧍' },
  { value: 'pareja', label: 'Con mi pareja', emoji: '👫' },
  { value: 'familia_ninos', label: 'Familia con niños', emoji: '👨‍👩‍👧' },
  { value: 'compis_trabajo', label: 'Compañeros de trabajo', emoji: '🏢' },
  { value: 'amigos_finde', label: 'Amigos los fines de semana', emoji: '🍻' },
  { value: 'varia', label: 'Varía mucho según el día', emoji: '🔄' },
]

const FRECUENCIA_FUERA_OPCIONES = [
  { value: '0', label: 'Casi nunca', desc: 'Como en casa siempre' },
  { value: '1-2', label: '1-2 veces', desc: 'Alguna comida esporádica' },
  { value: '3-4', label: '3-4 veces', desc: 'Bastante habitual' },
  { value: 'casi_siempre', label: 'Casi siempre', desc: 'Bar, menú o pedidos' },
]

interface Props {
  conQuienCome: string[]
  frecuenciaFuera: string
  comidaTrampa: string
  onConQuienChange: (v: string[]) => void
  onFrecuenciaChange: (v: string) => void
  onComidaTrampaChange: (v: string) => void
}

export default function StepSocial({
  conQuienCome, frecuenciaFuera, comidaTrampa,
  onConQuienChange, onFrecuenciaChange, onComidaTrampaChange,
}: Props) {
  const toggle = (val: string) =>
    onConQuienChange(
      conQuienCome.includes(val)
        ? conQuienCome.filter(x => x !== val)
        : [...conQuienCome, val]
    )

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Tu contexto social</h2>
      <p className="text-[var(--text-muted)] mb-6">Las comidas más difíciles de controlar son las sociales. Las planificamos también.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Con quién sueles comer habitualmente?</label>
        <div className="grid grid-cols-2 gap-2">
          {CON_QUIEN_OPCIONES.map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => toggle(op.value)}
              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left text-sm transition-all ${
                conQuienCome.includes(op.value)
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/40'
              }`}
            >
              <span className="text-lg">{op.emoji}</span>
              <span className="text-[var(--text)]">{op.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">¿Cuántas veces comes fuera de casa a la semana?</label>
        <div className="grid grid-cols-2 gap-2">
          {FRECUENCIA_FUERA_OPCIONES.map(op => (
            <button
              key={op.value}
              type="button"
              onClick={() => onFrecuenciaChange(op.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                frecuenciaFuera === op.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/40'
              }`}
            >
              <div className="font-medium text-[var(--text)] text-sm">{op.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{op.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          Si un día &quot;rompes&quot; el plan, ¿qué comerías probablemente?
        </label>
        <input
          type="text"
          value={comidaTrampa}
          onChange={e => onComidaTrampaChange(e.target.value)}
          className="input w-full"
          placeholder="Ej: pizza, hamburguesa, bollería, tapas con cañas..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Lo convertiremos en una &quot;válvula planificada&quot; para que no sabotee el plan.
        </p>
      </div>
    </div>
  )
}

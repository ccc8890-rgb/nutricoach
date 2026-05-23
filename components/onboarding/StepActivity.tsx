'use client'
import { Check } from 'lucide-react'

export type ActividadBase = 'sedentario' | 'ligero' | 'moderado' | 'activo' | 'muy_activo'

const ACTIVIDADES: { value: ActividadBase; label: string; desc: string }[] = [
  { value: 'sedentario',  label: 'Sedentario',          desc: 'Trabajo de escritorio, sin ejercicio regular' },
  { value: 'ligero',      label: 'Ligeramente activo',  desc: '1–2 días de ejercicio por semana' },
  { value: 'moderado',    label: 'Moderadamente activo', desc: '3–4 días de ejercicio por semana' },
  { value: 'activo',      label: 'Activo',               desc: '5–6 días o trabajo físico intenso' },
  { value: 'muy_activo',  label: 'Muy activo',           desc: 'Ejercicio intenso diario o deporte de competición' },
]

const TIPOS_ENTRENO = [
  'Gym / musculación', 'Running', 'CrossFit', 'Ciclismo',
  'Natación', 'HYROX', 'Artes marciales', 'Yoga / Pilates', 'Otro',
]

interface Props {
  actividad: ActividadBase | ''
  diasEntreno: number
  tipoEntreno: string[]
  duracionSesionMin: number
  horarioComidas: Array<{ nombre: string; hora: string }>
  onActividadChange: (v: ActividadBase) => void
  onDiasChange: (v: number) => void
  onTipoChange: (v: string[]) => void
  onDuracionChange: (v: number) => void
  onHorarioChange: (v: Array<{ nombre: string; hora: string }>) => void
}

export default function StepActivity({
  actividad, diasEntreno, tipoEntreno, duracionSesionMin, horarioComidas,
  onActividadChange, onDiasChange, onTipoChange, onDuracionChange, onHorarioChange,
}: Props) {
  const toggleTipo = (t: string) =>
    onTipoChange(tipoEntreno.includes(t) ? tipoEntreno.filter(x => x !== t) : [...tipoEntreno, t])

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Actividad
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        ¿Qué tan activo/a eres?
      </h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Determina las calorías que necesitas cada día.
      </p>

      {/* Nivel de actividad */}
      <div className="flex flex-col gap-2 mb-6">
        {ACTIVIDADES.map(a => {
          const sel = actividad === a.value
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onActividadChange(a.value)}
              className="flex items-center justify-between px-4 py-3.5 rounded-2xl text-left cursor-pointer transition-all duration-200 active:scale-[0.98]"
              style={{
                background: sel ? 'rgba(161,161,166,0.1)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              <div>
                <p className="font-semibold text-sm leading-tight" style={{ color: 'var(--text)' }}>{a.label}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.desc}</p>
              </div>
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ml-3 transition-all duration-200"
                style={{
                  background: sel ? 'var(--accent)' : 'transparent',
                  border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                }}
              >
                {sel && <Check size={9} strokeWidth={3} style={{ color: '#1C1C1E' }} />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Días + duración */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { label: 'Días entreno / semana', value: diasEntreno, min: 0, max: 7, onChange: onDiasChange, unit: 'd/sem' },
          { label: 'Duración media', value: duracionSesionMin, min: 15, max: 300, step: 15, onChange: onDuracionChange, unit: 'min' },
        ].map(({ label, value, min, max, step, onChange, unit }) => (
          <div key={label}>
            <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <div className="relative">
              <input
                type="number" inputMode="numeric"
                min={min} max={max} step={step ?? 1}
                value={value}
                onChange={e => onChange(parseInt(e.target.value) || 0)}
                className="input w-full pr-10 text-center font-semibold rounded-2xl"
                style={{ fontSize: '1.05rem' }}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                style={{ color: 'var(--text-muted)' }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tipo de entreno */}
      <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Tipo de entreno (opcional)
      </p>
      <div className="flex flex-wrap gap-2">
        {TIPOS_ENTRENO.map(t => {
          const sel = tipoEntreno.includes(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTipo(t)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200"
              style={{
                background: sel ? 'rgba(161,161,166,0.12)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                color: sel ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {t}
            </button>
          )
        })}
      </div>

      {/* Horario de comidas */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">
          ¿A qué hora haces cada comida? <span className="text-[var(--text-muted)]">(aproximado)</span>
        </label>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Importante para calcular el timing pre/post entreno.
        </p>
        <div className="flex flex-col gap-2">
          {['Desayuno','Comida','Merienda','Cena'].map(comidaNombre => {
            const entrada = horarioComidas.find(h => h.nombre === comidaNombre)
            return (
              <div key={comidaNombre} className="flex items-center gap-3">
                <span className="text-sm text-[var(--text)] w-24">{comidaNombre}</span>
                <input
                  type="time"
                  autoComplete="off"
                  value={entrada?.hora ?? ''}
                  onChange={e => {
                    const nuevo = horarioComidas.filter(h => h.nombre !== comidaNombre)
                    if (e.target.value) nuevo.push({ nombre: comidaNombre, hora: e.target.value })
                    onHorarioChange(nuevo)
                  }}
                  className="input w-28 text-sm"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

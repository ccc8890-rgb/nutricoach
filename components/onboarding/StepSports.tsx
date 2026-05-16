'use client'

interface Props {
  descripcionSemana: string
  fechaCompeticion: string
  tipoCompeticion: string
  nutricionPeriEntreno: string
  onDescripcionChange: (v: string) => void
  onFechaChange: (v: string) => void
  onTipoChange: (v: string) => void
  onNutricionChange: (v: string) => void
}

export default function StepSports({
  descripcionSemana, fechaCompeticion, tipoCompeticion, nutricionPeriEntreno,
  onDescripcionChange, onFechaChange, onTipoChange, onNutricionChange,
}: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Tu entrenamiento en detalle</h2>
      <p className="text-[var(--text-muted)] mb-6">Con estos datos optimizo la nutrición peri-entreno y la periodización.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          Describe tu semana de entrenamiento tipo
        </label>
        <textarea
          value={descripcionSemana}
          onChange={e => onDescripcionChange(e.target.value)}
          className="input w-full"
          rows={4}
          placeholder="Ej: lunes y miércoles gym (fuerza, 60 min, intensidad 7/10), martes y jueves running 40 min (rodaje suave), sábado tirada larga 1h30 (esfuerzo 8/10), domingo descanso..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Incluye tipo, duración e intensidad percibida si puedes.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            ¿Tienes competición próxima? <span className="text-[var(--text-muted)] font-normal">(fecha)</span>
          </label>
          <input
            type="date"
            value={fechaCompeticion}
            onChange={e => onFechaChange(e.target.value)}
            className="input w-full"
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--text)] mb-1">Tipo de evento / deporte</label>
          <input
            type="text"
            value={tipoCompeticion}
            onChange={e => onTipoChange(e.target.value)}
            className="input w-full"
            placeholder="Ej: HYROX, maratón, powerlifting..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Qué comes y bebes antes, durante y después de entrenar habitualmente?
        </label>
        <textarea
          value={nutricionPeriEntreno}
          onChange={e => onNutricionChange(e.target.value)}
          className="input w-full"
          rows={3}
          placeholder="Ej: antes nada / antes un plátano / durante isotónico o agua / después proteína en polvo y fruta / no como nada en todo el día hasta después de entrenar..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Esto nos dice exactamente qué ajustar para mejorar tu rendimiento y recuperación.</p>
      </div>
    </div>
  )
}

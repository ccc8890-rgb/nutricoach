'use client'

const ALCOHOL_OPCIONES = [
  { value: 'nada', label: 'Nada', desc: 'No bebo alcohol' },
  { value: '1-3', label: '1-3 unidades', desc: 'Una caña o copa esporádica' },
  { value: '4-7', label: '4-7 unidades', desc: 'Alguna salida o cena' },
  { value: 'mas_7', label: '+7 unidades', desc: 'Con bastante frecuencia' },
]

interface Props {
  diaTipico: string
  comidasFavoritas: string
  alimentosEvitarExtra: string
  alcoholSemanal: string
  suplementos: string
  onDiaTipicoChange: (v: string) => void
  onComidasFavoritasChange: (v: string) => void
  onAlimentosEvitarChange: (v: string) => void
  onAlcoholChange: (v: string) => void
  onSuplementosChange: (v: string) => void
}

export default function StepRealFood({
  diaTipico, comidasFavoritas, alimentosEvitarExtra, alcoholSemanal, suplementos,
  onDiaTipicoChange, onComidasFavoritasChange, onAlimentosEvitarChange,
  onAlcoholChange, onSuplementosChange,
}: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text)] mb-1">Lo que comes en la vida real</h2>
      <p className="text-[var(--text-muted)] mb-6">No lo que deberías comer — lo que comes de verdad. Sin juicios.</p>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Qué comes en un día normal de trabajo? <span className="text-[var(--text-muted)]">(de desayuno a cena)</span>
        </label>
        <textarea
          value={diaTipico}
          onChange={e => onDiaTipicoChange(e.target.value)}
          className="input w-full"
          rows={4}
          placeholder="Ej: desayuno café con leche y un bocadillo, a media mañana nada o fruta, como menú del día en el trabajo (primer plato, segundo y postre), meriendo unas galletas con el café, ceno lo que haya en casa — normalmente pasta, tortilla o sándwich..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Este es el dato más valioso de todo el cuestionario.</p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Qué 3-5 comidas o alimentos te encantan y quieres que estén en tu plan?
        </label>
        <textarea
          value={comidasFavoritas}
          onChange={e => onComidasFavoritasChange(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Ej: arroz con pollo, tortilla de patatas, salmón, yogur griego, pizza los sábados..."
        />
        <p className="text-xs text-[var(--text-muted)] mt-1">Tu plan se construye incluyéndolos, no prohibiéndolos.</p>
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Hay alimentos que no comerías bajo ningún concepto? <span className="text-[var(--text-muted)] font-normal">(opcional)</span>
        </label>
        <textarea
          value={alimentosEvitarExtra}
          onChange={e => onAlimentosEvitarChange(e.target.value)}
          className="input w-full"
          rows={2}
          placeholder="Ej: hígado, pescado azul, coles de Bruselas... (más allá de las intolerancias ya indicadas)"
        />
      </div>

      <div className="mb-5">
        <label className="block text-sm font-medium text-[var(--text)] mb-2">Alcohol a la semana (aproximado)</label>
        <div className="grid grid-cols-2 gap-2">
          {ALCOHOL_OPCIONES.map(a => (
            <button
              key={a.value}
              type="button"
              onClick={() => onAlcoholChange(a.value)}
              className={`p-3 rounded-xl border-2 text-left transition-all ${
                alcoholSemanal === a.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] hover:border-[var(--primary)]/40'
              }`}
            >
              <div className="font-medium text-[var(--text)] text-sm">{a.label}</div>
              <div className="text-xs text-[var(--text-muted)]">{a.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text)] mb-1">
          ¿Tomas algún suplemento habitualmente? <span className="text-[var(--text-muted)] font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={suplementos}
          onChange={e => onSuplementosChange(e.target.value)}
          className="input w-full"
          placeholder="Ej: proteína en polvo, creatina, omega-3, multivitamínico..."
        />
      </div>
    </div>
  )
}

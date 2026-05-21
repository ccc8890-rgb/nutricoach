'use client'
import { Check } from 'lucide-react'

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

export default function StepRestrictions({
  restricciones, alimentosNoGustan, onRestriccionesChange, onAlimentosNogustanChange,
}: Props) {
  const toggle = (r: string) =>
    onRestriccionesChange(
      restricciones.includes(r) ? restricciones.filter(x => x !== r) : [...restricciones, r]
    )

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
        Restricciones
      </p>
      <h2 className="text-2xl font-bold mb-1 leading-tight" style={{ color: 'var(--text)' }}>
        ¿Qué no puedes comer?
      </h2>
      <p className="text-sm mb-7" style={{ color: 'var(--text-muted)' }}>
        Intolerancias, alergias o preferencias. Puedes saltarte este paso si no aplica.
      </p>

      <div className="flex flex-wrap gap-2 mb-7">
        {RESTRICCIONES_OPCIONES.map(r => {
          const sel = restricciones.includes(r)
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium cursor-pointer transition-all duration-200"
              style={{
                background: sel ? 'rgba(161,161,166,0.12)' : 'var(--surface)',
                border: `1.5px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                color: sel ? 'var(--text)' : 'var(--text-muted)',
              }}
            >
              {sel && <Check size={11} strokeWidth={3} style={{ color: 'var(--accent)' }} />}
              {r}
            </button>
          )
        })}
      </div>

      <div>
        <p className="text-xs font-medium mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Alimentos que prefieres evitar
        </p>
        <textarea
          value={alimentosNoGustan}
          onChange={e => onAlimentosNogustanChange(e.target.value)}
          className="input w-full rounded-2xl resize-none"
          rows={3}
          placeholder="Ej: brócoli, coliflor, pescado azul…"
          style={{ lineHeight: '1.6' }}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          Los evitaremos siempre que sea posible.
        </p>
      </div>
    </div>
  )
}

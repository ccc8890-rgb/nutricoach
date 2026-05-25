'use client'

import {
  RECETA_DEPORTES,
  RECETA_ESTILOS,
  RECETA_LABELS,
  RECETA_MOMENTOS,
  RECETA_OBJETIVOS,
} from '@/lib/recetario-taxonomia'

type TaxonomiaReceta = {
  objetivos: string[]
  deportes: string[]
  momentos: string[]
  estilos: string[]
  premium_chef: boolean
  uso_personal: boolean
  batch_cooking: boolean
  tupper: boolean
  digestibilidad: string
  densidad_energetica: string
  nivel_elaboracion: number
  adherencia_score: number
  coste_estimado_nivel: string
}

type Props = {
  value: TaxonomiaReceta
  onChange: (value: TaxonomiaReceta) => void
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value]
}

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={active
        ? { background: 'var(--text)', borderColor: 'var(--text)', color: 'var(--bg)' }
        : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
    >
      {children}
    </button>
  )
}

function ChipGroup({
  title,
  description,
  items,
  selected,
  onChange,
}: {
  title: string
  description: string
  items: readonly string[]
  selected: string[]
  onChange: (items: string[]) => void
}) {
  return (
    <div>
      <div className="mb-2">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <Chip key={item} active={selected.includes(item)} onClick={() => onChange(toggle(selected, item))}>
            {RECETA_LABELS[item] ?? item}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export default function TaxonomiaRecetaPanel({ value, onChange }: Props) {
  return (
    <div className="card flex flex-col gap-5">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Taxonomía inteligente</p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Estos campos alimentan el motor de agentes, los intercambios y la cobertura del recetario.
        </p>
      </div>

      <ChipGroup
        title="Objetivos"
        description="Para qué tipo de cliente encaja mejor."
        items={RECETA_OBJETIVOS}
        selected={value.objetivos}
        onChange={objetivos => onChange({ ...value, objetivos })}
      />

      <ChipGroup
        title="Disciplinas"
        description="Contexto deportivo principal."
        items={RECETA_DEPORTES}
        selected={value.deportes}
        onChange={deportes => onChange({ ...value, deportes })}
      />

      <ChipGroup
        title="Momentos"
        description="Dónde puede entrar dentro de la dieta."
        items={RECETA_MOMENTOS}
        selected={value.momentos}
        onChange={momentos => onChange({ ...value, momentos })}
      />

      <ChipGroup
        title="Estilo"
        description="Identidad culinaria y uso práctico."
        items={RECETA_ESTILOS}
        selected={value.estilos}
        onChange={estilos => onChange({ ...value, estilos })}
      />

      <div className="grid gap-3 md:grid-cols-2">
        {[
          ['premium_chef', 'Chef healthy'],
          ['uso_personal', 'Uso personal/específico'],
          ['batch_cooking', 'Batch cooking'],
          ['tupper', 'Tupper'],
        ].map(([key, text]) => (
          <label
            key={key}
            className="flex items-center gap-3 rounded-xl border p-3 text-sm font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--text)', background: 'var(--bg)' }}
          >
            <input
              type="checkbox"
              checked={Boolean(value[key as keyof TaxonomiaReceta])}
              onChange={e => onChange({ ...value, [key]: e.target.checked })}
            />
            {text}
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Digestibilidad</label>
          <select className="input" value={value.digestibilidad} onChange={e => onChange({ ...value, digestibilidad: e.target.value })}>
            <option value="">Sin definir</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Densidad energética</label>
          <select className="input" value={value.densidad_energetica} onChange={e => onChange({ ...value, densidad_energetica: e.target.value })}>
            <option value="">Sin definir</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Nivel elaboración</label>
          <input className="input" type="number" min={1} max={5} value={value.nivel_elaboracion} onChange={e => onChange({ ...value, nivel_elaboracion: Number(e.target.value) || 1 })} />
        </div>
        <div>
          <label className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Adherencia estimada</label>
          <input className="input" type="number" min={0} max={100} value={value.adherencia_score} onChange={e => onChange({ ...value, adherencia_score: Number(e.target.value) || 0 })} />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm" style={{ color: 'var(--text-secondary)' }}>Coste estimado</label>
          <select className="input" value={value.coste_estimado_nivel} onChange={e => onChange({ ...value, coste_estimado_nivel: e.target.value })}>
            <option value="">Sin definir</option>
            <option value="bajo">Bajo</option>
            <option value="medio">Medio</option>
            <option value="alto">Alto</option>
          </select>
        </div>
      </div>
    </div>
  )
}

export type { TaxonomiaReceta }

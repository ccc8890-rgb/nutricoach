'use client'

import {
  BLOQUES_SESION,
  etiquetaBloqueSesion,
  type TipoBloqueSesion,
} from '@/lib/training/session-blocks'

interface Props {
  value: TipoBloqueSesion
  disabled?: boolean
  onChange: (value: TipoBloqueSesion) => void
}

export default function ExerciseBlockSelect({ value, disabled = false, onChange }: Props) {
  return (
    <select
      aria-label="Bloque del ejercicio"
      value={value}
      disabled={disabled}
      onChange={event => onChange(event.target.value as TipoBloqueSesion)}
      className="max-w-32 rounded-md px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.08em]"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
    >
      {BLOQUES_SESION.map(bloque => (
        <option key={bloque} value={bloque}>{etiquetaBloqueSesion(bloque)}</option>
      ))}
    </select>
  )
}

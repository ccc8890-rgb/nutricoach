'use client'

import { useEffect, useState } from 'react'
import { CaretDown, CheckCircle, Warning, XCircle } from '@phosphor-icons/react'
import type { ComprobacionSistema, NivelEstado } from '@/lib/sistema/estado'

type Estado = { nivel: NivelEstado; resumen: string; comprobaciones: ComprobacionSistema[] }

const COLOR: Record<NivelEstado, string> = { ok: 'var(--success)', aviso: 'var(--warning)', error: 'var(--error)' }
const ICONO = { ok: CheckCircle, aviso: Warning, error: XCircle }

// Una sola línea: ¿está funcionando todo el sistema (IA, tareas automáticas, relojes)? Se despliega aquí mismo.
export default function EstadoSistemaBarra() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    fetch('/api/sistema/estado')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setEstado)
      .catch(() => setEstado(null))
  }, [])

  if (!estado) return null
  return (
    <section className="coach-system-strip" data-level={estado.nivel}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        className="coach-system-strip__trigger"
      >
        <span className="coach-system-strip__signal" aria-hidden="true" />
        <span className="coach-system-strip__label">Sistema</span>
        <span className="coach-system-strip__summary">{estado.resumen}</span>
        <span className="coach-system-strip__detail">
          {abierto ? 'Cerrar' : 'Detalle'}
          <CaretDown size={14} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </span>
      </button>
      {abierto && (
        <ul className="coach-system-strip__checks">
          {estado.comprobaciones.map(c => {
            const I = ICONO[c.nivel]
            return (
              <li key={c.id}>
                <I size={15} weight="regular" style={{ color: COLOR[c.nivel] }} />
                <span>
                  <strong>{c.nombre}</strong> <span>{c.detalle}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

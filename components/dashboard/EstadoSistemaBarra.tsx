'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown } from 'lucide-react'
import type { ComprobacionSistema, NivelEstado } from '@/lib/sistema/estado'

type Estado = { nivel: NivelEstado; resumen: string; comprobaciones: ComprobacionSistema[] }

const COLOR: Record<NivelEstado, string> = { ok: '#10B981', aviso: '#D97706', error: '#EF4444' }
const ICONO = { ok: CheckCircle2, aviso: AlertTriangle, error: XCircle }

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
    <div className="rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 px-4 py-3 text-left text-[15px]"
      >
        <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[estado.nivel] }} />
        <span className="font-medium" style={{ color: 'var(--text)' }}>Sistema: {estado.resumen}</span>
        <span className="ml-auto flex items-center gap-1 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          {abierto ? 'Ocultar' : 'Ver detalle'}
          <ChevronDown size={16} className={abierto ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </span>
      </button>
      {abierto && (
        <ul className="space-y-2.5 border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          {estado.comprobaciones.map(c => {
            const I = ICONO[c.nivel]
            return (
              <li key={c.id} className="flex items-start gap-2.5 text-[14px]">
                <I size={17} className="mt-0.5 shrink-0" style={{ color: COLOR[c.nivel] }} />
                <span style={{ color: 'var(--text)' }}>
                  <strong>{c.nombre}.</strong> <span style={{ color: 'var(--text-secondary)' }}>{c.detalle}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

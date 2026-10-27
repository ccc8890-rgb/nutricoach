'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, XCircle, Loader2 } from '@/components/icons/lucide'
import type { ComprobacionSistema, NivelEstado } from '@/lib/sistema/estado'

type Estado = { nivel: NivelEstado; resumen: string; comprobaciones: ComprobacionSistema[] }

const COLOR: Record<NivelEstado, string> = { ok: '#10B981', aviso: '#D97706', error: '#EF4444' }
const ICONO = { ok: CheckCircle2, aviso: AlertTriangle, error: XCircle }

export default function EstadoSistema() {
  const [estado, setEstado] = useState<Estado | null>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    fetch('/api/sistema/estado')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setEstado)
      .catch(() => setFallo(true))
  }, [])

  if (fallo) return <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No se pudo comprobar el estado ahora mismo.</p>
  if (!estado) return <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><Loader2 size={16} className="animate-spin" /> Comprobando…</p>

  const Icono = ICONO[estado.nivel]
  return (
    <div>
      <p className="flex items-center gap-2 text-base font-semibold" style={{ color: COLOR[estado.nivel] }}>
        <Icono size={20} /> {estado.resumen}
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>Ver detalle</summary>
        <ul className="mt-2 space-y-2">
          {estado.comprobaciones.map(c => {
            const I = ICONO[c.nivel]
            return (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <I size={16} className="mt-0.5 shrink-0" style={{ color: COLOR[c.nivel] }} />
                <span style={{ color: 'var(--text)' }}><strong>{c.nombre}.</strong> <span style={{ color: 'var(--text-secondary)' }}>{c.detalle}</span></span>
              </li>
            )
          })}
        </ul>
        <Link href="/agentes" className="mt-3 inline-block text-sm underline" style={{ color: 'var(--text-secondary)' }}>Ver tareas y ejecuciones de los agentes</Link>
      </details>
    </div>
  )
}

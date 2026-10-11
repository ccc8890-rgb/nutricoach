'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { NivelEstado } from '@/lib/sistema/estado'

const COLOR: Record<NivelEstado, string> = { ok: '#10B981', aviso: '#D97706', error: '#EF4444' }

// Una sola línea: ¿está funcionando todo el sistema (IA, tareas automáticas, relojes)?
export default function EstadoSistemaBarra() {
  const [estado, setEstado] = useState<{ nivel: NivelEstado; resumen: string } | null>(null)

  useEffect(() => {
    fetch('/api/sistema/estado')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setEstado)
      .catch(() => setEstado(null))
  }, [])

  if (!estado) return null
  return (
    <Link
      href="/ajustes"
      className="flex items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-colors hover:bg-[var(--surface-hover)]"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLOR[estado.nivel] }} />
      <span className="font-medium" style={{ color: 'var(--text)' }}>Sistema: {estado.resumen}</span>
      <span className="ml-auto text-[13px]" style={{ color: 'var(--text-muted)' }}>Ver detalle</span>
    </Link>
  )
}

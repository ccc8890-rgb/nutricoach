'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { PLANOS, alternarPlano } from '@/lib/contenido/escaleta'
import { api } from './api'

export default function EscaletaPlanos({ piezaId, hechos, onCambio }: { piezaId: string; hechos: string[]; onCambio: () => void }) {
  const { addToast } = useToast()
  const [local, setLocal] = useState(hechos)

  async function alternar(id: string) {
    const siguiente = alternarPlano(local, id)
    setLocal(siguiente)
    const r = await api(`/api/contenido/piezas/${piezaId}`, { method: 'PATCH', body: JSON.stringify({ planos_hechos: siguiente }) })
    if (!r.ok) { setLocal(local); addToast({ type: 'error', title: 'No se pudo guardar el plano', message: r.error }); return }
    onCambio()
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 4 }}>
      {PLANOS.map(p => (
        <li key={p.id}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
            <input type="checkbox" checked={local.includes(p.id)} onChange={() => alternar(p.id)} />
            <span style={{ textDecoration: local.includes(p.id) ? 'line-through' : 'none', color: local.includes(p.id) ? 'var(--text-muted)' : 'var(--text)' }}>{p.texto}</span>
          </label>
        </li>
      ))}
    </ul>
  )
}

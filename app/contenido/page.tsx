'use client'

import { useState } from 'react'
import BandejaIdeas from '@/components/contenido/BandejaIdeas'

// Las siguientes tareas añaden aquí el resto de vistas (tanda, tablero, calendario).
const VISTAS = [
  { id: 'bandeja', label: 'Bandeja' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function ContenidoPage() {
  const [vista, setVista] = useState<Vista>('bandeja')
  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 960 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contenido</h1>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={`btn btn-sm ${vista === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {vista === 'bandeja' && <BandejaIdeas />}
    </div>
  )
}

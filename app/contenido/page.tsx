'use client'

import { useState } from 'react'
import BandejaIdeas from '@/components/contenido/BandejaIdeas'
import CalendarioContenido from '@/components/contenido/CalendarioContenido'
import DiaGrabacion from '@/components/contenido/DiaGrabacion'
import TableroContenido from '@/components/contenido/TableroContenido'

const VISTAS = [
  { id: 'bandeja', label: 'Bandeja' },
  { id: 'tanda', label: 'Día de grabación' },
  { id: 'tablero', label: 'Tablero' },
  { id: 'calendario', label: 'Calendario' },
] as const
type Vista = typeof VISTAS[number]['id']

export default function ContenidoPage() {
  const [vista, setVista] = useState<Vista>('bandeja')
  const [fechaTanda, setFechaTanda] = useState<string | undefined>(undefined)

  return (
    <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 1100 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Contenido</h1>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {VISTAS.map(v => (
          <button key={v.id} role="tab" aria-selected={vista === v.id} className={`btn btn-sm ${vista === v.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setVista(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {vista === 'bandeja' && <BandejaIdeas />}
      {vista === 'tanda' && <DiaGrabacion key={fechaTanda ?? 'hoy'} fechaInicial={fechaTanda} />}
      {vista === 'tablero' && <TableroContenido />}
      {vista === 'calendario' && <CalendarioContenido onAbrirDia={f => { setFechaTanda(f); setVista('tanda') }} />}
    </div>
  )
}

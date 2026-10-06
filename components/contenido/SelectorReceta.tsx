'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { api } from './api'

type Resultado = { id: string; nombre: string; imagen_url: string | null; tiempo_prep_min: number | null }

export default function SelectorReceta({ onElegir, placeholder = 'Buscar en el recetario…' }: { onElegir: (r: Resultado) => void; placeholder?: string }) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<Resultado[]>([])

  useEffect(() => {
    const t = setTimeout(async () => {
      const r = await api<{ recetas: Resultado[] }>(`/api/contenido/recetas?q=${encodeURIComponent(q)}`)
      if (r.ok) setResultados(r.data.recetas)
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div className="card" style={{ padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Search size={14} style={{ color: 'var(--text-muted)' }} />
        <input className="input" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} />
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 6 }}>
        {resultados.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: 6 }}>Sin resultados</p>}
        {resultados.map(r => (
          <button key={r.id} type="button" className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => onElegir(r)}>
            {r.nombre}{r.tiempo_prep_min ? ` · ${r.tiempo_prep_min} min` : ''}
          </button>
        ))}
      </div>
    </div>
  )
}

'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileCheck2, Link2, Plus, Trash2, Video } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { interpretarEntrada } from '@/lib/contenido/enlace'
import { ETIQUETA_ESTADO } from '@/lib/contenido/estados'
import { api } from './api'
import SelectorReceta from './SelectorReceta'
import type { Pieza } from './tipos'

const ESTADOS_BANDEJA = ['idea', 'documentada']

export default function BandejaIdeas() {
  const { addToast } = useToast()
  const [texto, setTexto] = useState('')
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [cargando, setCargando] = useState(true)
  const [enlazando, setEnlazando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas.filter(p => ESTADOS_BANDEJA.includes(p.estado)))
    else addToast({ type: 'error', title: 'No se pudieron cargar las ideas', message: r.error })
    setCargando(false)
  }, [addToast])

  useEffect(() => { cargar() }, [cargar])

  async function apuntar() {
    const { titulo, enlace } = interpretarEntrada(texto)
    if (!titulo) return
    const r = await api('/api/contenido/piezas', { method: 'POST', body: JSON.stringify({ titulo, enlace_referencia: enlace }) })
    if (!r.ok) { addToast({ type: 'error', title: 'No se pudo apuntar', message: r.error }); return }
    setTexto('')
    cargar()
  }

  async function cambiar(id: string, cambios: Record<string, unknown>) {
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo actualizar', message: r.error })
    setEnlazando(null)
    cargar()
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta idea?')) return
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'DELETE' })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo borrar', message: r.error })
    cargar()
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <form onSubmit={e => { e.preventDefault(); apuntar() }} style={{ display: 'flex', gap: 8 }}>
        <input className="input" style={{ flex: 1 }} value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Una nota, un enlace del reel o ambos…" aria-label="Apuntar una idea" />
        <button className="btn btn-primary" type="submit"><Plus size={16} /> Apuntar</button>
      </form>

      {cargando && <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
      {!cargando && piezas.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay ideas pendientes. Apunta la primera arriba.</p>}

      {piezas.map(p => (
        <div key={p.id} className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <strong>{p.titulo}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ETIQUETA_ESTADO[p.estado]}</span>
          </div>
          {p.enlace_referencia && (
            <a href={p.enlace_referencia} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>
              <Link2 size={13} /> Ver referencia
            </a>
          )}
          <div style={{ fontSize: 13, color: p.receta ? 'var(--success)' : 'var(--warning)' }}>
            {p.receta ? `Receta en el recetario: ${p.receta.nombre}` : 'Aún sin receta en el recetario'}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {p.receta && p.estado === 'idea' && (
              <button className="btn btn-secondary btn-sm" onClick={() => cambiar(p.id, { estado: 'documentada' })}><FileCheck2 size={14} /> Pasar a documentada</button>
            )}
            {!p.receta && <button className="btn btn-secondary btn-sm" onClick={() => setEnlazando(enlazando === p.id ? null : p.id)}>Enlazar receta</button>}
            <button className="btn btn-secondary btn-sm" onClick={() => cambiar(p.id, { estado: 'para_grabar' })}><Video size={14} /> Marcar para grabar</button>
            <button className="btn btn-ghost btn-sm" onClick={() => borrar(p.id)} aria-label="Borrar idea"><Trash2 size={14} /></button>
          </div>
          {enlazando === p.id && <SelectorReceta onElegir={r => cambiar(p.id, { receta_id: r.id })} />}
        </div>
      ))}
    </div>
  )
}

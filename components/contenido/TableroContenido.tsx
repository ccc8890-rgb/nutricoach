'use client'

import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { ESTADOS_PIEZA, ETIQUETA_ESTADO, type EstadoPieza } from '@/lib/contenido/estados'
import { api } from './api'
import type { Pieza } from './tipos'

type Filtro = 'todas' | 'dieta' | 'prueba'

export default function TableroContenido() {
  const { addToast } = useToast()
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todas')

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas)
    else addToast({ type: 'error', title: 'No se pudo cargar el tablero', message: r.error })
  }, [addToast])
  useEffect(() => { cargar() }, [cargar])

  async function cambiar(id: string, cambios: Record<string, unknown>) {
    const r = await api(`/api/contenido/piezas/${id}`, { method: 'PATCH', body: JSON.stringify(cambios) })
    if (!r.ok) addToast({ type: 'error', title: 'No se pudo actualizar', message: r.error })
    cargar()
  }

  const visibles = piezas.filter(p => filtro === 'todas' || (filtro === 'dieta' ? p.plan_id : !p.plan_id))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {([['todas', 'Todas'], ['dieta', 'Entran en dieta'], ['prueba', 'Platos de prueba']] as [Filtro, string][]).map(([id, label]) => (
          <button key={id} className={`btn btn-sm ${filtro === id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFiltro(id)}>{label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {ESTADOS_PIEZA.map(estado => {
          const columna = visibles.filter(p => p.estado === estado)
          return (
            <section key={estado} style={{ minWidth: 230, flex: '0 0 230px' }} aria-label={ETIQUETA_ESTADO[estado]}>
              <h3 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{ETIQUETA_ESTADO[estado]} · {columna.length}</h3>
              <div style={{ display: 'grid', gap: 8 }}>
                {columna.map(p => (
                  <div key={p.id} className="card" style={{ padding: 10, display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 14 }}>{p.titulo}</strong>
                    <select className="input" value={p.estado} aria-label="Estado" onChange={e => cambiar(p.id, { estado: e.target.value as EstadoPieza })}>
                      {ESTADOS_PIEZA.map(e => <option key={e} value={e}>{ETIQUETA_ESTADO[e]}</option>)}
                    </select>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grabar{' '}
                      <input className="input" type="date" value={p.fecha_grabacion ?? ''} onChange={e => cambiar(p.id, { fecha_grabacion: e.target.value || null })} />
                    </label>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Publicar{' '}
                      <input className="input" type="date" value={p.fecha_publicacion ?? ''} onChange={e => cambiar(p.id, { fecha_publicacion: e.target.value || null })} />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

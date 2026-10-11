'use client'

import { useEffect, useState } from 'react'
import { Loader2, Trash2, X } from 'lucide-react'

export type SemanaPlantilla = { dias: { dia: string; comidas: { franja: string; receta_id: string; nombre: string }[] }[] }
export type PlantillaSemana = { id: string; nombre: string; descripcion: string | null; etiquetas: string[]; semanas: SemanaPlantilla[]; created_at: string; origen?: 'coach' | 'base' }

export const contarPlatos = (semanas: SemanaPlantilla[]) => semanas.reduce((n, s) => n + s.dias.reduce((m, d) => m + d.comidas.length, 0), 0)
const textoSemanas = (n: number) => (n === 1 ? '1 semana' : `${n} semanas`)

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl p-4" style={{ background: 'var(--surface)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold" style={{ color: 'var(--text)' }}>{titulo}</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function GuardarPlantillaModal({ semanas, onClose, onGuardada }: { semanas: SemanaPlantilla[]; onClose: () => void; onGuardada: () => void }) {
  const [nombre, setNombre] = useState('')
  const [etiquetas, setEtiquetas] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setGuardando(true); setError(null)
    const res = await fetch('/api/plantillas-semana-dieta', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, descripcion, etiquetas: etiquetas.split(',').map(e => e.trim()).filter(Boolean), semanas }),
    })
    const data = await res.json().catch(() => null)
    setGuardando(false)
    if (!res.ok) { setError(data?.error ?? 'No se pudo guardar'); return }
    onGuardada()
  }

  return (
    <Modal titulo="Guardar como plantilla" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Se guardan {textoSemanas(semanas.length)} con {contarPlatos(semanas)} platos (qué receta va en cada día y franja). Las cantidades no se guardan: al aplicarla a otro cliente se ajustan a su objetivo.
      </p>
      <input autoFocus autoComplete="off" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre (p. ej. Híbrido 2.800 kcal · 4 semanas)" className="input w-full text-sm mb-2" />
      <input autoComplete="off" value={etiquetas} onChange={e => setEtiquetas(e.target.value)} placeholder="Etiquetas separadas por coma (runner, vegano, volumen…)" className="input w-full text-sm mb-2" />
      <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Para qué tipo de cliente sirve (opcional)" rows={2} className="input w-full text-sm mb-3" />
      {error && <p className="text-xs mb-2" style={{ color: 'var(--error)' }}>{error}</p>}
      <button onClick={guardar} disabled={guardando || !nombre.trim()} className="rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5" style={{ background: 'var(--primary)', color: 'var(--bg)' }}>
        {guardando && <Loader2 size={13} className="animate-spin" />} Guardar plantilla
      </button>
    </Modal>
  )
}

export function ListaPlantillasModal({ onClose, onAplicar }: { onClose: () => void; onAplicar: (p: PlantillaSemana, desde: 0 | 1) => void }) {
  const [plantillas, setPlantillas] = useState<PlantillaSemana[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState('')

  useEffect(() => {
    let vivo = true
    fetch('/api/plantillas-semana-dieta').then(async r => {
      const d = await r.json().catch(() => null)
      if (!vivo) return
      if (!r.ok) setError(d?.error ?? 'No se pudieron cargar'); else setPlantillas(d.plantillas)
    })
    return () => { vivo = false }
  }, [])

  async function borrar(p: PlantillaSemana) {
    if (!confirm(`¿Borrar la plantilla «${p.nombre}»?`)) return
    const res = await fetch(`/api/plantillas-semana-dieta?id=${p.id}`, { method: 'DELETE' })
    if (res.ok) setPlantillas(l => (l ?? []).filter(x => x.id !== p.id)); else setError('No se pudo borrar')
  }

  const q = filtro.trim().toLowerCase()
  const lista = (plantillas ?? []).filter(p => !q || `${p.nombre} ${p.etiquetas.join(' ')} ${p.descripcion ?? ''}`.toLowerCase().includes(q))

  return (
    <Modal titulo="Plantillas de planificación" onClose={onClose}>
      <input autoComplete="off" value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar por nombre o etiqueta…" className="input w-full text-sm mb-3" />
      {error && <p className="text-xs mb-2" style={{ color: 'var(--error)' }}>{error}</p>}
      <div className="overflow-y-auto space-y-2 flex-1">
        {plantillas === null && !error ? <div className="py-6 flex justify-center"><Loader2 size={18} className="animate-spin" /></div> :
          lista.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>{plantillas?.length ? 'Sin resultados' : 'Aún no hay plantillas. Guarda una desde «Guardar como plantilla».'}</p> :
          lista.map(p => (
            <div key={p.id} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{p.nombre}{p.origen === 'base' && <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium align-middle" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>base</span>}</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{textoSemanas(p.semanas.length)} · {contarPlatos(p.semanas)} platos · {new Date(p.created_at).toLocaleDateString('es-ES')}</p>
                  {p.etiquetas.length > 0 && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.etiquetas.map(e => `#${e}`).join(' ')}</p>}
                  {p.descripcion && <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.descripcion}</p>}
                </div>
                <button title="Borrar plantilla" onClick={() => borrar(p)} style={{ color: 'var(--text-muted)' }}><Trash2 size={14} /></button>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button onClick={() => onAplicar(p, 1)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium" style={{ background: 'var(--primary)', color: 'var(--bg)' }}>Aplicar desde la semana +1</button>
                <button onClick={() => onAplicar(p, 0)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>Aplicar desde la semana en curso</button>
              </div>
            </div>
          ))}
      </div>
    </Modal>
  )
}

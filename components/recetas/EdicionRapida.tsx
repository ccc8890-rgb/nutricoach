'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, Pencil } from 'lucide-react'
import { CATEGORIAS } from '@/lib/recetas-constants'
import { TAG_CORREGIR } from '@/lib/recetas/correcciones'
import { TAG_REPORTE_CLIENTE } from '@/lib/recetas/reportes'

type Datos = { id: string; nombre: string; descripcion?: string | null; tiempo_prep_min?: number | null; categoria?: string | null; tags?: string[] }

/** Edición en el sitio de campos sin efecto en macros. Ingredientes y gramos siguen en el editor completo. */
export default function EdicionRapida({ receta, onGuardado }: { receta: Datos; onGuardado: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState(receta.nombre)
  const [descripcion, setDescripcion] = useState(receta.descripcion ?? '')
  const [tiempo, setTiempo] = useState(String(receta.tiempo_prep_min ?? ''))
  const [categoria, setCategoria] = useState(receta.categoria ?? '')
  const [tags, setTags] = useState((receta.tags ?? []).filter(t => t !== TAG_CORREGIR && t !== TAG_REPORTE_CLIENTE).join(', '))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function guardar() {
    setGuardando(true); setError('')
    try {
      const cuerpo: Record<string, unknown> = {
        nombre, descripcion, categoria,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      }
      if (tiempo.trim() !== '') cuerpo.tiempo_prep_min = Number(tiempo)
      const res = await fetch(`/api/recetas/${receta.id}/campos`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(j.error ?? 'No se pudo guardar'); return }
      setAbierto(false)
      onGuardado()
    } catch {
      setError('No se pudo guardar. Revisa la conexión.')
    } finally {
      setGuardando(false)
    }
  }

  const campo = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }
  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
        <Pencil size={13} /> Editar rápido
      </button>
    )
  }
  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} aria-label="Nombre" className="w-full rounded-lg p-2 text-sm" style={campo} />
      <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} aria-label="Descripción" className="w-full rounded-lg p-2 text-sm" style={campo} />
      <div className="grid grid-cols-2 gap-3">
        <input value={tiempo} onChange={e => setTiempo(e.target.value)} inputMode="numeric" placeholder="Minutos de preparación" aria-label="Minutos de preparación" className="rounded-lg p-2 text-sm" style={campo} />
        <select value={categoria} onChange={e => setCategoria(e.target.value)} aria-label="Categoría" className="rounded-lg p-2 text-sm" style={campo}>
          <option value="">Sin categoría</option>
          {CATEGORIAS.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Etiquetas separadas por comas" aria-label="Etiquetas" className="w-full rounded-lg p-2 text-sm" style={campo} />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Para cambiar ingredientes o gramos usa el <Link href={`/recetas/${receta.id}/editar`} className="underline">editor completo</Link>.
      </p>
      {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
      <div className="flex gap-2">
        <button onClick={guardar} disabled={guardando} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
          {guardando && <Loader2 size={13} className="animate-spin" />} Guardar
        </button>
        <button onClick={() => setAbierto(false)} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
      </div>
    </div>
  )
}

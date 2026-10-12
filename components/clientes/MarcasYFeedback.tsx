'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { MARCAS, PREGUNTAS_CIERRE, VALORACIONES } from '@/lib/entrenos/marcas'

interface Datos { marcas: Record<string, number>; bloques: { plan_id: string; plan: string; fecha: string; respuestas: { clave: string; valoracion: string }[] }[] }
const fetchJson = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null))
const COLOR: Record<string, string> = { flojo: 'var(--semantic-active)', justo: 'var(--text-secondary)', pesado: 'var(--semantic-alert-text, var(--text))' }

/** Lo que el propio atleta ha dicho (marcas y cierre de bloque): dato real que el generador usa para el siguiente plan. */
export default function MarcasYFeedback({ clienteId }: { clienteId: string }) {
  const { data, mutate } = useSWR<Datos | null>(`/api/clientes/${clienteId}/marcas-feedback`, fetchJson, { revalidateOnFocus: false })
  const [editando, setEditando] = useState(false)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!data) return null

  const empezar = () => { setValores(Object.fromEntries(MARCAS.map(m => [m.clave, data.marcas[m.clave] != null ? String(data.marcas[m.clave]) : '']))); setError(null); setEditando(true) }
  const guardar = async () => {
    setGuardando(true); setError(null)
    const res = await fetch(`/api/clientes/${clienteId}/marcas-feedback`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marcas: valores }) })
    setGuardando(false)
    if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? 'No se pudo guardar'); return }
    await mutate(); setEditando(false)
  }
  const marcas = MARCAS.filter(m => data.marcas[m.clave] != null)
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Lo que dice el atleta</h3>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>Marcas y cómo fueron las cargas de cada bloque. El siguiente plan parte de esto.</p>

      <div className="flex items-center justify-between mb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Marcas</p>
        {!editando && <button type="button" onClick={empezar} className="text-xs underline" style={{ color: 'var(--text-secondary)' }}>Editar</button>}
      </div>
      {editando ? (
        <div className="mb-3 space-y-2">
          {MARCAS.map(m => (
            <label key={m.clave} className="flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--text)' }}>
              <span>{m.etiqueta}</span>
              <span className="flex items-center gap-1">
                <input inputMode="decimal" value={valores[m.clave] ?? ''} onChange={e => setValores(v => ({ ...v, [m.clave]: e.target.value }))} className="input w-20 text-right" autoComplete="off" />
                <span className="text-xs w-8" style={{ color: 'var(--text-muted)' }}>{m.unidad}</span>
              </span>
            </label>
          ))}
          {error && <p className="text-xs" style={{ color: 'var(--semantic-alert-text, var(--text))' }}>{error}</p>}
          <div className="flex gap-3 text-sm">
            <button type="button" onClick={guardar} disabled={guardando} className="font-semibold underline" style={{ color: 'var(--text)' }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" onClick={() => setEditando(false)} style={{ color: 'var(--text-muted)' }}>Cancelar</button>
          </div>
        </div>
      ) : marcas.length === 0 ? (
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Aún no ha puesto ninguna. Los pesos del plan son estimaciones.</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {marcas.map(m => (
            <li key={m.clave} className="flex justify-between text-sm" style={{ color: 'var(--text)' }}>
              <span>{m.etiqueta}</span><span className="tabular-nums font-semibold">{data.marcas[m.clave]} {m.unidad}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Cierre de bloque</p>
      {data.bloques.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Sin respuestas todavía: se le pregunta en la última semana de cada bloque.</p>
      ) : data.bloques.map(b => (
        <div key={b.plan_id} className="mb-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{b.plan} · {new Date(b.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
          <ul className="mt-1 space-y-0.5">
            {b.respuestas.map(r => (
              <li key={r.clave} className="flex justify-between text-sm" style={{ color: 'var(--text)' }}>
                <span>{PREGUNTAS_CIERRE.find(p => p.clave === r.clave)?.etiqueta ?? r.clave}</span>
                <span className="font-semibold" style={{ color: COLOR[r.valoracion] }}>{VALORACIONES.find(v => v.valor === r.valoracion)?.etiqueta ?? r.valoracion}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

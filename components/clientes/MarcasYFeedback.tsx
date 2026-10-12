'use client'
import useSWR from 'swr'
import { MARCAS, PREGUNTAS_CIERRE, VALORACIONES } from '@/lib/entrenos/marcas'

interface Datos { marcas: Record<string, number>; bloques: { plan_id: string; plan: string; fecha: string; respuestas: { clave: string; valoracion: string }[] }[] }
const fetchJson = (u: string) => fetch(u).then(r => (r.ok ? r.json() : null))
const COLOR: Record<string, string> = { flojo: 'var(--semantic-active)', justo: 'var(--text-secondary)', pesado: 'var(--semantic-alert-text, var(--text))' }

/** Lo que el propio atleta ha dicho (marcas y cierre de bloque): dato real que el generador usa para el siguiente plan. */
export default function MarcasYFeedback({ clienteId }: { clienteId: string }) {
  const { data } = useSWR<Datos | null>(`/api/clientes/${clienteId}/marcas-feedback`, fetchJson, { revalidateOnFocus: false })
  if (!data) return null
  const marcas = MARCAS.filter(m => data.marcas[m.clave] != null)
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Lo que dice el atleta</h3>
      <p className="text-xs mt-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>Marcas y cómo fueron las cargas de cada bloque. El siguiente plan parte de esto.</p>

      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Marcas</p>
      {marcas.length === 0 ? (
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

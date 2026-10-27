'use client'
import useSWR from 'swr'
import { Bell } from '@/components/icons/lucide'

interface Cambio { id: string; tipo: string; resumen: string; created_at: string }
const fetchJson = (u: string) => fetch(u).then(r => (r.ok ? r.json() : { cambios: [] }))

/** Cambios que el atleta ha hecho en su plan: el plan nace en el coach, así que se avisa hasta que el coach pulsa «Entendido». */
export default function CambiosDelCliente({ clienteId }: { clienteId: string }) {
  const { data, mutate } = useSWR<{ cambios: Cambio[] }>(`/api/clientes/${clienteId}/cambios`, fetchJson, { revalidateOnFocus: true })
  const cambios = data?.cambios ?? []
  if (cambios.length === 0) return null

  async function entendido() {
    await fetch(`/api/clientes/${clienteId}/cambios`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: cambios.map(c => c.id) }) })
    await mutate({ cambios: [] }, { revalidate: false })
  }

  return (
    <aside className="coach-client-change-log mb-3" aria-label="Cambios recientes del cliente">
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <Bell size={14} className="flex-shrink-0" style={{ color: 'var(--warning)' }} />
        <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: 'var(--text)' }}>
          El cliente ha cambiado {cambios.length === 1 ? 'algo' : `${cambios.length} cosas`} en su plan
        </span>
        <button type="button" onClick={entendido} className="coach-client-change-dismiss text-xs font-medium px-2.5 py-1">Marcar revisado</button>
      </div>
      <ul className="space-y-1 px-3.5 pb-3">
        {cambios.map(c => (
          <li key={c.id} className="text-sm flex justify-between gap-3" style={{ color: 'var(--text-secondary)' }}>
            <span>{c.resumen}</span>
            <span className="text-xs flex-shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

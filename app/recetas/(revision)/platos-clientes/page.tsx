'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'
import RevisionPlato from '@/components/recetas/RevisionPlato'

type Resumen = {
  id: string; cliente_nombre: string; nombre: string; tipo_comida: string; estado: 'pendiente' | 'aprobado' | 'devuelto'
  foto_original_url: string | null; foto_limpia_url: string | null; kcal: number; incompleto: boolean; nota_cliente: string | null; updated_at: string
}
const ESTADOS = [{ k: 'pendiente', t: 'Pendientes' }, { k: 'aprobado', t: 'Aprobados' }, { k: 'devuelto', t: 'Devueltos' }] as const

/** Bandeja del coach: platos que sus clientes han fotografiado y enviado a revisión. */
export default function PlatosClientesPage() {
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]['k']>('pendiente')
  const [platos, setPlatos] = useState<Resumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const r = await fetch(`/api/platos?estado=${estado}`, { cache: 'no-store' })
      setPlatos(r.ok ? (await r.json()).platos ?? [] : [])
    } catch { setPlatos([]) }
    setCargando(false)
  }, [estado])
  useEffect(() => { void cargar() }, [cargar])

  if (abierto) return <div className="mx-auto max-w-4xl px-4 py-6"><RevisionPlato platoId={abierto} onCerrar={() => { setAbierto(null); void cargar() }} /></div>

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Platos del cliente</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Lo que tus clientes comen habitualmente, fotografiado por ellos. Corrige, aprueba y, si encaja, mételo en su dieta.</p>
      </div>
      <div className="flex gap-4" role="tablist" aria-label="Estado">
        {ESTADOS.map(e => (
          <button key={e.k} role="tab" aria-selected={estado === e.k} onClick={() => setEstado(e.k)} className="pb-1 text-sm font-medium"
            style={{ color: estado === e.k ? 'var(--text)' : 'var(--text-muted)', borderBottom: estado === e.k ? '2px solid var(--primary)' : '2px solid transparent' }}>{e.t}</button>
        ))}
      </div>
      {cargando ? <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
        : platos.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: 'var(--text-muted)' }}>No hay platos {ESTADOS.find(e => e.k === estado)?.t.toLowerCase()}.</p>
        : (
          <ul className="flex flex-col" style={{ borderTop: '1px solid var(--border)' }}>
            {platos.map(p => (
              <li key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <button type="button" onClick={() => setAbierto(p.id)} className="w-full flex items-center gap-3 py-3 text-left">
                  <span className="relative w-14 h-14 shrink-0 overflow-hidden" style={{ background: 'var(--surface)' }}>
                    {(p.foto_limpia_url ?? p.foto_original_url) && <Image src={p.foto_limpia_url ?? p.foto_original_url ?? ''} alt="" fill sizes="56px" className="object-cover" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre || 'Plato sin nombre'}</span>
                    <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{p.cliente_nombre} · {p.tipo_comida} · {Math.round(p.kcal)} kcal{p.incompleto ? ' · ingredientes sin enlazar' : ''}</span>
                    {p.nota_cliente && <span className="block text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>«{p.nota_cliente}»</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  )
}

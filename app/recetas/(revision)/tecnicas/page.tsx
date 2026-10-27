'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FAMILIAS_TECNICA } from '@/lib/recetas-constants'
import { resumenParametros, type ParametrosTecnica } from '@/lib/tecnicas'

type Fila = { id: string; nombre: string; familia: string | null; descripcion: string | null; parametros: ParametrosTecnica | null; estado: string }
const mono = { fontFamily: 'var(--font-mono, monospace)' } as const

export default function TecnicasPage() {
  const [q, setQ] = useState('')
  const [familia, setFamilia] = useState<string | null>(null)
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (familia) p.set('familia', familia)
    const espera = setTimeout(() => {
      fetch(`/api/tecnicas?${p}`).then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) setError(d.error ?? 'No se pudieron cargar'); else { setError(null); setFilas(d.tecnicas) }
      }).catch(() => setError('No se pudieron cargar'))
    }, 200)
    return () => clearTimeout(espera)
  }, [q, familia])

  const chip = (activa: boolean) => ({ background: activa ? 'var(--accent-bg)' : 'transparent', borderColor: activa ? 'var(--accent)' : 'var(--border)', color: activa ? 'var(--text)' : 'var(--text-secondary)' })

  return (
    <div className="mx-auto max-w-5xl p-4 pb-24">
      <div className="flex items-center gap-3 mb-3">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar técnica…" className="flex-1 px-3 py-2 text-base outline-none" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <Link href="/recetas/tecnicas/nueva" className="px-3 py-2 text-sm font-medium whitespace-nowrap" style={{ background: 'var(--accent)', color: 'var(--accent-contrast, #000)' }}>Nueva técnica</Link>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: 'none' }}>
        {[null, ...FAMILIAS_TECNICA].map(f => (
          <button key={f ?? 'todas'} onClick={() => setFamilia(f)} className="text-xs whitespace-nowrap px-3 py-1.5 border font-medium" style={chip(familia === f)}>{f ?? 'Todas'}</button>
        ))}
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>}
      {!error && filas === null && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>}
      {filas && filas.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay técnicas{familia || q ? ' con ese filtro' : ''}.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filas?.map(t => {
          const resumen = resumenParametros(t.parametros)
          return (
            <Link key={t.id} href={`/recetas/tecnicas/${t.id}`} className="block p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {t.familia && <p className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ ...mono, color: 'var(--text-muted)' }}>{t.familia}</p>}
              <h3 className="text-lg font-light" style={{ color: 'var(--text)' }}>{t.nombre}</h3>
              {resumen && <p className="text-xs mt-1" style={{ ...mono, color: 'var(--text-secondary)' }}>{resumen}</p>}
              {t.descripcion && <p className="text-sm mt-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{t.descripcion}</p>}
              {t.estado !== 'aprobada' && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>En revisión</p>}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

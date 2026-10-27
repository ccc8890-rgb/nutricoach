'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Tec = { id: string; nombre: string; familia: string | null }
const mono = { fontFamily: 'var(--font-mono, monospace)' } as const

/** Técnicas que usa una receta (capa Estudio, solo coach). Se enlazan y se quitan al momento. */
export default function TecnicasDeReceta({ recetaId }: { recetaId: string }) {
  const [enlazadas, setEnlazadas] = useState<Tec[] | null>(null)
  const [catalogo, setCatalogo] = useState<Tec[]>([])
  const [anadiendo, setAnadiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch(`/api/recetas/${recetaId}/tecnicas`).catch(() => null)
    if (!r?.ok) { setError('No se pudieron cargar las técnicas'); return }
    setEnlazadas((await r.json()).tecnicas ?? [])
  }, [recetaId])
  useEffect(() => { cargar() }, [cargar])

  async function abrirSelector() {
    setAnadiendo(true)
    if (catalogo.length === 0) {
      const r = await fetch('/api/tecnicas').catch(() => null)
      if (r?.ok) setCatalogo((await r.json()).tecnicas ?? [])
    }
  }

  async function guardar(lista: Tec[]) {
    setError(null)
    const r = await fetch(`/api/recetas/${recetaId}/tecnicas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tecnica_ids: lista.map(t => t.id) }) }).catch(() => null)
    if (!r?.ok) { setError((await r?.json().catch(() => null))?.error ?? 'No se pudo guardar'); return }
    setEnlazadas(lista)
  }

  if (enlazadas === null && !error) return null
  const actuales = enlazadas ?? []
  const libres = catalogo.filter(t => !actuales.some(a => a.id === t.id))

  return (
    <div className="coach-recipe-detail__section mb-6 p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[11px] uppercase tracking-[0.14em] mb-2" style={{ ...mono, color: 'var(--text-muted)' }}>Técnicas que usa</p>
      {actuales.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Ninguna enlazada todavía.</p>}
      <ul className="space-y-1">
        {actuales.map(t => (
          <li key={t.id} className="flex items-center justify-between gap-3 text-base">
            <Link href={`/recetas/tecnicas/${t.id}`} className="underline decoration-dotted underline-offset-4" style={{ color: 'var(--text)' }}>{t.nombre}</Link>
            <button onClick={() => guardar(actuales.filter(a => a.id !== t.id))} className="text-xs" style={{ color: 'var(--text-muted)' }} aria-label={`Quitar ${t.nombre}`}>Quitar</button>
          </li>
        ))}
      </ul>
      {anadiendo ? (
        <select className="input mt-3" value="" onChange={e => { const t = libres.find(x => x.id === e.target.value); if (t) { guardar([...actuales, t]); setAnadiendo(false) } }}>
          <option value="">{libres.length ? 'Elegir técnica…' : 'No hay más técnicas'}</option>
          {libres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      ) : (
        <button onClick={abrirSelector} className="mt-3 text-sm underline decoration-dotted underline-offset-4" style={{ color: 'var(--text)' }}>Añadir técnica</button>
      )}
      {error && <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>}
    </div>
  )
}

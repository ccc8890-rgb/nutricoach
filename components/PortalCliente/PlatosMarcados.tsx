'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Item = { id: string; nombre: string; foto: string | null; kcal: number; huecos?: string[] }

/**
 * Platos propios aprobados por el coach, con la marca «Mi plato».
 * `vista="recetario"` (Archivo completo): todos los aprobados. `vista="plan"` (En tu plan): solo los que el coach ha metido en la dieta.
 */
export default function PlatosMarcados({ codigo, vista, onAbrir }: { codigo: string; vista: 'recetario' | 'plan'; onAbrir: (id: string) => void }) {
  const [platos, setPlatos] = useState<Item[]>([])
  useEffect(() => {
    let vivo = true
    fetch(`/api/cliente/${codigo}/platos?vista=${vista}`).then(r => (r.ok ? r.json() : { platos: [] })).then(j => { if (vivo) setPlatos(j.platos ?? []) }).catch(() => {})
    return () => { vivo = false }
  }, [codigo, vista])
  if (platos.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] pb-1" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--editorial-rule)' }}>
        Mis platos · {platos.length}
      </p>
      <ul className="flex flex-col">
        {platos.map(p => (
          <li key={p.id} style={{ borderBottom: '1px solid var(--editorial-rule)' }}>
            <button type="button" onClick={() => onAbrir(p.id)} className="w-full flex items-center gap-3 py-2 text-left">
              <span className="relative w-12 h-12 shrink-0 overflow-hidden" style={{ background: 'var(--surface-elevated)' }}>
                {p.foto && <Image src={p.foto} alt="" fill sizes="48px" className="object-cover" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre}</span>
                <span className="block font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>
                  Mi plato · {Math.round(p.kcal)} kcal{p.huecos?.length ? ` · ${p.huecos.join(', ')}` : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

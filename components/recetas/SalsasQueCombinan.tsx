'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Salsa = { id: string; nombre: string; kcal: number | null }

/** Salsas que combinan con la receta («Va bien con…»): el coach las elige entre las recetas de tipo salsa aprobadas. */
export default function SalsasQueCombinan({ recetaId }: { recetaId: string }) {
  const [vinculadas, setVinculadas] = useState<Salsa[]>([])
  const [disponibles, setDisponibles] = useState<Salsa[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/recetas/${recetaId}/salsas`)
    if (!res.ok) return
    const data = await res.json()
    setVinculadas(data.vinculadas ?? [])
    setDisponibles(data.disponibles ?? [])
  }, [recetaId])
  useEffect(() => { cargar() }, [cargar])

  async function guardar(ids: string[]) {
    setGuardando(true); setError('')
    const res = await fetch(`/api/recetas/${recetaId}/salsas`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ salsa_ids: ids }) })
    if (!res.ok) setError((await res.json().catch(() => null))?.error ?? 'No se pudo guardar')
    await cargar()
    setGuardando(false)
  }

  const libres = disponibles.filter(s => !vinculadas.some(v => v.id === s.id))
  if (disponibles.length === 0 && vinculadas.length === 0) return null

  return (
    <div className="coach-recipe-detail__section p-5 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="coach-recipe-kicker mb-3">Va bien con</p>
      <div className="flex flex-wrap items-center gap-2">
        {vinculadas.map(s => (
          <span key={s.id} className="inline-flex items-center gap-2 px-3 py-1.5 text-sm" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
            <Link href={`/recetas/${s.id}`} className="hover:underline">{s.nombre}</Link>
            <button type="button" disabled={guardando} aria-label={`Quitar ${s.nombre}`} onClick={() => guardar(vinculadas.filter(v => v.id !== s.id).map(v => v.id))} style={{ color: 'var(--text-muted)' }}>×</button>
          </span>
        ))}
        {vinculadas.length < 4 && libres.length > 0 && (
          <select
            value="" disabled={guardando} aria-label="Añadir salsa"
            onChange={e => e.target.value && guardar([...vinculadas.map(v => v.id), e.target.value])}
            className="px-3 py-1.5 text-sm" style={{ background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
            <option value="">+ Añadir salsa</option>
            {libres.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>
      {error && <p className="text-xs mt-2" style={{ color: 'var(--danger, #ef4444)' }}>{error}</p>}
    </div>
  )
}

'use client'

import { use, useEffect, useState } from 'react'
import TecnicaForm from '@/components/recetas/TecnicaForm'
import { formularioDeTecnica, type FormTecnica } from '@/lib/tecnicas'

export default function EditarTecnicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [inicial, setInicial] = useState<FormTecnica | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch(`/api/tecnicas/${id}`).then(async r => {
      const d = await r.json().catch(() => ({}))
      if (!r.ok) setError(d.error ?? 'No se pudo cargar'); else setInicial(formularioDeTecnica(d.tecnica))
    }).catch(() => setError('No se pudo cargar'))
  }, [id])
  if (error) return <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!inicial) return <p className="p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
  return <TecnicaForm id={id} inicial={inicial} />
}

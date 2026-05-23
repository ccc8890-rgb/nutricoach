// components/PortalCliente/MisPlatos.tsx
'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface RecetaPersonalizada {
  id: string
  nombre: string
  imagen_url?: string | null
  url_origen?: string | null
  kcal?: number
  proteinas?: number
  created_at: string
}

interface Props {
  codigo: string
  clienteId: string
}

export default function MisPlatos({ codigo, clienteId }: Props) {
  const [recetas, setRecetas] = useState<RecetaPersonalizada[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch(`/api/cliente/${codigo}/mis-platos?cliente_id=${clienteId}`)
      .then(r => r.json())
      .then(data => setRecetas(data.recetas ?? []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [codigo, clienteId])

  if (cargando) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (recetas.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🍽️</p>
        <p className="text-[var(--text-muted)] text-sm">
          Aquí aparecerán los platos personalizados que tu coach ha creado para ti.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--text)] mb-4">Mis platos</h2>
      <p className="text-sm text-[var(--text-muted)] mb-4">
        Platos creados especialmente para ti basados en tus preferencias.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {recetas.map(r => (
          <div key={r.id} className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
            {r.imagen_url ? (
              <div className="relative w-full h-32">
                <Image
                  src={r.imagen_url}
                  alt={r.nombre}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 300px"
                />
              </div>
            ) : (
              <div className="w-full h-32 bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                <span className="text-3xl">🍽️</span>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-medium text-[var(--text)] line-clamp-2">{r.nombre}</p>
              {r.kcal && r.kcal > 0 && (
                <p className="text-xs text-[var(--text-muted)] mt-1">{r.kcal} kcal · {r.proteinas}g P</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

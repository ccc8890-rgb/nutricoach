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

  if (cargando) return null

  // Antes mostraba un placeholder "aquí aparecerán tus platos" siempre que
  // no hubiera ninguno — con el recetario explorable ya integrado en la
  // pestaña, ese hueco vacío solo confundía (parecía un error, no una
  // función poco usada). Si no hay platos personalizados, esta sección
  // simplemente no ocupa espacio.
  if (recetas.length === 0) return null

  return (
    <section className="recipe-personal-archive">
      <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--text)' }}>Mis platos</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Platos creados especialmente para ti basados en tus preferencias.
      </p>
      <div className="recipe-editorial-list">
        {recetas.map((r, index) => (
          <div key={r.id} className={`recipe-editorial-item ${index === 0 ? 'is-featured' : ''}`}>
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
    </section>
  )
}

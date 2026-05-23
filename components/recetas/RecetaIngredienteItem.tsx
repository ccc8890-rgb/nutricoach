// components/recetas/RecetaIngredienteItem.tsx
'use client'

import Link from 'next/link'
import type { RecetaIngredienteConRol } from '@/types'

interface Props {
  ingrediente: RecetaIngredienteConRol
  mostrarRol?: boolean
}

export default function RecetaIngredienteItem({ ingrediente, mostrarRol = false }: Props) {
  const nombre = ingrediente.alimento?.nombre ?? ingrediente.nombre_libre ?? 'Ingrediente'
  const gramos = ingrediente.cantidad_gramos

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-[var(--text)] truncate">{nombre}</span>
        {ingrediente.es_cantidad_fija && (
          <span className="text-xs text-[var(--text-muted)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            fijo
          </span>
        )}
        {ingrediente.receta_vinculada_id && (
          <Link
            href={`/recetas/${ingrediente.receta_vinculada_id}`}
            className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
            target="_blank"
          >
            Ver receta →
          </Link>
        )}
        {mostrarRol && ingrediente.rol_ingrediente && (
          <span className="text-xs text-[var(--text-muted)] opacity-60">
            {ingrediente.rol_ingrediente.replace('_', ' ')}
          </span>
        )}
      </div>
      <span className="text-sm text-[var(--text-muted)] ml-2 shrink-0">{gramos}g</span>
    </div>
  )
}

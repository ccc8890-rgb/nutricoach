// components/PortalCliente/MealCard.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

const FRANJA_COLORES: Record<string, string> = {
  'Desayuno':     '#F59E0B',
  'Media mañana': '#84CC16',
  'Comida':       '#0D9488',
  'Merienda':     '#F97316',
  'Cena':         '#4F46E5',
  'Snack':        '#84CC16',
}

function detectarGradiente(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes('bowl') || n.includes('batido')) return 'from-emerald-50 to-teal-100'
  if (n.includes('pasta') || n.includes('arroz') || n.includes('quinoa')) return 'from-amber-50 to-orange-100'
  if (n.includes('ensalada') || n.includes('verdura')) return 'from-green-50 to-lime-100'
  if (n.includes('avena') || n.includes('tostada') || n.includes('gofre')) return 'from-yellow-50 to-amber-100'
  if (n.includes('snack') || n.includes('barrita') || n.includes('fruta')) return 'from-purple-50 to-violet-100'
  if (n.includes('pollo') || n.includes('ternera') || n.includes('carne') || n.includes('salmón')) return 'from-red-50 to-rose-100'
  return 'from-slate-50 to-gray-100'
}

export interface AlimentoMealCard {
  id: string
  alimento_id?: string
  nombre_libre?: string
  cantidad_gramos: number
  es_cantidad_fija?: boolean
  receta_vinculada_id?: string | null
  alimento?: {
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
  }
}

interface Props {
  nombreSlot: string
  horaSlot?: string
  recetaNombre: string
  imagenUrl?: string | null
  tieneImagenReal?: boolean
  kcal?: number
  proteinas?: number
  carbohidratos?: number
  grasas?: number
  alimentos?: AlimentoMealCard[]
  notas_peri_entreno?: string | null
  onCambiarPlato?: () => void
}

export default function MealCard({
  nombreSlot, horaSlot, recetaNombre, imagenUrl, tieneImagenReal,
  kcal, proteinas, carbohidratos, grasas, alimentos, notas_peri_entreno,
  onCambiarPlato,
}: Props) {
  const [expandido, setExpandido] = useState(false)
  const color = FRANJA_COLORES[nombreSlot] ?? FRANJA_COLORES['Comida']

  const tieneFotoReal = tieneImagenReal && imagenUrl
  const tieneImagenIA = !tieneImagenReal && imagenUrl
  const alturaTier = tieneFotoReal ? 200 : tieneImagenIA ? 160 : 120

  return (
    <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] mb-4">
      {imagenUrl ? (
        <div className="relative w-full" style={{ height: alturaTier }}>
          <Image
            src={imagenUrl}
            alt={recetaNombre}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
          />
        </div>
      ) : (
        <div
          className={`w-full flex items-center justify-center bg-gradient-to-br ${detectarGradiente(recetaNombre)}`}
          style={{ height: alturaTier }}
        >
          <div className="text-center px-4">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-sm font-medium text-gray-500 line-clamp-2">{recetaNombre}</p>
          </div>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-1">
          {horaSlot && (
            <span className="text-xs text-[var(--text-muted)]">🕐 {horaSlot}</span>
          )}
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ color, backgroundColor: color + '20' }}
          >
            {nombreSlot}
          </span>
        </div>

        <h3 className="text-base font-semibold text-[var(--text)] mb-2">{recetaNombre}</h3>

        {kcal && kcal > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-muted)] font-medium">
              {kcal} kcal
            </span>
            {proteinas && proteinas > 0 && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#0D948820', color: '#0D9488' }}>
                {proteinas}g P
              </span>
            )}
            {carbohidratos && carbohidratos > 0 && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#F59E0B20', color: '#D97706' }}>
                {carbohidratos}g C
              </span>
            )}
            {grasas && grasas > 0 && (
              <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: '#4F46E520', color: '#4F46E5' }}>
                {grasas}g G
              </span>
            )}
          </div>
        )}

        {notas_peri_entreno && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            ⚡ {notas_peri_entreno}
          </p>
        )}

        <div className="flex gap-2">
          {alimentos && alimentos.length > 0 && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expandido ? 'Ocultar' : 'Ver ingredientes'}
            </button>
          )}
          {onCambiarPlato && (
            <button
              onClick={onCambiarPlato}
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline ml-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Cambiar plato
            </button>
          )}
        </div>

        {expandido && alimentos && alimentos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            {alimentos.map((al, i) => {
              const nombre = al.alimento?.nombre ?? al.nombre_libre ?? 'Ingrediente'
              return (
                <div key={al.id ?? i} className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm text-[var(--text)] truncate">{nombre}</span>
                    {al.es_cantidad_fija && (
                      <span className="text-xs text-[var(--text-muted)] opacity-60">(fijo)</span>
                    )}
                    {al.receta_vinculada_id && (
                      <a
                        href={`/recetas/${al.receta_vinculada_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[var(--primary)] hover:underline whitespace-nowrap"
                      >
                        Ver receta →
                      </a>
                    )}
                  </div>
                  <span className="text-sm text-[var(--text-muted)] ml-2 shrink-0">{al.cantidad_gramos}g</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

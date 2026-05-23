// components/PortalCliente/MealCard.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff } from 'lucide-react'

const FRANJA_COLORES: Record<string, string> = {
  'Desayuno': '#F59E0B',
  'Media mañana': '#84CC16',
  'Comida': '#0D9488',
  'Merienda': '#F97316',
  'Cena': '#4F46E5',
  'Snack': '#84CC16',
}

const FRANJA_EMOJIS: Record<string, string> = {
  'Desayuno': '🌅',
  'Media mañana': '🍎',
  'Comida': '🍽️',
  'Merienda': '🍪',
  'Cena': '🌙',
  'Snack': '🥜',
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
  const emoji = FRANJA_EMOJIS[nombreSlot] ?? '🍽️'

  const tieneFotoReal = tieneImagenReal && imagenUrl
  const tieneImagenIA = !tieneImagenReal && imagenUrl
  const alturaTier = tieneFotoReal ? 220 : tieneImagenIA ? 180 : 140

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {/* Foto con overlay de macros */}
      {imagenUrl ? (
        <div className="relative w-full" style={{ height: alturaTier }}>
          <Image
            src={imagenUrl}
            alt={recetaNombre}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 600px"
          />
          {/* Overlay inferior con macros */}
          {kcal && kcal > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-3"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))' }}>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.9)', color: '#1E293B' }}>
                  {kcal} kcal
                </span>
                {proteinas && proteinas > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(13,148,136,0.85)', color: 'white' }}>
                    P {proteinas}g
                  </span>
                )}
                {carbohidratos && carbohidratos > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.85)', color: 'white' }}>
                    C {carbohidratos}g
                  </span>
                )}
                {grasas && grasas > 0 && (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'rgba(79,70,229,0.85)', color: 'white' }}>
                    G {grasas}g
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Badge de autenticidad */}
          {tieneFotoReal && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium"
              style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.8)' }}>
              <Eye size={9} /> Real
            </div>
          )}
        </div>
      ) : (
        <div
          className={`w-full flex items-center justify-center bg-gradient-to-br ${detectarGradiente(recetaNombre)}`}
          style={{ height: alturaTier }}
        >
          <div className="text-center px-4">
            <div className="text-4xl mb-2">🍽️</div>
            <p className="text-sm font-medium line-clamp-2" style={{ color: 'var(--text-muted)' }}>{recetaNombre}</p>
          </div>
        </div>
      )}

      <div className="p-4">
        {/* Badge de franja horaria más visible */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg"
            style={{ color: 'white', backgroundColor: color }}
          >
            {emoji} {nombreSlot}
          </span>
          {horaSlot && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              🕐 {horaSlot}
            </span>
          )}
        </div>

        {/* Título más grande y prominente */}
        <h3 className="text-lg font-bold leading-tight mb-2" style={{ color: 'var(--text)' }}>
          {recetaNombre}
        </h3>

        {/* Macros inline (solo si NO hay foto — si hay foto, ya están en overlay) */}
        {!imagenUrl && kcal && kcal > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
              {kcal} kcal
            </span>
            {proteinas && proteinas > 0 && (
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#0D948820', color: '#0D9488' }}>
                {proteinas}g P
              </span>
            )}
            {carbohidratos && carbohidratos > 0 && (
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#F59E0B20', color: '#D97706' }}>
                {carbohidratos}g C
              </span>
            )}
            {grasas && grasas > 0 && (
              <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ backgroundColor: '#4F46E520', color: '#4F46E5' }}>
                {grasas}g G
              </span>
            )}
          </div>
        )}

        {/* Notas peri-entreno */}
        {notas_peri_entreno && (
          <p className="text-xs font-medium rounded-lg px-3 py-2 mb-3"
            style={{ background: '#FEF3C7', color: '#92400E' }}>
            ⚡ {notas_peri_entreno}
          </p>
        )}

        {/* Botones de acción más claros */}
        <div className="flex gap-2">
          {alimentos && alimentos.length > 0 && (
            <button
              onClick={() => setExpandido(!expandido)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'var(--bg)', color: 'var(--text-secondary)' }}
            >
              {expandido ? <EyeOff size={13} /> : <Eye size={13} />}
              {expandido ? 'Ocultar ingredientes' : `${alimentos.length} ingredientes`}
            </button>
          )}
          {onCambiarPlato && (
            <button
              onClick={onCambiarPlato}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ml-auto"
              style={{ background: 'var(--primary)', color: 'white' }}
            >
              <RefreshCw size={13} />
              Cambiar
            </button>
          )}
        </div>

        {/* Ingredientes expandibles */}
        {expandido && alimentos && alimentos.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            {alimentos.map((al, i) => {
              const nombre = al.alimento?.nombre ?? al.nombre_libre ?? 'Ingrediente'
              return (
                <div key={al.id ?? i} className="flex items-center justify-between py-1.5 border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>{nombre}</span>
                    {al.es_cantidad_fija && (
                      <span className="text-xs opacity-60" style={{ color: 'var(--text-muted)' }}>(fijo)</span>
                    )}
                    {al.receta_vinculada_id && (
                      <a
                        href={`/recetas/${al.receta_vinculada_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs whitespace-nowrap"
                        style={{ color: 'var(--primary)' }}
                      >
                        Ver receta →
                      </a>
                    )}
                  </div>
                  <span className="text-sm shrink-0 ml-2" style={{ color: 'var(--text-muted)' }}>{al.cantidad_gramos}g</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

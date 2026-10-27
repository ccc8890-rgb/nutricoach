'use client'

import useSWR, { useSWRConfig } from 'swr'
import { Heart } from '@/components/icons/portal-phosphor'
import { fetchJson } from '@/lib/cliente/cache-swr'

export interface RecetaFavorita {
  id: string
  nombre: string
  imagen_url: string | null
  kcal: number | null
  proteinas: number | null
  categoria: string | null
}
interface Datos { ids: string[]; recetas: RecetaFavorita[] }

export const claveFavoritas = (codigo: string) => `/api/cliente/${codigo}/favoritas`

/** Favoritas del cliente (caché compartida): la lista, el corazón de cada tarjeta y la ficha leen lo mismo. */
export function useFavoritas(codigo: string | null) {
  const { data, isLoading } = useSWR<Datos>(codigo ? claveFavoritas(codigo) : null, fetchJson)
  const { mutate } = useSWRConfig()

  async function alternar(receta: RecetaFavorita) {
    if (!codigo) return
    const clave = claveFavoritas(codigo)
    const actual: Datos = data ?? { ids: [], recetas: [] }
    const esFav = actual.ids.includes(receta.id)
    // Cambio al instante; si el servidor falla se vuelve a lo que había
    const optimista: Datos = esFav
      ? { ids: actual.ids.filter(i => i !== receta.id), recetas: actual.recetas.filter(r => r.id !== receta.id) }
      : { ids: [receta.id, ...actual.ids], recetas: [receta, ...actual.recetas] }
    await mutate(clave, async () => {
      const res = await fetch(clave, {
        method: esFav ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receta_id: receta.id }),
      })
      if (!res.ok) throw new Error(String(res.status))
      return optimista
    }, { optimisticData: optimista, rollbackOnError: true, revalidate: false }).catch(() => {})
  }

  return { ids: data?.ids ?? [], recetas: data?.recetas ?? [], cargando: isLoading && !data, esFavorita: (id: string) => (data?.ids ?? []).includes(id), alternar }
}

/** Corazón sobre la foto de una tarjeta (no abre la receta). */
export function BotonFavorita({ receta, codigo, className = '' }: { receta: RecetaFavorita; codigo: string; className?: string }) {
  const { esFavorita, alternar } = useFavoritas(codigo)
  const fav = esFavorita(receta.id)
  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); void alternar(receta) }}
      aria-label={fav ? 'Quitar de favoritas' : 'Añadir a favoritas'}
      aria-pressed={fav}
      className={`flex h-8 w-8 items-center justify-center ${className}`}
      style={{ borderRadius: 'var(--editorial-radius-sm, 3px)', background: 'var(--glass-bg)', border: '1px solid var(--border)', color: fav ? 'var(--semantic-alert)' : 'var(--text-muted)', backdropFilter: 'blur(8px)' }}
    >
      <Heart size={16} weight={fav ? 'fill' : 'regular'} />
    </button>
  )
}

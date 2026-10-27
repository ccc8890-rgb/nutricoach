'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, ForkKnife } from '@/components/icons/phosphor'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { useFavoritas, BotonFavorita } from './BotonFavorita'

const ORDEN = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']

/** Favoritas del cliente, con selector por tipo de comida (solo los tipos que tienen alguna). */
export default function RecetasFavoritas({ codigo, recetaHref }: { codigo: string; recetaHref: (id: string) => string }) {
  const { recetas, cargando } = useFavoritas(codigo)
  const [categoria, setCategoria] = useEstadoUrl<string>('fcat', 'Todos')

  if (cargando) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
  }
  if (recetas.length === 0) {
    return (
      <div className="text-center py-10">
        <Heart size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Aún no tienes favoritas. Toca el corazón de una receta para guardarla aquí.</p>
      </div>
    )
  }

  const cuenta = (c: string) => recetas.filter(r => r.categoria === c).length
  const tipos = ['Todos', ...ORDEN.filter(c => cuenta(c) > 0)]
  const activa = tipos.includes(categoria) ? categoria : 'Todos'
  const visibles = activa === 'Todos' ? recetas : recetas.filter(r => r.categoria === activa)

  return (
    <div className="flex flex-col gap-3">
      <div className="rc-cats">
        {tipos.map(c => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`rc-cat${activa === c ? ' is-active' : ''}`}
          >
            {c} · {c === 'Todos' ? recetas.length : cuenta(c)}
          </button>
        ))}
      </div>

      <div className="recipe-grid-compact">
        {visibles.map(r => (
          <Link key={r.id} href={recetaHref(r.id)} prefetch={false} className="recipe-grid-compact__item">
            <div className="recipe-grid-compact__img relative">
              {r.imagen_url ? (
                <Image src={r.imagen_url} alt={r.nombre} fill className="object-cover" sizes="33vw" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ForkKnife size={20} style={{ color: 'var(--text-muted)' }} /></div>
              )}
              <BotonFavorita receta={r} codigo={codigo} className="absolute right-1 top-1" />
            </div>
            <p className="text-[11px] font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
            {r.kcal ? <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.kcal} kcal</p> : null}
          </Link>
        ))}
      </div>
    </div>
  )
}

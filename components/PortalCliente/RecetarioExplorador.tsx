'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { MagnifyingGlass, ForkKnife } from '@phosphor-icons/react'

const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre'] as const

interface RecetaCatalogo {
  id: string
  nombre: string
  imagen_url: string | null
  kcal: number | null
  proteinas: number | null
  categoria: string | null
}

export default function RecetarioExplorador({
  codigo,
  recetaHref,
}: {
  codigo: string
  recetaHref: (recetaId: string) => string
}) {
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState<string>('Todos')
  const [recetas, setRecetas] = useState<RecetaCatalogo[]>([])
  const [page, setPage] = useState(0)
  const [hayMas, setHayMas] = useState(false)
  const [cargando, setCargando] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      cargar(0, true)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoria])

  async function cargar(paginaSolicitada: number, reemplazar: boolean) {
    setCargando(true)
    try {
      const params = new URLSearchParams({ page: String(paginaSolicitada) })
      if (q.trim()) params.set('q', q.trim())
      if (categoria !== 'Todos') params.set('categoria', categoria)
      const res = await fetch(`/api/cliente/${codigo}/recetario?${params.toString()}`)
      const data = await res.json()
      setRecetas(prev => reemplazar ? (data.recetas ?? []) : [...prev, ...(data.recetas ?? [])])
      setHayMas(Boolean(data.hayMas))
    } catch {
      if (reemplazar) setRecetas([])
    } finally {
      setCargando(false)
    }
  }

  function verMas() {
    const siguiente = page + 1
    setPage(siguiente)
    cargar(siguiente, false)
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-bold" style={{ color: 'var(--text)' }}>Explorar recetario</h2>

      <div className="relative">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar receta…"
          autoComplete="off"
          className="w-full rounded-2xl pl-9 pr-3 py-2.5 text-sm"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIAS.map(c => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
            style={{
              background: categoria === c ? 'var(--primary)' : 'var(--surface)',
              color: categoria === c ? 'var(--bg)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {cargando && recetas.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : recetas.length === 0 ? (
        <div className="text-center py-10">
          <ForkKnife size={28} style={{ color: 'var(--text-muted)', margin: '0 auto 8px' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay recetas que coincidan con la búsqueda.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {recetas.map(r => (
              <a
                key={r.id}
                href={recetaHref(r.id)}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="relative w-full h-28" style={{ background: 'var(--surface-elevated)' }}>
                  {r.imagen_url ? (
                    <Image src={r.imagen_url} alt={r.nombre} fill className="object-cover" sizes="(max-width: 768px) 50vw, 300px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ForkKnife size={24} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                  {r.kcal ? (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{r.kcal} kcal · {r.proteinas}g P</p>
                  ) : null}
                </div>
              </a>
            ))}
          </div>

          {hayMas && (
            <button
              onClick={verMas}
              disabled={cargando}
              className="mx-auto rounded-full px-4 py-2 text-xs font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {cargando ? 'Cargando…' : 'Ver más'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

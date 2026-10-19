'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { fetchJson } from '@/lib/cliente/cache-swr'
import Image from 'next/image'
import Link from 'next/link'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { BotonFavorita } from './BotonFavorita'
import { MagnifyingGlass, ForkKnife, SlidersHorizontal, X, Rows, SquaresFour } from '@phosphor-icons/react'

const CATEGORIAS = ['Todos', 'Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre'] as const

// Filtro por ingrediente principal, aparte del tipo de comida. Usa el mismo
// vocabulario que ya genera lib/auto-tag.ts y guarda en recetas.tags — no
// es un sistema nuevo, solo se expone aquí como chips. Curado a los
// ingredientes con cobertura real en el recetario (ver auditoría 28-09).
const TAGS_INGREDIENTE = ['Pollo', 'Carne', 'Pescado', 'Pasta', 'Arroz', 'Legumbre', 'Patata', 'Yogur'] as const

const CLAVE_SNAPSHOT = 'nc:recetario:snapshot'

function leerSnapshot(): { recetas: RecetaCatalogo[]; page: number; hayMas: boolean; scroll: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CLAVE_SNAPSHOT)
    if (!raw) return null
    const d = JSON.parse(raw)
    // Solo vale para la misma URL (filtros) y reciente
    if (d.url !== window.location.search || Date.now() - d.t > 30 * 60_000) return null
    return d
  } catch { return null }
}

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
  // Filtros en la URL: al abrir una receta y volver, la búsqueda sigue igual
  const [q, setQ] = useEstadoUrl<string>('q', '')
  const [categoria, setCategoria] = useEstadoUrl<string>('cat', 'Todos')
  const [tag, setTag] = useEstadoUrl<string | null>('tag', null)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [vista, setVista] = useState<'lista' | 'cuadricula'>('lista')
  useEffect(() => {
    try {
      const guardada = localStorage.getItem('recetario-vista')
      if (guardada === 'lista' || guardada === 'cuadricula') setVista(guardada)
    } catch {}
  }, [])
  function cambiarVista(v: 'lista' | 'cuadricula') {
    setVista(v)
    try { localStorage.setItem('recetario-vista', v) } catch {}
  }
  // Primera página sin filtros: viene de la caché compartida (precargada por el portal).
  const sinFiltros = !q.trim() && categoria === 'Todos' && !tag
  const { data: inicial, error: errorInicial } = useSWR<{ recetas?: RecetaCatalogo[]; hayMas?: boolean }>(
    `/api/cliente/${codigo}/recetario?page=0`, fetchJson,
  )
  // Foto de la lista (recetas cargadas, páginas, scroll) al abrir una receta: «atrás» vuelve a la misma línea
  const [snapshot] = useState(leerSnapshot)
  const restaurado = useRef(Boolean(snapshot))
  const [recetas, setRecetas] = useState<RecetaCatalogo[]>(snapshot?.recetas ?? inicial?.recetas ?? [])
  const [page, setPage] = useState(snapshot?.page ?? 0)
  const [hayMas, setHayMas] = useState(snapshot ? snapshot.hayMas : Boolean(inicial?.hayMas))
  const [cargando, setCargando] = useState(!snapshot && !inicial)

  useEffect(() => {
    if (!snapshot) return
    let intentos = 0
    const aplicar = () => {
      window.scrollTo({ top: snapshot.scroll, behavior: 'instant' })
      if (Math.abs(window.scrollY - snapshot.scroll) > 2 && ++intentos < 60) requestAnimationFrame(aplicar)
    }
    requestAnimationFrame(aplicar)
  }, [snapshot])

  function guardarSnapshot() {
    try {
      sessionStorage.setItem(CLAVE_SNAPSHOT, JSON.stringify({
        url: window.location.search, t: Date.now(), recetas, page, hayMas, scroll: window.scrollY,
      }))
    } catch { /* sin almacenamiento */ }
  }
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sinFiltros) return
    if (restaurado.current) { restaurado.current = false; return }
    if (!inicial) { if (errorInicial) setCargando(false); return }
    setRecetas(inicial.recetas ?? [])
    setHayMas(Boolean(inicial.hayMas))
    setPage(0)
    setCargando(false)
  }, [sinFiltros, inicial, errorInicial])

  useEffect(() => {
    if (sinFiltros) return
    if (restaurado.current) { restaurado.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      cargar(0, true)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, categoria, tag, sinFiltros])

  async function cargar(paginaSolicitada: number, reemplazar: boolean) {
    setCargando(true)
    try {
      const params = new URLSearchParams({ page: String(paginaSolicitada) })
      if (q.trim()) params.set('q', q.trim())
      if (categoria !== 'Todos') params.set('categoria', categoria)
      if (tag) params.set('tag', tag)
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
    <div className="recipe-archive flex flex-col gap-3">
      <div className="recipe-archive__heading"><span>03 / ARCHIVE</span><h2>Recetario</h2><samp>{recetas.length} ITEMS</samp></div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar receta…"
            autoComplete="off"
            className="editorial-field w-full pl-9 pr-3 py-2.5 text-sm"
          />
        </div>
        <button
          onClick={() => cambiarVista(vista === 'lista' ? 'cuadricula' : 'lista')}
          className="recipe-filter-toggle shrink-0 px-3 flex items-center justify-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          aria-label={vista === 'lista' ? 'Ver en cuadrícula' : 'Ver en lista'}
        >
          {vista === 'lista' ? <SquaresFour size={16} /> : <Rows size={16} />}
        </button>
        <button
          onClick={() => setMostrarFiltros(v => !v)}
          className="recipe-filter-toggle shrink-0 px-3 flex items-center justify-center"
          style={{
            background: mostrarFiltros || tag ? 'var(--primary)' : 'var(--surface)',
            border: '1px solid var(--border)',
            color: mostrarFiltros || tag ? 'var(--bg)' : 'var(--text-muted)',
          }}
          aria-label="Más filtros"
        >
          <SlidersHorizontal size={16} />
        </button>
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

      {mostrarFiltros && (
        <div className="flex flex-wrap items-center gap-2">
          {TAGS_INGREDIENTE.map(t => (
            <button
              key={t}
              onClick={() => setTag(tag === t ? null : t)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{
                background: tag === t ? 'var(--accent)' : 'var(--surface)',
                color: tag === t ? 'var(--bg)' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {t}
            </button>
          ))}
          {tag && (
            <button
              onClick={() => setTag(null)}
              className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={12} /> Quitar
            </button>
          )}
        </div>
      )}

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
          {vista === 'cuadricula' ? (
            <div className="recipe-grid-compact">
              {recetas.map(r => (
                <Link key={r.id} href={recetaHref(r.id)} prefetch={false} onClick={guardarSnapshot} className="recipe-grid-compact__item">
                  <div className="recipe-grid-compact__img">
                    {r.imagen_url ? (
                      <Image src={r.imagen_url} alt={r.nombre} fill className="object-cover" sizes="33vw" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ForkKnife size={20} style={{ color: 'var(--text-muted)' }} />
                      </div>
                    )}
                    <BotonFavorita receta={r} codigo={codigo} className="absolute right-1 top-1" />
                  </div>
                  <p className="text-[11px] font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                  {r.kcal ? (
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{r.kcal} kcal</p>
                  ) : null}
                </Link>
              ))}
            </div>
          ) : (
          <div className="recipe-editorial-list">
            {recetas.map((r, index) => (
              <Link
                key={r.id}
                href={recetaHref(r.id)}
                prefetch={false}
                onClick={guardarSnapshot}
                className={`recipe-editorial-item ${index % 5 === 0 ? 'is-featured' : ''}`}
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
                  <BotonFavorita receta={r} codigo={codigo} className="absolute right-2 top-2" />
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold line-clamp-2" style={{ color: 'var(--text)' }}>{r.nombre}</p>
                  {r.kcal ? (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{r.kcal} kcal · {r.proteinas}g P</p>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
          )}

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

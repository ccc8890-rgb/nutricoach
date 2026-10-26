'use client'

import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { fetchJson } from '@/lib/cliente/cache-swr'
import Image from 'next/image'
import Link from 'next/link'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { BotonFavorita } from './BotonFavorita'
import { MagnifyingGlass, ForkKnife, X, Rows, SquaresFour, CaretDown, Check } from '@phosphor-icons/react'
import { CATEGORIAS_PLATO, FAMILIAS_ELABORACION, FAMILIAS_PLATO, TIPOS_COCCION, APTA_PARA, ALERGENOS_NEGATIVOS, nombreSin } from '@/lib/recetas-constants'
import { filtrosRecetarioDeUrl, migrarCategoriaAntigua, type TipoVista } from '@/lib/recetas/clasificacion'

// Mismos filtros y nombres que la Biblioteca del coach
const TIPOS: { id: TipoVista; etiqueta: string }[] = [{ id: 'platos', etiqueta: 'Platos' }, { id: 'elaboraciones', etiqueta: 'Elaboraciones' }, { id: 'todo', etiqueta: 'Todo' }]
const OPCIONES_APTA = [...APTA_PARA, { valor: 'Halal', etiqueta: 'Halal' }]
const OPCIONES_SIN = [...ALERGENOS_NEGATIVOS, 'Sin Cacahuetes'] as const
const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const USOS = [
  { id: 'batch', grupo: 'En la cocina', label: 'Para la semana (batch / tupper)' },
  { id: 'prepost', grupo: 'Para entrenar', label: 'Antes y después de entrenar' },
  { id: 'endurance', grupo: 'Para entrenar', label: 'Resistencia (running, Hyrox, ciclismo)' },
  { id: 'chef', grupo: 'Calidad', label: 'Más elaboradas (chef healthy)' },
  { id: 'adherencia', grupo: 'Calidad', label: 'Fáciles de seguir (score 80+)' },
]

function Filtro({ etiqueta, valor, onLimpiar, children }: {
  etiqueta: string; valor: string | null; onLimpiar: () => void; children: React.ReactNode
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false) }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])
  const activo = valor !== null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className={`rc-filtro flex items-center gap-1.5${activo ? ' is-active' : ''}`}
      >
        {etiqueta}{activo && <span className="max-w-[9rem] truncate">· {valor}</span>}
        {activo
          ? <span role="button" aria-label={`Quitar ${etiqueta}`} onClick={e => { e.stopPropagation(); onLimpiar(); setAbierto(false) }}><X size={11} weight="bold" /></span>
          : <CaretDown size={10} />}
      </button>
      {abierto && (
        <div className="absolute left-0 top-full z-40 mt-1.5 min-w-[13rem] max-h-72 overflow-y-auto rounded-lg p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.35)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-left text-xs"
      style={{ color: activa ? 'var(--text)' : 'var(--text-muted)', fontWeight: activa ? 700 : 400 }}>
      <span>{children}</span>{activa && <Check size={12} weight="bold" />}
    </button>
  )
}

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
  const [tipoUrl, setTipoUrl] = useEstadoUrl<string | null>('tipo', null)
  const [catUrl, setCatUrl] = useEstadoUrl<string>('cat', 'Todos')
  const [famUrl, setFamUrl] = useEstadoUrl<string | null>('fam', null)
  // Tipo de ficha (platos / elaboraciones / todo), «cuándo se come» (solo platos) y familia de cocinero
  const { tipo, categoria, familia } = filtrosRecetarioDeUrl({ tipo: tipoUrl, cat: catUrl, fam: famUrl, buscando: q.trim().length > 0 })
  function cambiarTipo(t: TipoVista) { setTipoUrl(t); setCatUrl('Todos'); setFamUrl(null) }
  // Enlaces antiguos (?cat=Salsa…): se reescriben al formato nuevo para que los chips funcionen con normalidad
  useEffect(() => {
    const antigua = !tipoUrl ? migrarCategoriaAntigua(catUrl) : null
    if (antigua) { setTipoUrl(antigua.tipo); setFamUrl(famUrl || antigua.familia); setCatUrl('Todos') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [usoF, setUsoF] = useEstadoUrl<string | null>('uso', null)
  const [aptaP, setAptaP] = useEstadoUrl<string | null>('apta', null)
  const [sinP, setSinP] = useEstadoUrl<string | null>('sin', null)
  const [metodo, setMetodo] = useEstadoUrl<string | null>('metodo', null)
  const aptaL = aptaP ? aptaP.split(',').filter(Boolean) : []
  const sinL = sinP ? sinP.split(',').filter(Boolean) : []
  const alternar = (lista: string[], v: string, set: (x: string | null) => void) => {
    const n = lista.includes(v) ? lista.filter(x => x !== v) : [...lista, v]
    set(n.length ? n.join(',') : null)
  }
  const hayFiltros = Boolean(usoF || aptaP || sinP || metodo)
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
  const sinFiltros = !q.trim() && tipo === 'platos' && categoria === 'Todos' && !familia && !hayFiltros
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
  }, [q, tipo, categoria, familia, usoF, aptaP, sinP, metodo, sinFiltros])

  async function cargar(paginaSolicitada: number, reemplazar: boolean) {
    setCargando(true)
    try {
      const params = new URLSearchParams({ page: String(paginaSolicitada) })
      if (q.trim()) params.set('q', q.trim())
      params.set('tipo', tipo)
      if (categoria !== 'Todos') params.set('categoria', categoria)
      if (familia) params.set('familia', familia)
      const extra: Record<string, string | null> = { uso: usoF, apta: aptaP, sin: sinP, metodo }
      for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v)
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
      </div>

      <div className="rc-cats">
        {TIPOS.map(t => (
          <button key={t.id} onClick={() => cambiarTipo(t.id)} className={`rc-cat${tipo === t.id ? ' is-active' : ''}`}>{t.etiqueta}</button>
        ))}
      </div>

      {tipo !== 'todo' && (
        <div className="rc-cats">
          {tipo === 'platos'
            ? CATEGORIAS_PLATO.map(c => (
              <button key={c} onClick={() => setCatUrl(c)} className={`rc-cat${categoria === c ? ' is-active' : ''}`}>{c}</button>
            ))
            : ['Todas', ...FAMILIAS_ELABORACION].map(f => (
              <button key={f} onClick={() => setFamUrl(f === 'Todas' ? null : f)} className={`rc-cat${(familia ?? 'Todas') === f ? ' is-active' : ''}`}>{f}</button>
            ))}
        </div>
      )}

      <div className="rc-filtros">
        <Filtro etiqueta="Uso" valor={USOS.find(u => u.id === usoF)?.label ?? null} onLimpiar={() => setUsoF(null)}>
          {USOS.map((u, i) => (
            <div key={u.id}>
              {USOS[i - 1]?.grupo !== u.grupo && <p className="px-2.5 pt-2 pb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{u.grupo}</p>}
              <Opcion activa={usoF === u.id} onClick={() => setUsoF(usoF === u.id ? null : u.id)}>{u.label}</Opcion>
            </div>
          ))}
        </Filtro>
        <Filtro etiqueta="Apta para" valor={aptaL.length ? aptaL.map(v => OPCIONES_APTA.find(a => a.valor === v)?.etiqueta ?? v).join(', ') : null} onLimpiar={() => setAptaP(null)}>
          {OPCIONES_APTA.map(({ valor, etiqueta }) => (
            <Opcion key={valor} activa={aptaL.includes(valor)} onClick={() => alternar(aptaL, valor, setAptaP)}>{etiqueta}</Opcion>
          ))}
        </Filtro>
        <Filtro etiqueta="Sin" valor={sinL.length ? sinL.map(v => mayuscula(nombreSin(v))).join(', ') : null} onLimpiar={() => setSinP(null)}>
          {OPCIONES_SIN.map(v => (
            <Opcion key={v} activa={sinL.includes(v)} onClick={() => alternar(sinL, v, setSinP)}>{mayuscula(nombreSin(v))}</Opcion>
          ))}
        </Filtro>
        {tipo === 'platos' && (
          <Filtro etiqueta="Familia" valor={familia} onLimpiar={() => setFamUrl(null)}>
            {FAMILIAS_PLATO.map(f => (
              <Opcion key={f} activa={familia === f} onClick={() => setFamUrl(familia === f ? null : f)}>{f}</Opcion>
            ))}
          </Filtro>
        )}
        <Filtro etiqueta="Cocción" valor={metodo} onLimpiar={() => setMetodo(null)}>
          {TIPOS_COCCION.map(m => (
            <Opcion key={m} activa={metodo === m} onClick={() => setMetodo(metodo === m ? null : m)}>{m}</Opcion>
          ))}
        </Filtro>
        {hayFiltros && (
          <button type="button" className="shrink-0 px-2 text-xs underline" style={{ color: 'var(--text-muted)' }}
            onClick={() => { setUsoF(null); setAptaP(null); setSinP(null); setMetodo(null) }}>
            Limpiar todo
          </button>
        )}
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

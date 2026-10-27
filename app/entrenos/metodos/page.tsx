'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useEstadoUrl, useRecordarLista } from '@/lib/useEstadoUrl'
import { useDebounce } from '@/lib/useDebounce'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CONFIANZAS, ETIQUETA, MODALIDADES, NIVELES, TIPOS_METODO, type EstadoMetodo, type Metodo } from '@/lib/metodos/constantes'

type FichaLista = Omit<Metodo, 'estructura' | 'huella' | 'coach_id'>
type Conteos = Record<EstadoMetodo, number>

const PESTAÑAS: EstadoMetodo[] = ['en_revision', 'aprobada', 'descartada']
const FILTROS = [
  { clave: 'tipo', etiqueta: 'Tipo', valores: TIPOS_METODO },
  { clave: 'modalidad', etiqueta: 'Modalidad', valores: MODALIDADES },
  { clave: 'nivel', etiqueta: 'Nivel', valores: NIVELES },
  { clave: 'confianza', etiqueta: 'Confianza', valores: CONFIANZAS },
] as const

export default function BibliotecaMetodosPage() {
  useRecordarLista('metodos')
  const [estado, setEstado] = useEstadoUrl<string>('estado', 'en_revision', PESTAÑAS)
  const [q, setQ] = useEstadoUrl<string>('q', '')
  const [tipo, setTipo] = useEstadoUrl<string>('tipo', '')
  const [modalidad, setModalidad] = useEstadoUrl<string>('modalidad', '')
  const [nivel, setNivel] = useEstadoUrl<string>('nivel', '')
  const [confianza, setConfianza] = useEstadoUrl<string>('confianza', '')
  const [ia, setIa] = useEstadoUrl<string>('ia', '')
  const valor: Record<string, string> = { tipo, modalidad, nivel, confianza }
  const poner: Record<string, (v: string) => void> = { tipo: setTipo, modalidad: setModalidad, nivel: setNivel, confianza: setConfianza }

  const [texto, setTexto] = useState(q)
  const textoDiferido = useDebounce(texto, 300)
  useEffect(() => { if (textoDiferido !== q) setQ(textoDiferido) }, [textoDiferido]) // eslint-disable-line react-hooks/exhaustive-deps

  const [fichas, setFichas] = useState<FichaLista[]>([])
  const [conteos, setConteos] = useState<Conteos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ estado })
    for (const [k, v] of Object.entries({ q, tipo, modalidad, nivel, confianza })) if (v) params.set(k, v)
    if (ia) params.set('ia', '1')
    let vigente = true
    setCargando(true)
    fetch(`/api/metodos?${params}`)
      .then(async res => {
        const datos = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(datos.error || 'No se pudo cargar la biblioteca')
        return datos as { metodos: FichaLista[]; conteos: Conteos }
      })
      .then(d => { if (vigente) { setFichas(d.metodos); setConteos(d.conteos); setError('') } })
      .catch(e => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo cargar la biblioteca') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [estado, q, tipo, modalidad, nivel, confianza, ia])

  const hayFiltros = Boolean(q || tipo || modalidad || nivel || confianza || ia)
  const limpiar = () => { setTexto(''); setQ(''); setTipo(''); setModalidad(''); setNivel(''); setConfianza(''); setIa('') }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Entrenamiento</p>
          <h1 className="text-2xl font-light">Biblioteca de métodos</h1>
        </div>
        <Link href="/entrenos/metodos/nueva" className="btn btn-primary">Añadir ficha</Link>
      </header>

      <nav className="flex gap-5 border-b" style={{ borderColor: 'var(--border)' }} aria-label="Estado de las fichas">
        {PESTAÑAS.map(e => (
          <button key={e} type="button" onClick={() => setEstado(e)} aria-current={estado === e ? 'page' : undefined}
            className="pb-2 text-sm" style={{ color: estado === e ? 'var(--text)' : 'var(--text-muted)', borderBottom: estado === e ? '1px solid var(--text)' : '1px solid transparent' }}>
            {ETIQUETA[e]}{conteos ? ` · ${conteos[e]}` : ''}
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input" style={{ maxWidth: 260 }} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Buscar por título, autor o etiqueta" aria-label="Buscar" />
        {FILTROS.map(f => (
          <select key={f.clave} className="input" style={{ maxWidth: 170 }} value={valor[f.clave]} onChange={e => poner[f.clave](e.target.value)} aria-label={f.etiqueta}>
            <option value="">{f.etiqueta}: todos</option>
            {f.valores.map(v => <option key={v} value={v}>{ETIQUETA[v]}</option>)}
          </select>
        ))}
        <label className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={ia === '1'} onChange={e => setIa(e.target.checked ? '1' : '')} /> Disponible para la IA
        </label>
        {hayFiltros && <button type="button" className="btn btn-ghost btn-sm" onClick={limpiar}>Limpiar filtros</button>}
      </div>

      {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger, #c0392b)' }}>{error}</p>}

      {cargando && !fichas.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} lines={2} />)}</div>
      ) : !fichas.length && !error ? (
        <p className="text-sm py-10 text-center" style={{ color: 'var(--text-muted)' }}>
          {hayFiltros ? 'Nada con estos filtros.' : estado === 'en_revision' ? 'Aún no hay fichas por revisar. Añade la primera.' : 'No hay fichas en este estado.'}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" style={{ opacity: cargando ? 0.6 : 1 }}>
          {fichas.map(f => (
            <li key={f.id}>
              <Link href={`/entrenos/metodos/${f.id}`} className="card block overflow-hidden h-full">
                {f.miniatura_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={f.miniatura_url} alt="" loading="lazy" className="w-full object-cover" style={{ aspectRatio: '16 / 10' }} />
                  : <div className="w-full flex items-center justify-center text-xs uppercase tracking-widest" style={{ aspectRatio: '16 / 10', background: 'var(--surface-2, rgba(128,128,128,0.08))', color: 'var(--text-muted)' }}>Sin miniatura</div>}
                <div className="p-3 space-y-1">
                  <h2 className="text-base leading-snug">{f.titulo}</h2>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{[f.autor, f.plataforma].filter(Boolean).join(' · ') || 'Sin autor'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {[ETIQUETA[f.tipo], ETIQUETA[f.modalidad], f.nivel && ETIQUETA[f.nivel], f.duracion_min && `${f.duracion_min} min`].filter(Boolean).join(' · ')}
                    {f.disponible_ia ? ' · IA' : ''}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

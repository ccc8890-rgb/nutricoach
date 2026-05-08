'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, BookOpen, ExternalLink, CheckCircle, Trash2, Filter } from 'lucide-react'

const DISCIPLINAS = ['todos', 'hyrox', 'running', 'ciclismo', 'triatlon', 'hibrido', 'fuerza', 'recuperacion', 'nutricion', 'general']
const CATEGORIAS = ['todos', 'periodizacion', 'intensidad', 'volumen', 'fuerza', 'resistencia', 'hiit', 'zona2', 'competicion', 'recuperacion', 'proteina', 'hidratacion', 'suplementacion', 'patologia', 'composicion_corporal', 'metabolismo', 'metodologia', 'otro']

const DISCIPLINA_COLORS: Record<string, string> = {
  hyrox: '#7C3AED',
  running: '#059669',
  ciclismo: '#2563EB',
  triatlon: '#8E8E93',
  hibrido: '#DC2626',
  fuerza: '#374151',
  recuperacion: '#0891B2',
  nutricion: '#16A34A',
  general: '#6B7280',
}

const TIPO_LABELS: Record<string, string> = {
  estudio: 'Estudio',
  meta_analisis: 'Meta-análisis',
  revision: 'Revisión',
  guia_clinica: 'Guía clínica',
  protocolo: 'Protocolo',
  metodologia: 'Metodología',
  referencia: 'Referencia',
  nota_propia: 'Nota propia',
}

type Ficha = {
  id: string
  titulo: string
  resumen: string
  puntos_clave: string[] | null
  fuente: string | null
  disciplina: string
  categoria: string
  tipo: string
  nivel_evidencia: string | null
  tags: string[]
  condiciones: string[]
  verificado: boolean
  fuente_tipo: string
  url_origen: string | null
  doi: string | null
  created_at: string
}

export default function ConocimientoPage() {
  const [fichas, setFichas] = useState<Ficha[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [disciplina, setDisciplina] = useState('todos')
  const [categoria, setCategoria] = useState('todos')
  const [expandida, setExpandida] = useState<string | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)

  async function cargar() {
    setLoading(true)
    const params = new URLSearchParams()
    if (disciplina !== 'todos') params.set('disciplina', disciplina)
    if (categoria !== 'todos') params.set('categoria', categoria)
    if (busqueda.trim().length > 2) params.set('q', busqueda.trim())
    const res = await fetch(`/api/conocimiento?${params}`)
    const json = await res.json()
    setFichas(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [disciplina, categoria])

  async function buscar() { cargar() }

  async function borrar(id: string) {
    if (!confirm('¿Eliminar esta ficha?')) return
    setBorrando(id)
    await fetch(`/api/conocimiento?id=${id}`, { method: 'DELETE' })
    setFichas(prev => prev.filter(f => f.id !== id))
    setBorrando(null)
  }

  const btnStyle = (active: boolean) => active
    ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
    : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Base de Conocimiento</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {fichas.length} fichas · HYROX, running, nutrición, entrenamiento
          </p>
        </div>
        <Link href="/conocimiento/nueva" className="btn btn-primary">
          <Plus size={16} /> Nueva ficha
        </Link>
      </header>

      {/* Filtros */}
      <div className="space-y-3 mb-6">
        {/* Búsqueda */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              className="input search-input"
              placeholder="Buscar en títulos, resúmenes, tags…"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
            />
          </div>
          <button onClick={buscar} className="btn-secondary">Buscar</button>
        </div>

        {/* Disciplina */}
        <div className="flex gap-1.5 flex-wrap">
          {DISCIPLINAS.map(d => (
            <button key={d} onClick={() => setDisciplina(d)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium capitalize"
              style={btnStyle(disciplina === d)}>
              {d === 'todos' ? 'Todas' : d}
            </button>
          ))}
        </div>

        {/* Categoría */}
        <div className="flex gap-1.5 flex-wrap">
          <Filter size={13} className="self-center" style={{ color: 'var(--text-muted)' }} />
          {CATEGORIAS.slice(0, 8).map(c => (
            <button key={c} onClick={() => setCategoria(c)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium"
              style={btnStyle(categoria === c)}>
              {c === 'todos' ? 'Todas' : c.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 skeleton rounded-xl animate-pulse" />)}
        </div>
      ) : fichas.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No hay fichas con estos filtros</p>
          <Link href="/conocimiento/nueva" className="btn btn-primary mt-4">
            <Plus size={16} /> Añadir primera ficha
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {fichas.map(f => (
            <div key={f.id} className="card !p-0 overflow-hidden">
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandida(expandida === f.id ? null : f.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Disciplina badge */}
                  <span className="text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5 capitalize"
                    style={{
                      background: (DISCIPLINA_COLORS[f.disciplina] ?? '#6B7280') + '20',
                      color: DISCIPLINA_COLORS[f.disciplina] ?? '#6B7280',
                    }}>
                    {f.disciplina}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-sm leading-snug" style={{ color: 'var(--text)' }}>
                        {f.titulo}
                      </h3>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {f.verificado && <CheckCircle size={14} style={{ color: 'var(--primary)' }} />}
                        <span className="text-xs px-2 py-0.5 rounded border"
                          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                          {TIPO_LABELS[f.tipo] ?? f.tipo}
                        </span>
                      </div>
                    </div>
                    {f.fuente && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.fuente}</p>
                    )}
                    <p className="text-xs mt-1.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {f.resumen}
                    </p>
                  </div>
                </div>
              </div>

              {/* Expandido */}
              {expandida === f.id && (
                <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border)' }}>
                  {f.puntos_clave && f.puntos_clave.length > 0 && (
                    <div className="pt-3">
                      <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Puntos clave</p>
                      <ul className="space-y-1">
                        {f.puntos_clave.map((p, i) => (
                          <li key={i} className="text-xs flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                            <span className="text-green-500 mt-0.5">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {f.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {f.tags.map(t => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {f.condiciones.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Condiciones:</span>
                      {f.condiciones.map(c => (
                        <span key={c} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: '#FEF3C7', color: '#92400E' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-2">
                      {f.url_origen && (
                        <a href={f.url_origen} target="_blank" rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 text-blue-500 hover:underline">
                          <ExternalLink size={11} /> Ver fuente
                        </a>
                      )}
                      {f.doi && (
                        <a href={`https://doi.org/${f.doi}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 text-blue-500 hover:underline">
                          <ExternalLink size={11} /> DOI
                        </a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/conocimiento/${f.id}`}
                        className="text-xs px-3 py-1 rounded-lg border font-medium"
                        style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                        Editar
                      </Link>
                      <button
                        disabled={borrando === f.id}
                        onClick={() => borrar(f.id)}
                        className="text-xs px-3 py-1 rounded-lg border font-medium text-red-400 hover:text-red-600 hover:border-red-300">
                        <Trash2 size={11} className="inline mr-1" />
                        {borrando === f.id ? '…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

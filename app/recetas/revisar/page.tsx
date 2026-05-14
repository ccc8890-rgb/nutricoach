'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, AlertTriangle, Check, X, ExternalLink, FileText, ImageIcon, MessageSquare, Hash, ChefHat, FileWarning, RefreshCw, List, BarChart } from 'lucide-react'

// ─── Tipos ───
interface RecetaRevisar {
    id: string
    nombre: string
    descripcion: string | null
    instrucciones: string | null
    consejos: string | null
    notas_coach: string | null
    categoria: string | null
    tipo_coccion: string | null
    dificultad: string | null
    intolerancias: string[] | null
    tags: string[] | null
    porciones: number | null
    descripcion_porcion: string | null
    tiempo_prep_min: number | null
    tiempo_coccion_min: number | null
    kcal: number | null
    proteinas: number | null
    carbohidratos: number | null
    grasas: number | null
    fibra: number | null
    imagen_url: string | null
    url_origen: string | null
    fuente: string | null
    estado: string | null
    created_at: string | null
    updated_at: string | null
    num_ingredientes: number
}

interface ApiResponse {
    data: RecetaRevisar[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

// ─── Campos a revisar ───
const CAMPOS = [
    { key: 'descripcion', label: 'Descripción', icon: FileText },
    { key: 'instrucciones', label: 'Instrucciones', icon: FileText },
    { key: 'consejos', label: 'Consejos', icon: MessageSquare },
    { key: 'notas_coach', label: 'Notas Coach', icon: MessageSquare },
    { key: 'categoria', label: 'Categoría', icon: List },
    { key: 'tipo_coccion', label: 'Cocción', icon: ChefHat },
    { key: 'dificultad', label: 'Dificultad', icon: BarChart },
    { key: 'intolerancias', label: 'Intolerancias', icon: FileWarning },
    { key: 'imagen_url', label: 'Imagen', icon: ImageIcon },
    { key: 'url_origen', label: 'URL Origen', icon: ExternalLink },
    { key: 'kcal', label: 'Macros', icon: Hash },
] as const

type CampoKey = (typeof CAMPOS)[number]['key']

function tieneCampo(r: RecetaRevisar, key: CampoKey): boolean {
    if (key === 'intolerancias') return Array.isArray(r.intolerancias) && r.intolerancias.length > 0
    if (key === 'kcal') return r.kcal !== null && r.kcal > 0
    if (key === 'imagen_url') return !!r.imagen_url
    if (key === 'url_origen') return !!r.url_origen
    if (key === 'notas_coach') return !!r.notas_coach
    const val = (r as any)[key]
    return val !== null && val !== undefined && val !== ''
}

// ─── Componente ───
export default function RevisarRecetasPage() {
    const [data, setData] = useState<ApiResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [busqueda, setBusqueda] = useState('')
    const [filtroCampo, setFiltroCampo] = useState<CampoKey | 'todos' | 'incompletas'>('todos')
    const [pagina, setPagina] = useState(1)
    const [soloProblemas, setSoloProblemas] = useState(false)

    async function cargar(p: number) {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/recetas/revisar?page=${p}&pageSize=250`)
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.error || `Error ${res.status}`)
            }
            const json: ApiResponse = await res.json()
            setData(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al cargar')
        }
        setLoading(false)
    }

    useEffect(() => { cargar(pagina) }, [pagina])

    // ── Métricas ──
    type Metricas = Record<string, { llenos: number; total: number }> & { total: number }

    const metricas = useMemo((): Metricas | null => {
        if (!data) return null
        const recetas = data.data
        const total = recetas.length
        const m: Record<string, { llenos: number; total: number }> = {}
        CAMPOS.forEach(c => {
            const llenos = recetas.filter(r => tieneCampo(r, c.key)).length
            m[c.key] = { llenos, total }
        })
        m['num_ingredientes'] = { llenos: recetas.filter(r => r.num_ingredientes > 0).length, total }
        return { ...m, total } as Metricas
    }, [data])

    // ── Filtrado ──
    const filtradas = useMemo(() => {
        if (!data) return []
        let recetas = data.data

        // Búsqueda
        if (busqueda) {
            const q = busqueda.toLowerCase()
            recetas = recetas.filter(r => r.nombre.toLowerCase().includes(q))
        }

        // Filtro por campo faltante
        if (filtroCampo === 'incompletas') {
            recetas = recetas.filter(r =>
                CAMPOS.some(c => !tieneCampo(r, c.key))
            )
        } else if (filtroCampo !== 'todos') {
            if (soloProblemas) {
                recetas = recetas.filter(r => !tieneCampo(r, filtroCampo))
            }
        }

        return recetas
    }, [data, busqueda, filtroCampo, soloProblemas])

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            {/* Header */}
            <div className="sticky top-0 z-10 border-b" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/recetas" className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                        <ArrowLeft size={20} />
                    </Link>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Revisión de Recetas</h1>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {data ? `${data.total} recetas en total` : 'Cargando...'}
                        </p>
                    </div>
                    <button
                        onClick={() => cargar(pagina)}
                        className="p-2 rounded-lg border transition-all"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">
                {/* ═══ Métricas ═══ */}
                {metricas && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {CAMPOS.map(c => {
                            const m = metricas[c.key]
                            const pct = m.total > 0 ? Math.round((m.llenos / m.total) * 100) : 0
                            const Icon = c.icon
                            return (
                                <button
                                    key={c.key}
                                    onClick={() => {
                                        setFiltroCampo(c.key)
                                        setSoloProblemas(pct < 100)
                                    }}
                                    className="relative rounded-xl p-3 border text-left transition-all"
                                    style={{
                                        borderColor: filtroCampo === c.key ? 'var(--accent)' : 'var(--border)',
                                        background: filtroCampo === c.key ? 'var(--accent-bg)' : 'var(--surface)',
                                    }}
                                >
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon size={12} style={{ color: pct === 100 ? 'var(--primary)' : 'var(--text-muted)' }} />
                                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>{m.llenos}</span>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {m.total}</span>
                                        <span className="text-xs font-semibold ml-auto tabular-nums" style={{
                                            color: pct === 100 ? 'var(--primary)' : pct >= 80 ? '#E8A838' : '#FF6B6B'
                                        }}>
                                            {pct}%
                                        </span>
                                    </div>
                                    {/* Barra de progreso */}
                                    <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                        <div className="h-full rounded-full transition-all duration-500" style={{
                                            width: `${pct}%`,
                                            background: pct === 100 ? 'var(--primary)' : pct >= 80 ? '#E8A838' : '#FF6B6B',
                                        }} />
                                    </div>
                                </button>
                            )
                        })}
                        {/* Ingredientes */}
                        <button
                            onClick={() => setFiltroCampo('todos')}
                            className="rounded-xl p-3 border text-left transition-all"
                            style={{
                                borderColor: filtroCampo === 'todos' ? 'var(--accent)' : 'var(--border)',
                                background: filtroCampo === 'todos' ? 'var(--accent-bg)' : 'var(--surface)',
                            }}
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <List size={12} style={{ color: metricas.num_ingredientes.llenos === metricas.num_ingredientes.total ? 'var(--primary)' : 'var(--text-muted)' }} />
                                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ingredientes</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--text)' }}>{metricas.num_ingredientes.llenos}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/ {metricas.num_ingredientes.total}</span>
                            </div>
                        </button>
                    </div>
                )}

                {/* ═══ Error ═══ */}
                {error && (
                    <div className="rounded-xl p-4 border" style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
                        <div className="flex items-center gap-2">
                            <AlertTriangle size={16} />
                            <span className="text-sm font-medium">Error: {error}</span>
                        </div>
                        <button onClick={() => cargar(pagina)} className="text-sm underline mt-1">Reintentar</button>
                    </div>
                )}

                {/* ═══ Buscador + Filtros ═══ */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input
                            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none"
                            placeholder="Buscar receta..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
                            onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                        />
                    </div>
                    <select
                        value={filtroCampo}
                        onChange={e => {
                            const val = e.target.value as CampoKey | 'todos' | 'incompletas'
                            setFiltroCampo(val)
                            setSoloProblemas(val === 'incompletas' ? true : val !== 'todos')
                        }}
                        className="text-sm px-3 py-2 rounded-lg border outline-none"
                        style={{ color: 'var(--text)', background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                        <option value="todos">Todas las recetas</option>
                        <option value="incompletas">Incompletas (falta algo)</option>
                        {CAMPOS.map(c => (
                            <option key={c.key} value={c.key}>
                                Sin {c.label.toLowerCase()}
                            </option>
                        ))}
                    </select>
                </div>

                {/* ═══ Loading ═══ */}
                {loading && (
                    <div className="space-y-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--surface)' }} />
                        ))}
                    </div>
                )}

                {/* ═══ Tabla ═══ */}
                {!loading && data && (
                    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                                    <th className="text-left px-3 py-2.5 text-xs font-semibold sticky left-0 z-10" style={{ color: 'var(--text-secondary)', background: 'var(--surface)' }}>
                                        Receta
                                    </th>
                                    {CAMPOS.map(c => (
                                        <th key={c.key} className="text-center px-2 py-2.5 text-xs font-semibold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                            <div className="flex items-center justify-center gap-1">
                                                <c.icon size={11} />
                                                {c.label}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="text-center px-2 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        <div className="flex items-center justify-center gap-1">
                                            <List size={11} />
                                            Ing.
                                        </div>
                                    </th>
                                    <th className="text-center px-2 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        Kcal
                                    </th>
                                    <th className="text-right px-3 py-2.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        Acción
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtradas.map((r, idx) => {
                                    const incompleta = CAMPOS.some(c => !tieneCampo(r, c.key))
                                    return (
                                        <tr
                                            key={r.id}
                                            style={{
                                                borderBottom: idx < filtradas.length - 1 ? '1px solid var(--border)' : 'none',
                                                background: incompleta ? 'var(--accent-bg)' : 'var(--bg)',
                                            }}
                                        >
                                            {/* Nombre */}
                                            <td className="px-3 py-2 sticky left-0 z-10" style={{
                                                background: incompleta ? 'var(--accent-bg)' : 'var(--bg)',
                                                minWidth: '180px',
                                            }}>
                                                <div className="flex items-center gap-2">
                                                    {incompleta && <AlertTriangle size={12} style={{ color: '#E8A838', flexShrink: 0 }} />}
                                                    <span className="font-medium truncate max-w-[200px]" style={{ color: 'var(--text)' }} title={r.nombre}>
                                                        {r.nombre}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Campos */}
                                            {CAMPOS.map(c => {
                                                const ok = tieneCampo(r, c.key)
                                                return (
                                                    <td key={c.key} className="px-2 py-2 text-center">
                                                        {ok ? (
                                                            <Check size={14} className="mx-auto" style={{ color: 'var(--primary)' }} />
                                                        ) : (
                                                            <X size={14} className="mx-auto" style={{ color: '#FF6B6B' }} />
                                                        )}
                                                    </td>
                                                )
                                            })}

                                            {/* Ingredientes */}
                                            <td className="px-2 py-2 text-center">
                                                <span className={`text-xs font-mono tabular-nums ${r.num_ingredientes > 0 ? '' : 'opacity-40'}`}
                                                    style={{ color: r.num_ingredientes > 0 ? 'var(--text)' : 'var(--text-muted)' }}>
                                                    {r.num_ingredientes}
                                                </span>
                                            </td>

                                            {/* Kcal */}
                                            <td className="px-2 py-2 text-center">
                                                <span className="text-xs font-mono tabular-nums"
                                                    style={{ color: r.kcal ? 'var(--text)' : 'var(--text-muted)' }}>
                                                    {r.kcal ? Math.round(r.kcal) : '-'}
                                                </span>
                                            </td>

                                            {/* Acción */}
                                            <td className="px-3 py-2 text-right">
                                                <Link
                                                    href={`/recetas/${r.id}`}
                                                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition-all"
                                                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                                                >
                                                    Ver
                                                    <ExternalLink size={11} />
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>

                        {filtradas.length === 0 && (
                            <div className="text-center py-12">
                                <Check size={36} className="mx-auto mb-3" style={{ color: 'var(--primary)' }} />
                                <p className="font-medium" style={{ color: 'var(--text)' }}>No hay recetas que coincidan</p>
                                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                                    {filtroCampo !== 'todos' ? 'Todas las recetas tienen este campo completo' : 'Prueba con otros filtros'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ Paginación ═══ */}
                {data && data.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                            disabled={pagina <= 1}
                            onClick={() => setPagina(p => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                            Anterior
                        </button>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            Pág. {pagina} de {data.totalPages}
                        </span>
                        <button
                            disabled={pagina >= data.totalPages}
                            onClick={() => setPagina(p => p + 1)}
                            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-30"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                        >
                            Siguiente
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, TrendingDown, Euro, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'

interface PrecioComparativo {
    supermercado_id: string
    supermercado_nombre: string
    supermercado_slug: string
    supermercado_color: string
    precio_por_kg: number | null
    coste_euros: number | null
    url_producto: string | null
    es_mas_barato: boolean
}

interface IngredienteCoste {
    alimento_id: string
    alimento_nombre: string
    categoria: string
    cantidad_gramos: number
    precio_por_kg: number
    coste_euros: number
    coste_por_porcion: number
    super_mas_barato: { id: string; nombre: string } | null
    precios_comparativos: PrecioComparativo[]
}

interface ComparativaSuper {
    supermercado_id: string
    supermercado_nombre: string
    supermercado_slug: string
    supermercado_color: string
    coste_total: number
    coste_por_porcion: number
    ingredientes_sin_precio: number
    cobertura_pct: number
}

interface EscandalloData {
    receta_id: string
    receta_nombre: string
    porciones: number
    supermercado_id: string | null
    coste_total: number
    coste_por_porcion: number
    ingredientes: IngredienteCoste[]
    comparativa_supermercados: ComparativaSuper[]
    sin_ingredientes?: boolean
}

interface Supermercado {
    id: string
    nombre: string
    color: string
}

interface EscandalloRecetaProps {
    recetaId: string
}

export default function EscandalloReceta({ recetaId }: EscandalloRecetaProps) {
    const [data, setData] = useState<EscandalloData | null>(null)
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [supSel, setSupSel] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

    async function cargar(supId?: string) {
        setLoading(true)
        setError('')
        try {
            const params = new URLSearchParams({ id: recetaId })
            if (supId) params.set('supermercado_id', supId)
            const res = await fetch(`/api/precios/escandallo/receta?${params}`)
            const json = await res.json()
            if (!res.ok) setError(json.error || 'Error al cargar')
            else setData(json)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error de red')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetch('/api/precios/supermercados')
            .then(r => r.json())
            .then(d => setSupermercados(d.supermercados || d || []))
            .catch(e => { console.error('[EscandalloReceta] Error cargando supermercados:', e); setError('Error al cargar supermercados') })
        cargar()
    }, [recetaId])

    useEffect(() => {
        cargar(supSel || undefined)
    }, [supSel])

    function toggleExpandir(id: string) {
        setExpandidos(prev => {
            const s = new Set(prev)
            s.has(id) ? s.delete(id) : s.add(id)
            return s
        })
    }

    function formatGramos(g: number) {
        return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g} g`
    }

    if (loading) {
        return (
            <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 rounded-xl" style={{ background: 'var(--surface)' }} />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                ❌ {error}
            </div>
        )
    }

    if (!data || data.sin_ingredientes) {
        return (
            <div className="p-6 text-center rounded-xl" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Esta receta no tiene ingredientes vinculados a alimentos de la BD.</p>
                <p className="text-xs mt-1">Edita la receta para añadir ingredientes.</p>
            </div>
        )
    }

    const mejorSuper = data.comparativa_supermercados[0]
    const sinPrecio = data.ingredientes.filter(i => i.precio_por_kg === 0)

    return (
        <div className="space-y-5">

            {/* Selector de supermercado */}
            <div className="flex items-center gap-3 flex-wrap">
                <select
                    value={supSel}
                    onChange={e => setSupSel(e.target.value)}
                    className="px-3 py-2 rounded-lg border text-sm"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                    <option value="">Precio más barato (automático)</option>
                    {supermercados.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                </select>
            </div>

            {/* Resumen de costes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Coste total receta</div>
                    <div className="text-2xl font-bold">{data.coste_total.toFixed(2)} €</div>
                </div>
                <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Coste por porción</div>
                    <div className="text-2xl font-bold">{data.coste_por_porcion.toFixed(2)} €</div>
                </div>
                {mejorSuper && (
                    <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>Más barato en</div>
                        <div className="text-base font-bold">{mejorSuper.supermercado_nombre}</div>
                        <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                            {mejorSuper.coste_total.toFixed(2)} € · {mejorSuper.cobertura_pct}% cobertura
                        </div>
                    </div>
                )}
            </div>

            {/* Comparativa por supermercado */}
            {data.comparativa_supermercados.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
                        Comparativa de supermercados
                    </h4>
                    <div className="space-y-2">
                        {data.comparativa_supermercados.map((s, i) => {
                            const ahorro = i === 0 ? 0 : s.coste_total - data.comparativa_supermercados[0].coste_total
                            return (
                                <div key={s.supermercado_id}
                                    className="flex items-center justify-between p-3 rounded-xl border"
                                    style={{ background: 'var(--card)', borderColor: i === 0 ? s.supermercado_color || 'var(--accent)' : 'var(--border)', borderWidth: i === 0 ? '2px' : '1px' }}>
                                    <div className="flex items-center gap-2">
                                        {i === 0 && <TrendingDown className="w-4 h-4" style={{ color: s.supermercado_color || 'var(--accent)' }} />}
                                        <div>
                                            <span className="text-sm font-medium">{s.supermercado_nombre}</span>
                                            {s.ingredientes_sin_precio > 0 && (
                                                <span className="ml-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                    ({s.ingredientes_sin_precio} sin precio)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold">{s.coste_total.toFixed(2)} €</div>
                                        {ahorro > 0 && (
                                            <div className="text-xs" style={{ color: '#ef4444' }}>+{ahorro.toFixed(2)} €</div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Desglose por ingrediente */}
            <div>
                <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
                    Coste por ingrediente
                </h4>
                <div className="space-y-2">
                    {data.ingredientes.map(ing => {
                        const expandido = expandidos.has(ing.alimento_id)
                        const sinPrecioIng = ing.precio_por_kg === 0
                        return (
                            <div key={ing.alimento_id} className="rounded-xl border overflow-hidden"
                                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                                <button
                                    onClick={() => toggleExpandir(ing.alimento_id)}
                                    className="w-full flex items-center justify-between p-3 text-left hover:bg-black/5 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-medium truncate">{ing.alimento_nombre}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                                                {formatGramos(ing.cantidad_gramos)}
                                            </span>
                                            {ing.super_mas_barato && !supSel && (
                                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                                    {ing.super_mas_barato.nombre}
                                                </span>
                                            )}
                                        </div>
                                        {sinPrecioIng && (
                                            <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>Sin precio registrado</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 ml-3 shrink-0">
                                        <div className="text-right">
                                            <div className="text-sm font-bold">{sinPrecioIng ? '—' : `${ing.coste_euros.toFixed(2)} €`}</div>
                                            {!sinPrecioIng && (
                                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                    {ing.precio_por_kg.toFixed(2)} €/kg
                                                </div>
                                            )}
                                        </div>
                                        {ing.precios_comparativos.length > 0 && (
                                            expandido
                                                ? <ChevronUp className="w-4 h-4 opacity-40" />
                                                : <ChevronDown className="w-4 h-4 opacity-40" />
                                        )}
                                    </div>
                                </button>

                                {expandido && ing.precios_comparativos.length > 0 && (
                                    <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="pt-2 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                                            Comparativa de precios
                                        </div>
                                        {ing.precios_comparativos.map(pc => (
                                            <div key={pc.supermercado_id}
                                                className="flex items-center justify-between py-1.5 px-2 rounded-lg"
                                                style={{ background: pc.es_mas_barato ? '#f0fdf4' : 'var(--surface)' }}>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0"
                                                        style={{ background: pc.supermercado_color || 'var(--muted-foreground)' }} />
                                                    <span className="text-xs">{pc.supermercado_nombre}</span>
                                                    {pc.es_mas_barato && (
                                                        <span className="text-xs font-medium" style={{ color: '#16a34a' }}>más barato</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-medium">
                                                        {pc.coste_euros !== null ? `${pc.coste_euros.toFixed(2)} €` : '—'}
                                                    </span>
                                                    <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                        ({pc.precio_por_kg?.toFixed(2)} €/kg)
                                                    </span>
                                                    {pc.url_producto && (
                                                        <a href={pc.url_producto} target="_blank" rel="noopener noreferrer"
                                                            onClick={e => e.stopPropagation()}>
                                                            <ExternalLink className="w-3 h-3 opacity-40 hover:opacity-100" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {sinPrecio.length > 0 && (
                <div className="p-3 rounded-xl text-xs" style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                    ⚠️ {sinPrecio.length} ingrediente{sinPrecio.length > 1 ? 's' : ''} sin precio registrado en ningún supermercado.
                    El coste real puede ser mayor.
                </div>
            )}
        </div>
    )
}

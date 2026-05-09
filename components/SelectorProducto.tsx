'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────

interface ProductoOption {
    id: string
    supermercado_id: string
    supermercado_nombre: string
    supermercado_slug: string
    supermercado_color?: string | null
    nombre_original?: string | null
    marca?: string | null
    precio_por_kg: number
    precio_unidad?: number | null
    url_producto?: string | null
    preferido: boolean
    fecha_precio: string
}

interface ProductosResponse {
    alimento_id: string
    alimento_nombre: string
    alimento_categoria: string | null
    total_productos: number
    productos: ProductoOption[]
}

interface Props {
    alimentoId: string
    alimentoNombre: string
    cantidadGramos: number
    /** Supermercado activo actualmente en el escandallo */
    supermercadoActivoId?: string
    /** Callback cuando se cambia la selección */
    onSeleccionCambiada?: (alimentoId: string, productoId: string, precioKg: number) => void
    /** Precio por kg actual (calculado fuera) */
    precioActualKg?: number
    /** Si es el componente que muestra el coste */
    mostrarCoste?: boolean
}

// ── Helpers ────────────────────────────────────────────────────

function cn(classes: Record<string, boolean>): string {
    return Object.entries(classes)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(' ')
}

function formatearPrecio(euros: number): string {
    return euros.toFixed(2) + '€'
}

function getSuperColor(color?: string | null): string {
    return color || 'var(--accent)'
}

// ── Componente ─────────────────────────────────────────────────

export default function SelectorProducto({
    alimentoId,
    alimentoNombre,
    cantidadGramos,
    supermercadoActivoId,
    onSeleccionCambiada,
    precioActualKg,
    mostrarCoste = true,
}: Props) {
    const [data, setData] = useState<ProductosResponse | null>(null)
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [expandido, setExpandido] = useState(false)
    const [productoSeleccionado, setProductoSeleccionado] = useState<string | null>(null)

    const coste = cantidadGramos > 0 && precioActualKg
        ? (cantidadGramos / 1000) * precioActualKg
        : 0

    // Cargar productos
    const cargar = useCallback(async () => {
        setCargando(true)
        setError('')
        try {
            const res = await fetch(`/api/precios/alimento/${alimentoId}/productos`)
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al cargar')
            }
            const json: ProductosResponse = await res.json()
            setData(json)

            // Seleccionar el preferido o el más barato del supermercado activo
            const preferido = json.productos.find(p => p.preferido)
            if (preferido) {
                setProductoSeleccionado(preferido.id)
            } else if (json.productos.length > 0) {
                // Si hay supermercado activo, coger el más barato de ese super
                if (supermercadoActivoId) {
                    const delSuper = json.productos
                        .filter(p => p.supermercado_id === supermercadoActivoId)
                        .sort((a, b) => a.precio_por_kg - b.precio_por_kg)
                    if (delSuper.length > 0) {
                        setProductoSeleccionado(delSuper[0].id)
                    } else {
                        setProductoSeleccionado(json.productos[0].id)
                    }
                } else {
                    setProductoSeleccionado(json.productos[0].id)
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de red')
        } finally {
            setCargando(false)
        }
    }, [alimentoId, supermercadoActivoId])

    useEffect(() => { cargar() }, [cargar])

    // Marcar como preferido
    async function marcarPreferido(productoId: string) {
        try {
            const res = await fetch(`/api/precios/productos/${productoId}/preferir`, {
                method: 'POST',
            })
            if (!res.ok) return
            // Recargar para reflejar cambios
            await cargar()
        } catch { /* silencio */ }
    }

    function seleccionar(producto: ProductoOption) {
        setProductoSeleccionado(producto.id)
        onSeleccionCambiada?.(alimentoId, producto.id, producto.precio_por_kg)
        setExpandido(false)
    }

    // ── Render ──────────────────────────────────────────────────

    // Estados vacío / error
    if (error) {
        return (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>⚠️ {error}</span>
            </div>
        )
    }

    if (cargando) {
        return (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="animate-spin">⟳</span>
                Cargando productos...
            </div>
        )
    }

    if (!data || data.productos.length === 0) {
        return (
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Sin precios para {alimentoNombre}
            </div>
        )
    }

    const seleccionado = data.productos.find(p => p.id === productoSeleccionado)
    const productosAgrupados = agruparPorSupermercado(data.productos)

    return (
        <div className="space-y-1">
            {/* Fila principal: producto seleccionado */}
            <button
                onClick={() => setExpandido(!expandido)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-all"
                style={{
                    background: expandido ? 'var(--surface-hover)' : 'var(--surface)',
                    border: '1px solid var(--border)',
                }}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {/* Indicador del supermercado */}
                    {seleccionado && (
                        <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: getSuperColor(seleccionado.supermercado_color) }}
                        />
                    )}
                    <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                            {seleccionado?.supermercado_nombre || 'Seleccionar...'}
                        </div>
                        {seleccionado?.nombre_original && (
                            <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                {seleccionado.nombre_original}
                                {seleccionado.marca && ` · ${seleccionado.marca}`}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {seleccionado && (
                        <>
                            <span className="text-sm font-semibold">
                                {formatearPrecio(seleccionado.precio_por_kg)}/kg
                            </span>
                            {mostrarCoste && coste > 0 && (
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {formatearPrecio(coste)}
                                </span>
                            )}
                        </>
                    )}
                    {seleccionado?.preferido && (
                        <span className="text-xs" title="Preferido">★</span>
                    )}
                    <span className={`text-xs transition-transform ${expandido ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--text-muted)' }}>
                        ▼
                    </span>
                </div>
            </button>

            {/* Panel expandido con alternativas */}
            {expandido && (
                <div
                    className="rounded-lg border overflow-hidden animate-fade-in"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg-subtle)' }}
                >
                    {/* Agrupados por supermercado */}
                    {productosAgrupados.map((grupo) => (
                        <div key={grupo.supermercado_id}>
                            {/* Cabecera del supermercado */}
                            <div
                                className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
                                style={{
                                    background: 'var(--surface)',
                                    color: 'var(--text-secondary)',
                                    borderBottom: '1px solid var(--border-light)',
                                }}
                            >
                                <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: getSuperColor(grupo.color) }}
                                />
                                {grupo.supermercado_nombre}
                            </div>

                            {/* Productos de este supermercado */}
                            {grupo.productos.map((p) => {
                                const esSeleccionado = p.id === productoSeleccionado
                                return (
                                    <div
                                        key={p.id}
                                        className={cn({
                                            'flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors cursor-pointer': true,
                                        })}
                                        style={{
                                            background: esSeleccionado ? 'var(--accent-bg)' : 'transparent',
                                            borderBottom: '1px solid var(--border-light)',
                                        }}
                                        onClick={() => seleccionar(p)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') seleccionar(p) }}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`Seleccionar ${p.nombre_original || p.supermercado_nombre}`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="min-w-0">
                                                <div className="text-sm truncate">
                                                    {p.nombre_original || 'Producto'}
                                                    {p.marca && (
                                                        <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                                                            ({p.marca})
                                                        </span>
                                                    )}
                                                </div>
                                                {p.precio_unidad && (
                                                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        Unidad: {formatearPrecio(p.precio_unidad)}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-semibold text-sm whitespace-nowrap">
                                                {formatearPrecio(p.precio_por_kg)}/kg
                                            </span>

                                            {p.preferido && (
                                                <span className="badge badge-graphite text-[10px] px-1.5">★ Pref.</span>
                                            )}

                                            {!p.preferido && !esSeleccionado && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); marcarPreferido(p.id) }}
                                                    className="btn btn-ghost btn-sm text-[10px] px-1.5 py-0.5"
                                                    title="Marcar como preferido"
                                                >
                                                    ☆ Preferir
                                                </button>
                                            )}

                                            {esSeleccionado && (
                                                <span className="text-xs" style={{ color: 'var(--accent)' }}>✓</span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ))}

                    {/* Footer */}
                    <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
                        {data.total_productos} producto{data.total_productos !== 1 ? 's' : ''} · {data.productos.filter(p => p.preferido).length} preferido
                        {cantidadGramos > 0 && ` · ${cantidadGramos}g/semana`}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Helpers de agrupación ──────────────────────────────────────

interface GrupoSupermercado {
    supermercado_id: string
    supermercado_nombre: string
    slug: string
    color?: string | null
    productos: ProductoOption[]
}

function agruparPorSupermercado(productos: ProductoOption[]): GrupoSupermercado[] {
    const mapa = new Map<string, GrupoSupermercado>()
    for (const p of productos) {
        if (!mapa.has(p.supermercado_id)) {
            mapa.set(p.supermercado_id, {
                supermercado_id: p.supermercado_id,
                supermercado_nombre: p.supermercado_nombre,
                slug: p.supermercado_slug,
                color: p.supermercado_color,
                productos: [],
            })
        }
        mapa.get(p.supermercado_id)!.productos.push(p)
    }
    return Array.from(mapa.values())
}

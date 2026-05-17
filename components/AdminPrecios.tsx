'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    Store, Search, X, Euro, Save, Trash2, Plus,
    ChevronDown, ChevronUp, ExternalLink, RefreshCw,
    Loader2, Check, AlertCircle, TrendingUp
} from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { Supermercado, Alimento, PrecioActual } from '@/types'

const PAGE_SIZE = 200

interface ProductoForm {
    supermercado_id: string
    alimento_id: string
    precio_por_kg: string
    precio_unidad: string
    url_producto: string
}

const PRODUCTO_VACIO: ProductoForm = {
    supermercado_id: '',
    alimento_id: '',
    precio_por_kg: '',
    precio_unidad: '',
    url_producto: '',
}

export default function AdminPrecios() {
    const { addToast } = useToast()

    // Estados
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [precios, setPrecios] = useState<PrecioActual[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [cargando, setCargando] = useState(true)
    const [supermercadoSel, setSupermercadoSel] = useState<string | null>(null)
    const [busqueda, setBusqueda] = useState('')
    const [mostrarForm, setMostrarForm] = useState(false)
    const [form, setForm] = useState<ProductoForm>(PRODUCTO_VACIO)
    const [guardando, setGuardando] = useState(false)
    const [pagina, setPagina] = useState(0)

    // Búsqueda de alimentos para el formulario
    const [queryAlimento, setQueryAlimento] = useState('')
    const [resultadosAlimentos, setResultadosAlimentos] = useState<Alimento[]>([])
    const [buscandoAlimento, setBuscandoAlimento] = useState(false)

    // Edición inline
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [editValor, setEditValor] = useState('')

    const totalPaginas = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

    // Cargar datos con paginación real
    const cargarPrecios = useCallback(async () => {
        setCargando(true)

        let query = supabase
            .from('precios_actuales')
            .select('*', { count: 'exact' })

        if (supermercadoSel) {
            query = query.eq('supermercado_id', supermercadoSel)
        }

        if (busqueda) {
            const q = busqueda.toLowerCase()
            query = query.or(`alimento_nombre.ilike.%${q}%,alimento_categoria.ilike.%${q}%`)
        }

        const from = pagina * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const { data, count, error } = await query
            .order('alimento_categoria', { ascending: true })
            .order('alimento_nombre', { ascending: true })
            .range(from, to)

        if (error) {
            addToast({ type: 'error', title: 'Error al cargar', message: error.message })
        }

        setPrecios(data ?? [])
        setTotalCount(count ?? 0)
        setCargando(false)
    }, [supermercadoSel, busqueda, pagina, addToast])

    // Cargar supermercados al inicio
    useEffect(() => {
        supabase.from('supermercados').select('*').eq('activo', true).order('nombre')
            .then(({ data }) => {
                setSupermercados(data ?? [])
                if ((data ?? []).length > 0 && !supermercadoSel) {
                    setSupermercadoSel(data![0].id)
                }
            })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Recargar precios cuando cambia supermercado, búsqueda o página
    useEffect(() => {
        if (supermercadoSel) {
            cargarPrecios()
        } else {
            setPrecios([])
            setTotalCount(0)
            setCargando(false)
        }
    }, [cargarPrecios, supermercadoSel])

    // Resetear página al cambiar supermercado o búsqueda
    useEffect(() => {
        setPagina(0)
    }, [supermercadoSel, busqueda])

    // Búsqueda de alimentos
    useEffect(() => {
        if (!queryAlimento || queryAlimento.length < 2) {
            setResultadosAlimentos([])
            return
        }
        setBuscandoAlimento(true)
        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('alimentos')
                .select('*')
                .ilike('nombre', `%${queryAlimento}%`)
                .limit(10)
            setResultadosAlimentos(data ?? [])
            setBuscandoAlimento(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [queryAlimento])

    // Precios filtrados solo por búsqueda local (el filtro de supermercado ya es SQL)
    const preciosFiltrados = useMemo(() => {
        return precios
    }, [precios])

    // Guardar nuevo precio
    async function guardarProducto() {
        if (!form.supermercado_id || !form.alimento_id || !form.precio_por_kg) {
            addToast({ type: 'error', title: 'Campos requeridos', message: 'Supermercado, alimento y precio son obligatorios' })
            return
        }
        setGuardando(true)
        const { error } = await supabase.from('productos_supermercado').upsert({
            supermercado_id: form.supermercado_id,
            alimento_id: form.alimento_id,
            precio_por_kg: parseFloat(form.precio_por_kg),
            precio_unidad: form.precio_unidad ? parseFloat(form.precio_unidad) : null,
            url_producto: form.url_producto || null,
            fecha_precio: new Date().toISOString().split('T')[0],
        }, { onConflict: 'supermercado_id, alimento_id' })

        if (error) {
            addToast({ type: 'error', title: 'Error', message: error.message })
        } else {
            addToast({ type: 'success', title: 'Precio guardado', message: 'El precio se ha actualizado correctamente' })
            setMostrarForm(false)
            setForm(PRODUCTO_VACIO)
            setQueryAlimento('')
            setResultadosAlimentos([])
            cargarPrecios()
        }
        setGuardando(false)
    }

    // Eliminar precio
    async function eliminarPrecio(id: string) {
        const { error } = await supabase.from('productos_supermercado').delete().eq('id', id)
        if (!error) {
            setPrecios(prev => prev.filter(p => p.id !== id))
            setTotalCount(prev => Math.max(0, prev - 1))
            addToast({ type: 'info', title: 'Eliminado', message: 'Precio eliminado correctamente' })
        } else {
            addToast({ type: 'error', title: 'Error', message: error.message })
        }
    }

    // Editar precio inline (precio_por_kg)
    async function guardarEdicion(id: string, precioKg: number) {
        const { error } = await supabase.from('productos_supermercado').update({
            precio_por_kg: precioKg,
            fecha_precio: new Date().toISOString().split('T')[0],
        }).eq('id', id)

        if (!error) {
            setPrecios(prev => prev.map(p => p.id === id ? { ...p, precio_por_kg: precioKg } : p))
            setEditandoId(null)
            addToast({ type: 'success', title: 'Actualizado', message: 'Precio actualizado' })
        } else {
            addToast({ type: 'error', title: 'Error', message: error.message })
        }
    }

    // Agrupar por categoría
    const preciosAgrupados = useMemo(() => {
        const grupos = new Map<string, PrecioActual[]>()
        for (const p of preciosFiltrados) {
            const cat = p.alimento_categoria || 'Otros'
            if (!grupos.has(cat)) grupos.set(cat, [])
            grupos.get(cat)!.push(p)
        }
        return Array.from(grupos.entries()).sort(([a], [b]) => a.localeCompare(b))
    }, [preciosFiltrados])

    if (cargando) {
        return (
            <div className="flex justify-center py-16">
                <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                        <Store size={20} className="inline mr-2" />
                        Gestión de Precios
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {totalCount.toLocaleString('es-ES')} precios registrados en {supermercados.length} supermercados
                    </p>
                </div>
                <button
                    onClick={() => setMostrarForm(true)}
                    className="btn-primary flex items-center gap-2 px-4 py-2"
                >
                    <Plus size={16} />
                    Añadir precio
                </button>
            </div>

            {/* Selector de supermercado */}
            <div className="flex flex-wrap gap-2">
                {supermercados.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setSupermercadoSel(s.id)}
                        className="text-sm px-4 py-2 rounded-full border transition-all font-medium"
                        style={{
                            backgroundColor: supermercadoSel === s.id ? (s.color ?? '#16A34A') : 'transparent',
                            color: supermercadoSel === s.id ? 'white' : 'var(--text-secondary)',
                            borderColor: supermercadoSel === s.id ? (s.color ?? '#16A34A') : 'var(--border)',
                        }}
                    >
                        {s.nombre}
                        <span className="ml-1.5 text-xs opacity-70">
                            ({totalCount.toLocaleString('es-ES')})
                        </span>
                    </button>
                ))}
            </div>

            {/* Buscador */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                    className="input pl-10 text-sm w-full"
                    placeholder="Buscar por nombre o categoría..."
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
                {busqueda && (
                    <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                        <X size={16} />
                    </button>
                )}
            </div>

            {/* Lista de precios agrupada */}
            {preciosAgrupados.length === 0 ? (
                <div className="text-center py-12">
                    <Euro size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Sin precios registrados</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {supermercadoSel
                            ? 'Este supermercado no tiene precios todavía. ¡Añade el primero!'
                            : 'Selecciona un supermercado para ver sus precios'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-4">
                        {preciosAgrupados.map(([categoria, items]) => (
                            <div key={categoria} className="card !p-0 overflow-hidden">
                                <div className="px-4 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg)' }}>
                                    <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                                        {categoria}
                                    </span>
                                    <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--primary-bg)', color: 'var(--primary)' }}>
                                        {items.length}
                                    </span>
                                </div>
                                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                    {items.map(precio => (
                                        <div key={precio.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                                    {precio.alimento_nombre}
                                                </p>
                                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    Actualizado: {new Date(precio.fecha_precio).toLocaleDateString('es-ES')}
                                                    {precio.url_producto && (
                                                        <a href={precio.url_producto} target="_blank" rel="noopener noreferrer"
                                                            className="ml-2 underline inline-flex items-center gap-0.5">
                                                            Ver producto <ExternalLink size={10} />
                                                        </a>
                                                    )}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 ml-3">
                                                {/* Precio editable */}
                                                {editandoId === precio.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            autoFocus
                                                            className="w-20 text-right text-sm rounded px-2 py-1 border"
                                                            value={editValor}
                                                            onChange={e => setEditValor(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') guardarEdicion(precio.id, parseFloat(editValor) || 0)
                                                                if (e.key === 'Escape') setEditandoId(null)
                                                            }}
                                                        />
                                                        <button onClick={() => guardarEdicion(precio.id, parseFloat(editValor) || 0)}
                                                            className="p-1 text-green-600 hover:bg-green-50 rounded">
                                                            <Check size={14} />
                                                        </button>
                                                        <button onClick={() => setEditandoId(null)}
                                                            className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setEditandoId(precio.id); setEditValor(precio.precio_por_kg.toString()) }}
                                                        className="text-sm font-bold px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                        style={{ color: '#16A34A' }}
                                                    >
                                                        {precio.precio_por_kg.toFixed(2)} €/kg
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => eliminarPrecio(precio.id)}
                                                    className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                                    style={{ color: 'var(--text-muted)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = '#EF4444' }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Paginación */}
                    {totalPaginas > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4 pb-2">
                            <button
                                onClick={() => setPagina(p => Math.max(0, p - 1))}
                                disabled={pagina === 0}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            >
                                Anterior
                            </button>

                            <span className="text-sm px-3" style={{ color: 'var(--text-muted)' }}>
                                Página {pagina + 1} de {totalPaginas}
                                <span className="ml-2">({totalCount.toLocaleString('es-ES')} total)</span>
                            </span>

                            <button
                                onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                                disabled={pagina >= totalPaginas - 1}
                                className="px-3 py-1.5 text-sm rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            >
                                Siguiente
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Modal: Añadir precio */}
            {mostrarForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setMostrarForm(false)}>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Añadir precio</h3>
                            <button onClick={() => setMostrarForm(false)} style={{ color: 'var(--text-muted)' }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Supermercado */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    Supermercado
                                </label>
                                <select
                                    className="input w-full text-sm"
                                    value={form.supermercado_id}
                                    onChange={e => setForm(f => ({ ...f, supermercado_id: e.target.value }))}
                                >
                                    <option value="">Seleccionar...</option>
                                    {supermercados.map(s => (
                                        <option key={s.id} value={s.id}>{s.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Alimento (buscador) */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    Alimento
                                </label>
                                <div className="relative">
                                    <input
                                        className="input w-full text-sm pl-9"
                                        placeholder="Buscar alimento..."
                                        value={queryAlimento}
                                        onChange={e => setQueryAlimento(e.target.value)}
                                    />
                                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                                </div>
                                {resultadosAlimentos.length > 0 && (
                                    <div className="mt-1 max-h-40 overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                                        {resultadosAlimentos.map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => {
                                                    setForm(f => ({ ...f, alimento_id: a.id }))
                                                    setQueryAlimento(a.nombre)
                                                    setResultadosAlimentos([])
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                                style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                                            >
                                                <span className="font-medium">{a.nombre}</span>
                                                <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{a.categoria}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Precio por kg */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    Precio por kg (€)
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    className="input w-full text-sm"
                                    placeholder="Ej: 5.99"
                                    value={form.precio_por_kg}
                                    onChange={e => setForm(f => ({ ...f, precio_por_kg: e.target.value }))}
                                />
                            </div>

                            {/* Precio por unidad (opcional) */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    Precio por unidad (€) <span className="font-normal lowercase" style={{ color: 'var(--text-muted)' }}>opcional</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="input w-full text-sm"
                                    placeholder="Ej: 2.50"
                                    value={form.precio_unidad}
                                    onChange={e => setForm(f => ({ ...f, precio_unidad: e.target.value }))}
                                />
                            </div>

                            {/* URL producto */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                                    URL del producto <span className="font-normal lowercase" style={{ color: 'var(--text-muted)' }}>opcional</span>
                                </label>
                                <input
                                    type="url"
                                    className="input w-full text-sm"
                                    placeholder="https://..."
                                    value={form.url_producto}
                                    onChange={e => setForm(f => ({ ...f, url_producto: e.target.value }))}
                                />
                            </div>

                            {/* Botones */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={guardarProducto}
                                    disabled={guardando}
                                    className="btn-primary flex-1 flex items-center justify-center gap-2 py-2.5"
                                >
                                    {guardando ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : (
                                        <Save size={16} />
                                    )}
                                    {guardando ? 'Guardando...' : 'Guardar precio'}
                                </button>
                                <button
                                    onClick={() => setMostrarForm(false)}
                                    className="btn-secondary px-4"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

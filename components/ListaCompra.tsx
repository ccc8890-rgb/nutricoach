'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ShoppingCart, Copy, Check, ChevronDown, ChevronUp,
    Store, TrendingDown, Euro, Info, Loader2, DollarSign,
    Eye, EyeOff
} from 'lucide-react'
import { generarListaCompra, type GrupoListaCompra } from '@/lib/utils'
import { obtenerSupermercados, calcularCostePlan } from '@/lib/precios-supermercado'
import type { Supermercado, CosteAlimento, CostePorReceta } from '@/types'

const CATEGORIA_EMOJIS: Record<string, string> = {
    'Verduras': '🥦',
    'Hortalizas': '🥬',
    'Frutas': '🍎',
    'Carnes': '🥩',
    'Pescados': '🐟',
    'Mariscos': '🦐',
    'Huevos': '🥚',
    'Lácteos': '🥛',
    'Lacteos': '🥛',
    'Legumbres': '🫘',
    'Cereales': '🌾',
    'Tubérculos': '🥔',
    'Frutos secos': '🥜',
    'Semillas': '🌰',
    'Aceites': '🫒',
    'Grasas': '🫒',
    'Especias': '🌶️',
    'Condimentos': '🧂',
    'Salsas': '🥫',
    'Bebidas': '🧃',
    'Infusiones': '🍵',
    'Suplementos': '💊',
    'Congelados': '❄️',
    'Conservas': '🥫',
    'Pan': '🍞',
    'Pastas': '🍝',
    'Arroces': '🍚',
    'Otros': '📦',
}

function emojiCategoria(cat: string): string {
    return CATEGORIA_EMOJIS[cat] ?? CATEGORIA_EMOJIS[cat.toLowerCase()] ?? '📦'
}

function formatearGramos(g: number): string {
    if (g >= 1000) return `${(g / 1000).toFixed(1)} kg`
    return `${Math.round(g)} g`
}

function formatearEuro(c: number): string {
    return `${c.toFixed(2)} €`
}

interface ListaCompraProps {
    comidas: {
        id?: string
        nombre?: string
        alimentos?: {
            id?: string
            alimento?: {
                id?: string
                nombre?: string
                categoria?: string
            }
            cantidad_gramos?: number
        }[]
    }[]
    nombrePlan?: string
}

export default function ListaCompra({ comidas, nombrePlan }: ListaCompraProps) {
    const [abierto, setAbierto] = useState(false)
    const [copiado, setCopiado] = useState(false)
    const [expandidas, setExpandidas] = useState<Record<string, boolean>>({})
    const [expandidaComida, setExpandidaComida] = useState<Record<string, boolean>>({})

    // ── Supermercados ──
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [supermercadoSel, setSupermercadoSel] = useState<string | null>(null)
    const [costes, setCostes] = useState<{
        precio_total: number
        alimentos: CosteAlimento[]
        coste_por_comida: CostePorReceta[]
    } | null>(null)
    const [cargandoPrecios, setCargandoPrecios] = useState(false)
    const [mostrarCostes, setMostrarCostes] = useState(false)

    // Cargar supermercados al montar
    useEffect(() => {
        obtenerSupermercados().then(s =>
            setSupermercados(s)
        )
    }, [])

    // Calcular costes al cambiar supermercado
    useEffect(() => {
        if (!supermercadoSel || !abierto) return
        setCargandoPrecios(true)
        calcularCostePlan(comidas, supermercadoSel)
            .then(c => {
                setCostes(c)
                setMostrarCostes(true)
            })
            .finally(() => setCargandoPrecios(false))
    }, [supermercadoSel, abierto, comidas])

    const gs = useMemo(() => generarListaCompra(comidas), [comidas])
    const totalItems = gs.reduce((sum, g) => sum + g.items.length, 0)

    const toggleCategoria = (cat: string) => {
        setExpandidas(prev => ({ ...prev, [cat]: !prev[cat] }))
    }

    const toggleComida = (id: string) => {
        setExpandidaComida(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const copiarLista = async () => {
        const lineas: string[] = [`🛒 LISTA DE LA COMPRA${nombrePlan ? ` — ${nombrePlan}` : ''}`]

        // Si hay costes, añadir supermercado y total
        if (costes && supermercadoSel) {
            const sup = supermercados.find(s => s.id === supermercadoSel)
            lineas.push(`📍 ${sup?.nombre ?? 'Supermercado'} — Total: ${formatearEuro(costes.precio_total)}`)
            lineas.push('')
        }

        for (const grupo of gs) {
            lineas.push(`\n${emojiCategoria(grupo.categoria)} ${grupo.categoria.toUpperCase()}`)
            for (const item of grupo.items) {
                let linea = `  • ${item.nombre} — ${formatearGramos(item.gramos_totales)}`
                // Añadir coste si está disponible
                if (costes) {
                    const costeAlimento = costes.alimentos.find(a => a.alimento_id === item.alimento_id)
                    if (costeAlimento && costeAlimento.precio_por_kg > 0) {
                        linea += ` — ${formatearEuro(costeAlimento.coste_total_euros)}`
                    }
                }
                lineas.push(linea)
            }
        }

        if (costes && costes.precio_total > 0) {
            lineas.push(`\n💰 TOTAL: ${formatearEuro(costes.precio_total)}`)
        }

        try {
            await navigator.clipboard.writeText(lineas.join('\n'))
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            // fallback silencioso
        }
    }

    // ── Mapa de costes por alimento_id ──
    const mapaCostes = useMemo(() => {
        const m = new Map<string, CosteAlimento>()
        if (costes) {
            for (const a of costes.alimentos) {
                m.set(a.alimento_id, a)
            }
        }
        return m
    }, [costes])

    const supermercadoSelData = useMemo(
        () => supermercados.find(s => s.id === supermercadoSel),
        [supermercadoSel, supermercados]
    )

    return (
        <div className="card overflow-hidden">
            {/* Header clickable */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                        <ShoppingCart size={20} style={{ color: '#16A34A' }} />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Lista de la compra</p>
                        <p className="text-xs text-gray-400">
                            {totalItems > 0
                                ? `${totalItems} producto${totalItems !== 1 ? 's' : ''} en ${gs.length} categoría${gs.length !== 1 ? 's' : ''}`
                                : 'Sin alimentos en el plan'}
                            {costes && supermercadoSel && costes.precio_total > 0 && (
                                <span className="ml-2 font-semibold" style={{ color: '#16A34A' }}>
                                    · {formatearEuro(costes.precio_total)}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {totalItems > 0 && (
                        <span className="badge badge-green text-xs font-semibold">{totalItems}</span>
                    )}
                    {abierto ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
            </button>

            {/* Contenido desplegable */}
            {abierto && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                    {gs.length === 0 ? (
                        <div className="p-8 text-center">
                            <ShoppingCart size={40} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
                            <p className="text-sm text-gray-400">No hay alimentos en el plan</p>
                            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Añade comidas con alimentos para generar la lista</p>
                        </div>
                    ) : (
                        <div className="p-4 space-y-4">
                            {/* ─── SELECTOR DE SUPERMERCADO ─── */}
                            {supermercados.length > 0 && (
                                <div className="rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                    <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700">
                                        <Store size={14} className="text-gray-400" />
                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Supermercado</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 p-3">
                                        {supermercados.map(s => {
                                            const selected = supermercadoSel === s.id
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => setSupermercadoSel(s.id)}
                                                    className="text-xs px-3 py-1.5 rounded-full border transition-all font-medium"
                                                    style={{
                                                        backgroundColor: selected ? (s.color ?? '#16A34A') : 'transparent',
                                                        color: selected ? 'white' : 'var(--text-secondary)',
                                                        borderColor: selected ? (s.color ?? '#16A34A') : 'var(--border)',
                                                    }}
                                                >
                                                    {s.nombre}
                                                    {selected && cargandoPrecios && (
                                                        <Loader2 size={10} className="inline ml-1 animate-spin" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                        {supermercadoSel && (
                                            <button
                                                onClick={() => { setSupermercadoSel(null); setCostes(null); setMostrarCostes(false) }}
                                                className="text-xs px-2 py-1.5 rounded-full border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300"
                                                title="Quitar selección"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* ─── RESUMEN DE COSTES ─── */}
                            {costes && supermercadoSel && mostrarCostes && (
                                <div
                                    className="rounded-xl overflow-hidden border"
                                    style={{
                                        borderColor: supermercadoSelData?.color ?? '#16A34A' + '30',
                                        backgroundColor: (supermercadoSelData?.color ?? '#16A34A') + '08',
                                    }}
                                >
                                    {/* Total general */}
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <DollarSign size={16} style={{ color: supermercadoSelData?.color ?? '#16A34A' }} />
                                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Total en {supermercadoSelData?.nombre}
                                            </span>
                                        </div>
                                        <span
                                            className="text-lg font-bold"
                                            style={{ color: supermercadoSelData?.color ?? '#16A34A' }}
                                        >
                                            {formatearEuro(costes.precio_total)}
                                        </span>
                                    </div>

                                    {/* Botón toggle detalle */}
                                    <button
                                        onClick={() => setExpandidaComida(prev => {
                                            const allExpanded = Object.values(prev).every(Boolean)
                                            const newState: Record<string, boolean> = {}
                                            if (!allExpanded) {
                                                comidas.forEach(c => { if (c.id) newState[c.id] = true })
                                            }
                                            return newState
                                        })}
                                        className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 border-t border-gray-100 dark:border-gray-700"
                                    >
                                        {Object.values(expandidaComida).some(Boolean) ? (
                                            <><EyeOff size={12} /> Ocultar desglose por comida</>
                                        ) : (
                                            <><Eye size={12} /> Ver desglose por comida</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* ─── DESGLOSE POR COMIDA (toggle) ─── */}
                            {costes && supermercadoSel && mostrarCostes && Object.values(expandidaComida).some(Boolean) && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
                                        🍽️ Desglose por comida
                                    </p>
                                    {costes.coste_por_comida.map((cc, idx) => {
                                        const expanded = expandidaComida[idx.toString()] ?? false
                                        return (
                                            <div key={idx} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                                <button
                                                    onClick={() => setExpandidaComida(prev => ({ ...prev, [idx.toString()]: !prev[idx.toString()] }))}
                                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                            {cc.comida_nombre}
                                                        </span>
                                                        <span
                                                            className="text-xs font-semibold"
                                                            style={{ color: supermercadoSelData?.color ?? '#16A34A' }}
                                                        >
                                                            {formatearEuro(cc.coste_total)}
                                                        </span>
                                                    </div>
                                                    {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                                                </button>
                                                {expanded && (
                                                    <div className="divide-y divide-gray-50 dark:divide-gray-800 px-4 pb-2">
                                                        {cc.alimentos.map((al, aIdx) => (
                                                            <div key={aIdx} className="flex items-center justify-between py-1.5 text-xs">
                                                                <span className="text-gray-600 dark:text-gray-400">{al.alimento_nombre}</span>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-gray-400">{formatearGramos(al.cantidad_gramos)}</span>
                                                                    {al.precio_por_kg > 0 && (
                                                                        <span className="font-medium" style={{ color: supermercadoSelData?.color ?? '#16A34A' }}>
                                                                            {formatearEuro(al.coste_euros)}
                                                                        </span>
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
                            )}

                            {/* Botón copiar */}
                            <div className="flex gap-2">
                                <button
                                    onClick={copiarLista}
                                    className="btn-secondary flex-1 flex items-center justify-center gap-2 py-2.5 text-sm"
                                >
                                    {copiado ? (
                                        <>
                                            <Check size={16} className="text-green-600" />
                                            <span className="text-green-600">¡Copiado!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} />
                                            <span>Copiar lista</span>
                                        </>
                                    )}
                                </button>

                                {supermercadoSel && costes && (
                                    <button
                                        onClick={() => setMostrarCostes(v => !v)}
                                        className={`btn-secondary flex items-center gap-1.5 py-2.5 px-3 text-sm ${mostrarCostes ? 'ring-2 ring-green-300' : ''}`}
                                        title={mostrarCostes ? 'Ocultar precios' : 'Mostrar precios'}
                                    >
                                        <Euro size={16} />
                                    </button>
                                )}
                            </div>

                            {/* Grupos por categoría */}
                            {gs.map(grupo => {
                                const expanded = expandidas[grupo.categoria] !== false
                                const costeCategoria = costes
                                    ? grupo.items.reduce((sum, item) => {
                                        const c = mapaCostes.get(item.alimento_id)
                                        return sum + (c?.coste_total_euros ?? 0)
                                    }, 0)
                                    : 0

                                return (
                                    <div key={grupo.categoria} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                                        <button
                                            onClick={() => toggleCategoria(grupo.categoria)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                            style={{ background: '#FAFAFA' }}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{emojiCategoria(grupo.categoria)}</span>
                                                <span className="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                                    {grupo.categoria}
                                                </span>
                                                <span className="badge badge-gray text-[10px] ml-1">{grupo.items.length}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {costes && mostrarCostes && costeCategoria > 0 && (
                                                    <span className="text-xs font-semibold" style={{ color: supermercadoSelData?.color ?? '#16A34A' }}>
                                                        {formatearEuro(costeCategoria)}
                                                    </span>
                                                )}
                                                {expanded ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                                            </div>
                                        </button>

                                        {expanded && (
                                            <div className="divide-y divide-gray-50 dark:divide-gray-800">
                                                {grupo.items.map(item => {
                                                    const costeAlimento = mapaCostes.get(item.alimento_id)
                                                    return (
                                                        <div key={item.alimento_id} className="flex items-center justify-between px-4 py-2.5">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
                                                                    onChange={e => {
                                                                        const label = e.target.closest('label')
                                                                        if (label) label.classList.toggle('line-through')
                                                                        if (label) label.classList.toggle('text-gray-400')
                                                                    }}
                                                                />
                                                                <label className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate cursor-pointer select-none flex-1">
                                                                    {item.nombre}
                                                                </label>
                                                            </div>
                                                            <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                                                                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                                                                    {formatearGramos(item.gramos_totales)}
                                                                </span>
                                                                {costes && mostrarCostes && costeAlimento && costeAlimento.precio_por_kg > 0 && (
                                                                    <>
                                                                        <span className="text-[10px] text-gray-400 hidden sm:inline">
                                                                            @ {formatearEuro(costeAlimento.precio_por_kg)}/kg
                                                                        </span>
                                                                        <span className="text-sm font-semibold" style={{ color: supermercadoSelData?.color ?? '#16A34A' }}>
                                                                            {formatearEuro(costeAlimento.coste_total_euros)}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}

                            {/* ─── COMPARATIVA RÁPIDA ─── */}
                            {supermercadoSel && costes && costes.precio_total > 0 && (
                                <ComparativaPrecios
                                    comidas={comidas}
                                    supermercadoActual={supermercadoSel}
                                    supermercados={supermercados}
                                    onSelect={setSupermercadoSel}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── SUBCOMPONENTE: Comparativa rápida de precios ──────────────
function ComparativaPrecios({
    comidas,
    supermercadoActual,
    supermercados,
    onSelect,
}: {
    comidas: ListaCompraProps['comidas']
    supermercadoActual: string
    supermercados: Supermercado[]
    onSelect: (id: string) => void
}) {
    const [totales, setTotales] = useState<{ id: string; nombre: string; total: number; color?: string }[]>([])
    const [cargando, setCargando] = useState(false)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (!visible) return
        setCargando(true)

        const calcularTodos = async () => {
            const resultados: { id: string; nombre: string; total: number; color?: string }[] = []
            for (const s of supermercados.slice(0, 6)) { // Solo primeros 6 para no sobrecargar
                const resultado = await calcularCostePlan(comidas, s.id)
                resultados.push({
                    id: s.id,
                    nombre: s.nombre,
                    total: resultado.precio_total,
                    color: s.color,
                })
            }
            setTotales(resultados.sort((a, b) => a.total - b.total))
            setCargando(false)
        }
        calcularTodos()
    }, [visible, comidas, supermercados])

    const actualSel = supermercados.find(s => s.id === supermercadoActual)

    return (
        <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            <button
                onClick={() => setVisible(!visible)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                style={{ background: '#FFFBEB' }}
            >
                <div className="flex items-center gap-2">
                    <TrendingDown size={15} className="text-amber-500" />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Comparativa de precios
                    </span>
                </div>
                {visible ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
            </button>

            {visible && (
                <div className="p-3 space-y-1.5">
                    {cargando ? (
                        <div className="flex items-center justify-center py-4 gap-2 text-sm text-gray-400">
                            <Loader2 size={14} className="animate-spin" />
                            Calculando precios...
                        </div>
                    ) : (
                        totales.map((s, i) => {
                            const esActual = s.id === supermercadoActual
                            const masBarato = i === 0
                            const ahorro = s.total - totales[0].total
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => onSelect(s.id)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${esActual ? 'ring-2 ring-offset-1' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                                        }`}
                                    style={esActual ? { boxShadow: `0 0 0 2px ${s.color ?? '#16A34A'}`, borderColor: s.color ?? '#16A34A' } : {}}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`w-2 h-2 rounded-full ${masBarato ? '' : ''}`}
                                            style={{ backgroundColor: s.color ?? '#9CA3AF' }}
                                        />
                                        <span className={`font-medium ${esActual ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
                                            {s.nombre}
                                            {esActual && <span className="ml-1.5 text-[10px] text-gray-400">(seleccionado)</span>}
                                        </span>
                                        {masBarato && (
                                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">
                                                Más barato
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className={`font-bold ${masBarato ? 'text-green-600' : esActual ? 'text-gray-800 dark:text-gray-200' : 'text-gray-500'}`}
                                        >
                                            {formatearEuro(s.total)}
                                        </span>
                                        {!esActual && ahorro > 0 && (
                                            <span className="text-[10px] text-green-600 font-medium">
                                                -{formatearEuro(ahorro)}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            )
                        })
                    )}
                    <p className="text-[10px] text-gray-400 text-center pt-1">
                        Precios calculados con datos disponibles · Los precios reales pueden variar
                    </p>
                </div>
            )}
        </div>
    )
}

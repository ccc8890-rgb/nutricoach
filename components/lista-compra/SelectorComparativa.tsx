// components/lista-compra/SelectorComparativa.tsx
'use client'

import { useState, useMemo } from 'react'
import { Store, TrendingDown, TrendingUp, Loader2, Check, Sparkles, ShoppingBag, MessageCircle, Zap, Percent, Award, ExternalLink } from 'lucide-react'
import type { IngredienteSemanal, PrecioOpcion } from '@/types'
import {
    calcularOptimizacionMultiSuper,
    detectarOfertas,
    construirMensajeWhatsApp,
    calcularProyeccionAnual,
    type OfertaDetectada,
} from '@/lib/precios-smart-cart'

function formatearEuro(n: number) {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(n)
}

interface Props {
    ingredientes: IngredienteSemanal[]
    onAplicarSupermercado: (supermercadoId: string) => void
    /** Supermercado actualmente más usado (basado en selecciones) */
    supermercadoActual?: string
    /** Indica si se está aplicando una selección masiva */
    aplicando?: boolean
    /** Nombre del plan para WhatsApp */
    nombrePlan?: string
}

interface SuperResumen {
    id: string
    nombre: string
    color: string
    coste: number
    numAlimentos: number
    numSeleccionados: number
}

type TabMode = 'comparativa' | 'smart-cart'

export default function SelectorComparativa({
    ingredientes,
    onAplicarSupermercado,
    supermercadoActual,
    aplicando = false,
    nombrePlan,
}: Props) {
    const [expandido, setExpandido] = useState(true)
    const [tab, setTab] = useState<TabMode>('smart-cart')
    const [whatsAppCopied, setWhatsAppCopied] = useState(false)

    // ── Cálculos existentes (comparativa simple) ──────────
    const supermercados = useMemo(() => {
        const mapa = new Map<string, SuperResumen>()

        for (const ing of ingredientes) {
            if (ing.precios.length === 0) continue
            for (const p of ing.precios) {
                const existente = mapa.get(p.supermercado_id)
                const coste = (ing.cantidad_gramos_total / 1000) * p.precio_por_kg
                const yaSeleccionado = ing.seleccion?.supermercado_id === p.supermercado_id

                if (existente) {
                    mapa.set(p.supermercado_id, {
                        ...existente,
                        coste: existente.coste + coste,
                        numAlimentos: existente.numAlimentos + (coste > 0 ? 1 : 0),
                        numSeleccionados: existente.numSeleccionados + (yaSeleccionado ? 1 : 0),
                    })
                } else {
                    mapa.set(p.supermercado_id, {
                        id: p.supermercado_id,
                        nombre: p.supermercado_nombre,
                        color: p.supermercado_color || '#6b7280',
                        coste,
                        numAlimentos: coste > 0 ? 1 : 0,
                        numSeleccionados: yaSeleccionado ? 1 : 0,
                    })
                }
            }
        }

        return Array.from(mapa.values())
            .sort((a, b) => a.coste - b.coste)
    }, [ingredientes])

    const masBarato = supermercados[0]
    const masCaro = supermercados[supermercados.length - 1]
    const ahorroPotencial = masCaro
        ? masCaro.coste - (masBarato?.coste ?? 0)
        : 0
    const sinPrecio = ingredientes.filter(i => i.precios.length === 0).length

    // ── Smart Cart (optimización multi-super) ────────────
    const optimizacion = useMemo(() => {
        if (ingredientes.length === 0) return null
        return calcularOptimizacionMultiSuper(ingredientes)
    }, [ingredientes])

    const ofertas = useMemo(() => {
        if (ingredientes.length === 0) return []
        return detectarOfertas(ingredientes)
    }, [ingredientes])

    const proyeccion = useMemo(() => {
        if (!optimizacion || supermercados.length === 0) return null
        const costeActual = masBarato?.coste ?? optimizacion.coste_total_multi_super
        return calcularProyeccionAnual(costeActual, optimizacion.coste_total_multi_super)
    }, [optimizacion, supermercados, masBarato])

    const whatsApp = useMemo(() => {
        if (!optimizacion) return null
        return construirMensajeWhatsApp(ingredientes, optimizacion, nombrePlan)
    }, [ingredientes, optimizacion, nombrePlan])

    const handleCopiarWhatsApp = async () => {
        if (!whatsApp) return
        try {
            await navigator.clipboard.writeText(whatsApp.texto)
            setWhatsAppCopied(true)
            setTimeout(() => setWhatsAppCopied(false), 2500)
        } catch { /* fallback */ }
    }

    // Si no hay nada que mostrar
    if (supermercados.length === 0 && sinPrecio === 0) {
        return null
    }

    return (
        <div className="rounded-xl border overflow-hidden" style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
        }}>
            {/* Header */}
            <button
                onClick={() => setExpandido(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/5"
            >
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                        🛒 Smart Cart
                    </span>
                    {optimizacion && optimizacion.ahorro_vs_mejor_super > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded-full">
                            Ahorro {formatearEuro(optimizacion.ahorro_vs_mejor_super)}
                        </span>
                    )}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {expandido ? '▲' : '▼'}
                </span>
            </button>

            {expandido && (
                <div className="px-4 pb-4 space-y-3">
                    {/* Tabs */}
                    {supermercados.length > 0 && (
                        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--surface)' }}>
                            <button
                                onClick={() => setTab('smart-cart')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-all ${tab === 'smart-cart'
                                        ? 'bg-white dark:bg-neutral-700 shadow-sm'
                                        : 'opacity-60 hover:opacity-90'
                                    }`}
                                style={{ color: tab === 'smart-cart' ? 'var(--text)' : 'var(--text-muted)' }}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Smart Cart
                            </button>
                            <button
                                onClick={() => setTab('comparativa')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-all ${tab === 'comparativa'
                                        ? 'bg-white dark:bg-neutral-700 shadow-sm'
                                        : 'opacity-60 hover:opacity-90'
                                    }`}
                                style={{ color: tab === 'comparativa' ? 'var(--text)' : 'var(--text-muted)' }}
                            >
                                <Store className="w-3.5 h-3.5" />
                                Comparativa
                            </button>
                        </div>
                    )}

                    {/* ── TAB: SMART CART ────────────────────── */}
                    {tab === 'smart-cart' && optimizacion && (
                        <div className="space-y-3">
                            {/* Banner de ahorro principal */}
                            <div
                                className="rounded-xl p-3 relative overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, #0d9488, #14b8a6)',
                                }}
                            >
                                {/* Efecto sutil de fondo */}
                                <div className="absolute inset-0 opacity-10">
                                    <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white" />
                                    <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-white" />
                                </div>
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShoppingBag className="w-4 h-4 text-white/90" />
                                        <span className="text-[11px] font-semibold text-white/80 uppercase tracking-wider">
                                            Cesta optimizada
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-2xl font-bold text-white">
                                            {formatearEuro(optimizacion.coste_total_multi_super)}
                                        </span>
                                        <span className="text-xs text-white/70">/ semana</span>
                                    </div>
                                    {optimizacion.ahorro_vs_mejor_super > 0 && (
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <TrendingDown className="w-3.5 h-3.5 text-emerald-200" />
                                            <span className="text-xs text-emerald-100">
                                                {formatearEuro(optimizacion.ahorro_vs_mejor_super)} extra vs {optimizacion.mejor_super_nombre}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Proyección ahorro anual */}
                            {proyeccion && proyeccion.ahorro_semanal > 0 && (
                                <div className="rounded-xl p-3 border border-emerald-200 dark:border-emerald-800" style={{
                                    background: 'var(--surface)',
                                }}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <Award className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                            Proyección de ahorro
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatearEuro(proyeccion.ahorro_mensual)}
                                            </p>
                                            <p className="text-[10px] text-neutral-500">/ mes</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                {formatearEuro(proyeccion.ahorro_anual)}
                                            </p>
                                            <p className="text-[10px] text-neutral-500">/ año</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                -{proyeccion.ahorro_pct}%
                                            </p>
                                            <p className="text-[10px] text-neutral-500"> respecto al super actual</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ofertas detectadas */}
                            {ofertas.length > 0 && (
                                <div className="rounded-xl p-3 space-y-2" style={{
                                    background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
                                }}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <Percent className="w-4 h-4 text-orange-600" />
                                            <span className="text-xs font-semibold text-orange-800">
                                                {ofertas.length} oferta{ofertas.length !== 1 ? 's' : ''} detectada{ofertas.length !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-orange-600 font-medium">
                                            ⚡ precio bajo
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {ofertas.slice(0, 5).map(of => (
                                            <div key={`${of.alimento_id}-${of.supermercado_id}`} className="flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${of.es_ganga ? 'bg-red-500' : 'bg-orange-400'}`} />
                                                    <span className="truncate" style={{ color: 'var(--text)' }}>
                                                        {of.alimento_nombre}
                                                    </span>
                                                    <span className="text-neutral-500 shrink-0">
                                                        en {of.supermercado_nombre}
                                                    </span>
                                                </div>
                                                <span className={`font-semibold shrink-0 ml-2 ${of.es_ganga ? 'text-red-600' : 'text-orange-600'}`}>
                                                    {of.ahorro_pct}%
                                                </span>
                                            </div>
                                        ))}
                                        {ofertas.length > 5 && (
                                            <p className="text-[10px] text-center pt-1 text-neutral-500">
                                                +{ofertas.length - 5} ofertas más
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Asignaciones por supermercado */}
                            <div className="space-y-1.5">
                                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                    Distribución inteligente
                                </p>
                                {optimizacion.resumen_por_super.map(sm => (
                                    <div
                                        key={sm.supermercado_id}
                                        className="flex items-center justify-between py-2 px-3 rounded-xl"
                                        style={{ background: 'var(--surface)' }}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/5"
                                                style={{ background: sm.supermercado_color || '#6b7280' }}
                                            />
                                            <div className="min-w-0">
                                                <span className="text-sm font-medium truncate block" style={{ color: 'var(--text)' }}>
                                                    {sm.supermercado_nombre}
                                                </span>
                                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                    {sm.num_ingredientes} alimento{sm.num_ingredientes !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-bold tabular-nums shrink-0 ml-2" style={{ color: 'var(--text)' }}>
                                            {formatearEuro(sm.coste)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Botones de acción */}
                            <div className="flex gap-2">
                                {/* WhatsApp */}
                                {whatsApp && (
                                    <>
                                        <a
                                            href={whatsApp.deepLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150 hover:opacity-90"
                                            style={{
                                                background: '#25D366',
                                                color: 'white',
                                            }}
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                            WhatsApp
                                        </a>
                                        <button
                                            onClick={handleCopiarWhatsApp}
                                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-150"
                                            style={{
                                                background: 'var(--surface)',
                                                color: 'var(--text)',
                                            }}
                                        >
                                            {whatsAppCopied ? (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <ExternalLink className="w-4 h-4" />
                                            )}
                                            {whatsAppCopied ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </>
                                )}
                            </div>

                            {/* Aviso sin precio */}
                            {sinPrecio > 0 && (
                                <p className="text-xs py-1 text-center" style={{ color: 'var(--muted-foreground)' }}>
                                    {sinPrecio} alimento{sinPrecio !== 1 ? 's' : ''} sin precio disponible
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── TAB: COMPARATIVA (existente) ──────── */}
                    {tab === 'comparativa' && (
                        <>
                            {supermercados.length === 0 && sinPrecio > 0 && (
                                <p className="text-xs py-2 text-center" style={{ color: 'var(--muted-foreground)' }}>
                                    {sinPrecio} alimento{sinPrecio !== 1 ? 's' : ''} sin precio disponible.
                                    Haz scraping o añade precios manualmente.
                                </p>
                            )}

                            {supermercados.length > 0 && (
                                <>
                                    {/* Tarjetas de supermercados */}
                                    <div className="space-y-1.5">
                                        {supermercados.map((sm, idx) => {
                                            const esMejor = idx === 0
                                            const diff = esMejor ? 0 : sm.coste - masBarato.coste
                                            const pct = masBarato.coste > 0
                                                ? ((sm.coste - masBarato.coste) / masBarato.coste) * 100
                                                : 0
                                            const esActual = supermercadoActual === sm.id

                                            return (
                                                <button
                                                    key={sm.id}
                                                    onClick={() => onAplicarSupermercado(sm.id)}
                                                    disabled={aplicando}
                                                    className={`
                                                        w-full flex items-center justify-between py-2.5 px-3 rounded-xl
                                                        transition-all duration-150 text-left
                                                        ${esMejor
                                                            ? 'bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800'
                                                            : 'bg-transparent border border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                                                        }
                                                        ${aplicando ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}
                                                    `}
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div
                                                            className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/5"
                                                            style={{ background: sm.color }}
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`text-sm font-medium truncate ${esMejor
                                                                    ? 'text-emerald-800 dark:text-emerald-200'
                                                                    : ''
                                                                    }`}>
                                                                    {sm.nombre}
                                                                </span>
                                                                {esMejor && (
                                                                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded-full">
                                                                        MÁS BARATO
                                                                    </span>
                                                                )}
                                                                {idx === supermercados.length - 1 && supermercados.length > 1 && (
                                                                    <span className="text-[10px] font-medium text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                                                                        MÁS CARO
                                                                    </span>
                                                                )}
                                                                {esActual && !esMejor && (
                                                                    <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded-full">
                                                                        actual
                                                                    </span>
                                                                )}
                                                                {esActual && esMejor && (
                                                                    <span className="text-[10px] text-emerald-600 bg-emerald-100 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded-full">
                                                                        ✓ actual
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                                    {sm.numAlimentos} alimento{sm.numAlimentos !== 1 ? 's' : ''}
                                                                </span>
                                                                {diff > 0 && (
                                                                    <span className="text-xs text-red-500 flex items-center gap-0.5">
                                                                        <TrendingUp className="w-3 h-3" />
                                                                        +{pct.toFixed(1)}%
                                                                    </span>
                                                                )}
                                                                {esMejor && masBarato && masCaro && idx !== supermercados.length - 1 && (
                                                                    <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                                                                        <TrendingDown className="w-3 h-3" />
                                                                        ahorro potencial
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                                        <span className={`text-sm font-bold tabular-nums ${esMejor
                                                            ? 'text-emerald-700 dark:text-emerald-300'
                                                            : ''
                                                            }`}>
                                                            {formatearEuro(sm.coste)}
                                                        </span>
                                                        {esMejor && (
                                                            <Sparkles className="w-4 h-4 text-emerald-500" />
                                                        )}
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Resumen de ahorro potencial */}
                                    {ahorroPotencial > 0 && masBarato && (
                                        <div
                                            className="rounded-xl p-3 flex items-center gap-3"
                                            style={{
                                                background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
                                            }}
                                        >
                                            <div
                                                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                                                style={{ background: 'rgba(16,185,129,0.2)' }}
                                            >
                                                <TrendingDown className="w-5 h-5 text-emerald-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-emerald-800">
                                                    Ahorro potencial: {formatearEuro(ahorroPotencial)}
                                                </p>
                                                <p className="text-xs text-emerald-600 mt-0.5">
                                                    Comprando todo en {masBarato.nombre} en lugar de {masCaro?.nombre ?? 'el más caro'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Botón de aplicar */}
                                    {masBarato && (
                                        <button
                                            onClick={() => onAplicarSupermercado(masBarato.id)}
                                            disabled={aplicando}
                                            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-150"
                                            style={{
                                                background: 'var(--accent)',
                                                color: '#1C1C1E',
                                                opacity: aplicando ? 0.6 : 1,
                                            }}
                                        >
                                            {aplicando ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                            {aplicando
                                                ? 'Aplicando selección más barata...'
                                                : `Seleccionar ${masBarato.nombre} para todos los alimentos`
                                            }
                                        </button>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

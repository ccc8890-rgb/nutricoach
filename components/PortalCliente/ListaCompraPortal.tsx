'use client'

import { useEffect, useState } from 'react'
import { CaretDown, CaretUp, Check, CircleNotch, PaperPlaneTilt, Storefront, Tag, TrendDown } from '@phosphor-icons/react'
import type { ItemListaCompra } from '@/app/api/cliente/[codigo]/lista-compra/route'
import type { ResultadoOptimizacion } from '@/types'
import type { OfertaDetectada, MensajeWhatsApp, ProyeccionAhorroAnual } from '@/lib/precios-smart-cart'
import type { SustitutoEconomico } from '@/lib/lista-compra/inteligente'

interface ListaCompraPortalProps {
    codigo: string
    diaInicial?: string
}

const CATEGORIA_ABBR: Record<string, string> = {
    'Carnes': 'CA',
    'Pescados': 'PE',
    'Lácteos': 'LA',
    'Lacteos': 'LA',
    'Huevos': 'HU',
    'Verduras': 'VE',
    'Hortalizas': 'HO',
    'Cereales': 'CE',
    'Condimentos': 'CO',
    'Carnes y aves': 'CA',
    'Pescados y mariscos': 'PM',
    'Lácteos y huevos': 'LH',
    'Frutas': 'FR',
    'Verduras y hortalizas': 'VH',
    'Legumbres': 'LG',
    'Cereales y harinas': 'CH',
    'Aceites y grasas': 'AG',
    'Frutos secos': 'FS',
    'Condimentos y salsas': 'CS',
    'Bebidas': 'BE',
    'Otros': 'OT',
}

function categoriaAbbr(categoria: string) {
    if (CATEGORIA_ABBR[categoria]) return CATEGORIA_ABBR[categoria]
    const words = categoria
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['con', 'para', 'los', 'las'].includes(w.toLowerCase()))
    return (words.length >= 2 ? `${words[0][0]}${words[1][0]}` : categoria.slice(0, 2)).toUpperCase()
}
const DIAS_COMPRA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

function formatGramos(g: number): string {
    if (g >= 1000) return `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1)} kg`
    return `${Math.round(g)} g`
}

function formatEuro(valor: number): string {
    return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
    }).format(valor)
}

interface ListaCompraResponse {
    items: ItemListaCompra[]
    optimizacion: ResultadoOptimizacion | null
    ofertas: OfertaDetectada[]
    sustitutos_economicos: SustitutoEconomico[]
    proyeccion_ahorro: ProyeccionAhorroAnual | null
    whatsapp: MensajeWhatsApp | null
    coste_total: number
    coste_diario_estimado: number
}

export default function ListaCompraPortal({ codigo, diaInicial }: ListaCompraPortalProps) {
    const [items, setItems] = useState<ItemListaCompra[]>([])
    const [data, setData] = useState<ListaCompraResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [marcados, setMarcados] = useState<Set<string>>(new Set())
    const [colapsadas, setColapsadas] = useState<Set<string>>(new Set())
    const [dia, setDia] = useState<string>(diaInicial ?? 'Semana')
    const storageKey = `nutricoach:lista-compra:${codigo}:${dia}`

    useEffect(() => {
        setLoading(true)
        setError(false)
        const params = dia === 'Semana' ? '' : `?dia=${encodeURIComponent(dia)}`
        fetch(`/api/cliente/${codigo}/lista-compra${params}`)
            .then(r => r.json())
            .then((res: ListaCompraResponse) => {
                setData(res)
                setItems(res.items ?? [])
                try {
                    const raw = localStorage.getItem(storageKey)
                    setMarcados(new Set(raw ? JSON.parse(raw) as string[] : []))
                } catch {
                    setMarcados(new Set())
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false))
    }, [codigo, dia, storageKey])

    useEffect(() => {
        if (loading) return
        localStorage.setItem(storageKey, JSON.stringify(Array.from(marcados)))
    }, [loading, marcados, storageKey])

    const selector = (
        <div className="shopping-list-editorial__days flex gap-1.5 overflow-x-auto pb-1">
            {['Semana', ...DIAS_COMPRA].map(d => (
                <button
                    key={d}
                    onClick={() => setDia(d)}
                    className="shopping-list-editorial__day shrink-0 px-3 py-1.5 text-xs font-semibold"
                    style={{
                        background: dia === d ? 'var(--diet-warm)' : 'var(--diet-paper)',
                        color: dia === d ? 'var(--atelier-carbon)' : 'var(--text-muted)',
                        border: `1px solid ${dia === d ? 'var(--diet-warm)' : 'var(--diet-rule)'}`,
                    }}
                >
                    {d === 'Semana' ? 'Semana' : d.slice(0, 3)}
                </button>
            ))}
        </div>
    )

    if (loading) return (
        <div>
            {selector}
            <div className="flex items-center justify-center py-8">
                <CircleNotch size={20} className="animate-spin" style={{ color: 'var(--diet-warm)' }} />
            </div>
        </div>
    )

    if (error) return (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            {selector}
            No se pudo cargar la lista. Inténtalo de nuevo.
        </div>
    )

    if (!items.length) return (
        <div>
            {selector}
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay ingredientes para esta vista.
            </div>
        </div>
    )

    // Agrupar por categoría
    const porCategoria = items.reduce<Record<string, ItemListaCompra[]>>((acc, item) => {
        const cat = item.categoria
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
    }, {})

    const totalItems = items.length
    const totalMarcados = marcados.size
    const optimizacion = data?.optimizacion
    const ahorro = optimizacion?.ahorro_vs_peor_super ?? data?.proyeccion_ahorro?.ahorro_semanal ?? 0

    function toggleMarcado(id: string) {
        setMarcados(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    function toggleCategoria(cat: string) {
        setColapsadas(prev => {
            const next = new Set(prev)
            if (next.has(cat)) {
                next.delete(cat)
            } else {
                next.add(cat)
            }
            return next
        })
    }

    return (
        <div className="shopping-list-editorial space-y-2">
            {selector}
            {optimizacion && (
                <section className="shopping-list-editorial__overview" aria-label="Resumen de compra">
                    <div className="shopping-list-editorial__metrics">
                        <div className="shopping-list-editorial__metric">
                            <p>Cesta</p>
                            <strong>
                                {formatEuro(optimizacion.coste_total_multi_super)}
                            </strong>
                        </div>
                        <div className="shopping-list-editorial__metric">
                            <p>Ahorro</p>
                            <strong className="shopping-list-editorial__accent">
                                {formatEuro(Math.max(0, ahorro))}
                            </strong>
                        </div>
                        <div className="shopping-list-editorial__metric">
                            <p>Ofertas</p>
                            <strong>
                                {data?.ofertas?.length ?? 0}
                            </strong>
                        </div>
                    </div>

                    <div className="shopping-list-editorial__routes">
                        {data?.whatsapp?.deepLink && (
                            <a
                                href={data.whatsapp.deepLink}
                                target="_blank"
                                rel="noreferrer"
                                className="shopping-list-editorial__share"
                            >
                                <PaperPlaneTilt size={14} weight="regular" />
                                <span>Enviar lista</span>
                                <small>WhatsApp</small>
                            </a>
                        )}
                        {optimizacion.resumen_por_super.slice(0, 2).map(supermercado => (
                            <div
                                key={supermercado.supermercado_id}
                                className="shopping-list-editorial__store"
                            >
                                <Storefront size={14} weight="regular" />
                                <span>{supermercado.supermercado_nombre}</span>
                                <strong>{formatEuro(supermercado.coste)}</strong>
                            </div>
                        ))}
                    </div>

                    {!!data?.sustitutos_economicos?.length && (
                        <div className="shopping-list-editorial__savings">
                            <p>
                                <TrendDown size={13} weight="regular" />
                                Ahorros destacados
                            </p>
                            {data.sustitutos_economicos.slice(0, 2).map(item => (
                                <p key={item.alimento_id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    {item.alimento_nombre}: {formatEuro(item.ahorro_euros)} en {item.supermercado_recomendado}
                                </p>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* Progreso */}
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>{totalItems} ingredientes · {Object.keys(porCategoria).length} categorías</span>
                {totalMarcados > 0 && (
                    <span className="shopping-list-editorial__accent font-medium">
                        {totalMarcados}/{totalItems} en el carro
                    </span>
                )}
            </div>
            {totalMarcados > 0 && (
                <div className="shopping-list-editorial__progress">
                    <div
                        className="shopping-list-editorial__progress-fill transition-all duration-300"
                        style={{ width: `${(totalMarcados / totalItems) * 100}%` }}
                    />
                </div>
            )}

            {/* Lista por categoría */}
            {Object.entries(porCategoria).map(([cat, catItems]) => {
                const colapsar = colapsadas.has(cat)
                const abbr = categoriaAbbr(cat)
                const todosMarcados = catItems.every(i => marcados.has(i.alimento_id))

                return (
                    <div key={cat} className="shopping-list-editorial__category overflow-hidden">
                        {/* Cabecera categoría */}
                        <button
                            onClick={() => toggleCategoria(cat)}
                            className="shopping-list-editorial__category-toggle w-full flex items-center justify-between text-left transition-colors"
                            style={{ background: todosMarcados ? 'var(--bg)' : 'var(--surface)' }}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="shopping-list-editorial__abbr inline-flex h-6 w-6 items-center justify-center text-[10px] font-bold"
                                    style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                >
                                    {abbr}
                                </span>
                                <span
                                    className="text-sm font-semibold"
                                    style={{ color: todosMarcados ? 'var(--text-muted)' : 'var(--text)', textDecoration: todosMarcados ? 'line-through' : 'none' }}
                                >
                                    {cat}
                                </span>
                                <span className="shopping-list-editorial__count text-xs px-1.5 py-0.5" style={{ color: 'var(--text-muted)' }}>
                                    {catItems.length}
                                </span>
                            </div>
                            {colapsar ? <CaretDown size={14} style={{ color: 'var(--text-muted)' }} /> : <CaretUp size={14} style={{ color: 'var(--text-muted)' }} />}
                        </button>

                        {/* Items */}
                        {!colapsar && (
                            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                                {catItems.map(item => {
                                    const checked = marcados.has(item.alimento_id)
                                    return (
                                        <button
                                            key={item.alimento_id}
                                            onClick={() => toggleMarcado(item.alimento_id)}
                                            className="shopping-list-editorial__item w-full flex items-center gap-3 text-left transition-colors"
                                            style={{ background: checked ? 'var(--bg)' : 'var(--surface)' }}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className="shopping-list-editorial__check w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all"
                                                style={{
                                                    borderColor: checked ? 'var(--diet-warm)' : 'var(--diet-rule)',
                                                    background: checked ? 'var(--diet-warm)' : 'transparent',
                                                }}
                                            >
                                                {checked && <Check size={11} color="var(--atelier-carbon)" weight="bold" />}
                                            </div>

                                            {/* Nombre + comidas */}
                                            <div className="flex-1 min-w-0">
                                                <p
                                                    className="text-sm font-medium"
                                                    style={{
                                                        color: checked ? 'var(--text-muted)' : 'var(--text)',
                                                        textDecoration: checked ? 'line-through' : 'none',
                                                    }}
                                                >
                                                    {item.nombre}
                                                </p>
                                                {item.comidas_origen.length > 0 && (
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                                                        {item.comidas_origen.join(' · ')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Cantidad */}
                                            <span
                                                className="text-xs font-semibold flex-shrink-0 inline-flex items-center gap-1"
                                                style={{ color: checked ? 'var(--text-muted)' : 'var(--diet-warm-muted, var(--text-secondary))' }}
                                            >
                                                {item.cantidad_compra ?? formatGramos(item.cantidad_gramos)}
                                                {data?.ofertas?.some(o => o.alimento_id === item.alimento_id) && <Tag size={11} />}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}

            {/* Limpiar marcados */}
            {totalMarcados > 0 && (
                <button
                    className="shopping-list-editorial__clear w-full text-xs py-2 transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => {
                        setMarcados(new Set())
                        localStorage.removeItem(storageKey)
                    }}
                >
                    Limpiar selección
                </button>
            )}
        </div>
    )
}

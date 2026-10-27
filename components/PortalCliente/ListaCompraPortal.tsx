'use client'

import { useEffect, useState } from 'react'
import { CaretDown, CaretUp, Check, CircleNotch, PaperPlaneTilt, Tag } from '@/components/icons/portal-phosphor'
import type { ItemListaCompra } from '@/app/api/cliente/[codigo]/lista-compra/route'
import type { ResultadoOptimizacion } from '@/types'
import type { OfertaDetectada, ProyeccionAhorroAnual } from '@/lib/precios-smart-cart'
import type { SustitutoEconomico } from '@/lib/lista-compra/inteligente'
import { ingredientesDePlatos, type PlatoCompra } from '@/lib/lista-compra/por-platos'

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

interface FilaLista {
    id: string
    nombre: string
    categoria: string
    cantidad: string
    origen: string[]
    oferta: boolean
}

interface ListaCompraResponse {
    items: ItemListaCompra[]
    platos?: PlatoCompra[]
    optimizacion: ResultadoOptimizacion | null
    ofertas: OfertaDetectada[]
    sustitutos_economicos: SustitutoEconomico[]
    proyeccion_ahorro: ProyeccionAhorroAnual | null
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
    const [vista, setVista] = useState<'ingredientes' | 'platos'>('ingredientes')
    const [platosElegidos, setPlatosElegidos] = useState<Set<string>>(new Set())
    const [marcadosPlatos, setMarcadosPlatos] = useState<Set<string>>(new Set())
    const storageKey = `nutricoach:lista-compra:${codigo}:${dia}`
    const storageKeyPlatos = `${storageKey}:platos`

    useEffect(() => {
        if (diaInicial) setDia(diaInicial)
    }, [diaInicial])

    useEffect(() => {
        setLoading(true)
        setError(false)
        const params = dia === 'Semana' ? '' : `?dia=${encodeURIComponent(dia)}`
        fetch(`/api/cliente/${codigo}/lista-compra${params}`)
            .then(r => r.json())
            .then((res: ListaCompraResponse) => {
                setData(res)
                setItems(res.items ?? [])
                setPlatosElegidos(new Set())
                try {
                    const raw = localStorage.getItem(storageKey)
                    setMarcados(new Set(raw ? JSON.parse(raw) as string[] : []))
                    const rawPlatos = localStorage.getItem(storageKeyPlatos)
                    setMarcadosPlatos(new Set(rawPlatos ? JSON.parse(rawPlatos) as string[] : []))
                } catch {
                    setMarcados(new Set())
                    setMarcadosPlatos(new Set())
                }
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false))
    }, [codigo, dia, storageKey, storageKeyPlatos])

    useEffect(() => {
        if (loading) return
        localStorage.setItem(storageKey, JSON.stringify(Array.from(marcados)))
    }, [loading, marcados, storageKey])

    useEffect(() => {
        if (loading) return
        localStorage.setItem(storageKeyPlatos, JSON.stringify(Array.from(marcadosPlatos)))
    }, [loading, marcadosPlatos, storageKeyPlatos])

    const hoyNombre = DIAS_COMPRA[(new Date().getDay() + 6) % 7]
    const tituloDia = dia === 'Semana' ? 'Semana completa' : `${dia}${dia === hoyNombre ? ' · hoy' : ''}`

    const selector = (
        <div className="space-y-2">
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Lista de la compra para
                </p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{tituloDia}</p>
            </div>
            <div className="shopping-list-editorial__days space-y-1.5">
                        <button
                            onClick={() => setDia('Semana')}
                            aria-pressed={dia === 'Semana'}
                            className="shopping-list-editorial__day w-full px-3 py-1.5 text-xs font-semibold"
                            style={{
                                background: dia === 'Semana' ? 'var(--diet-warm)' : 'var(--diet-paper)',
                                color: dia === 'Semana' ? 'var(--atelier-carbon)' : 'var(--text-secondary)',
                                border: `1px solid ${dia === 'Semana' ? 'var(--diet-warm)' : 'var(--diet-rule)'}`,
                            }}
                        >
                            Semana completa
                        </button>
                        <div className="grid grid-cols-7 gap-1">
                            {DIAS_COMPRA.map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDia(d)}
                                    aria-pressed={dia === d}
                                    className="shopping-list-editorial__day inline-flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs font-semibold"
                                    style={{
                                        background: dia === d ? 'var(--diet-warm)' : 'var(--diet-paper)',
                                        color: dia === d ? 'var(--atelier-carbon)' : 'var(--text-secondary)',
                                        border: `1px solid ${dia === d ? 'var(--diet-warm)' : 'var(--diet-rule)'}`,
                                    }}
                                >
                                    {d.slice(0, 3)}
                                    <span
                                        aria-label={d === hoyNombre ? 'hoy' : undefined}
                                        style={{ width: 4, height: 4, borderRadius: '50%', background: d === hoyNombre ? 'currentColor' : 'transparent' }}
                                    />
                                </button>
                            ))}
                        </div>
            </div>
        </div>
    )

    if (loading) return (
        <div className="diet-notebook">
            {selector}
            <div className="flex items-center justify-center py-8">
                <CircleNotch size={20} className="animate-spin" style={{ color: 'var(--diet-warm)' }} />
            </div>
        </div>
    )

    if (error) return (
        <div className="diet-notebook text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            {selector}
            No se pudo cargar la lista. Inténtalo de nuevo.
        </div>
    )

    if (!items.length) return (
        <div className="diet-notebook">
            {selector}
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                No hay ingredientes para esta vista.
            </div>
        </div>
    )

    const platos = data?.platos ?? []
    const enPlatos = vista === 'platos'
    const sinPlatosElegidos = enPlatos && platosElegidos.size === 0

    // Una sola lista para las dos vistas: todos los ingredientes o solo los de los platos elegidos
    const filas: FilaLista[] = enPlatos
        ? ingredientesDePlatos(platos, platosElegidos).map(i => ({
            id: i.clave,
            nombre: i.nombre,
            categoria: i.categoria,
            cantidad: i.cantidad_compra,
            origen: i.platos,
            oferta: false,
        }))
        : items.map(i => ({
            id: i.alimento_id,
            nombre: i.nombre,
            categoria: i.categoria,
            cantidad: i.cantidad_compra ?? formatGramos(i.cantidad_gramos),
            origen: i.comidas_origen,
            oferta: !!data?.ofertas?.some(o => o.alimento_id === i.alimento_id),
        }))
    const marcadosVista = enPlatos ? marcadosPlatos : marcados
    const setMarcadosVista = enPlatos ? setMarcadosPlatos : setMarcados
    const storageKeyVista = enPlatos ? storageKeyPlatos : storageKey

    // Agrupar por categoría
    const porCategoria = filas.reduce<Record<string, FilaLista[]>>((acc, item) => {
        const cat = item.categoria
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(item)
        return acc
    }, {})

    const totalItems = filas.length
    const totalMarcados = filas.filter(f => marcadosVista.has(f.id)).length
    const optimizacion = data?.optimizacion

    function togglePlato(id: string) {
        setPlatosElegidos(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    function toggleMarcado(id: string) {
        setMarcadosVista(prev => {
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

    // Mensaje de WhatsApp: texto limpio, igual que la lista que se ve en pantalla
    function textoWhatsApp(): string {
        const lineas: string[] = [`Lista de la compra · ${tituloDia}`]
        if (enPlatos) {
            const nombres = platos.filter(p => platosElegidos.has(p.id)).map(p => p.nombre)
            if (nombres.length) lineas.push(`Platos: ${nombres.join(', ')}`)
        }
        for (const [cat, lista] of Object.entries(porCategoria)) {
            lineas.push('', cat.toUpperCase())
            for (const f of lista) lineas.push(`- ${f.nombre} · ${f.cantidad}`)
        }
        if (!enPlatos && optimizacion) {
            lineas.push('', `Coste estimado: ${formatEuro(optimizacion.coste_total_multi_super)}`)
        }
        return lineas.join('\n')
    }

    const botonWhatsApp = totalItems > 0 && (
        <a
            href={`https://wa.me/?text=${encodeURIComponent(textoWhatsApp())}`}
            target="_blank"
            rel="noreferrer"
            className="shopping-list-editorial__share"
        >
            <PaperPlaneTilt size={14} weight="regular" />
            <span>Enviar lista por WhatsApp</span>
        </a>
    )

    return (
        <div className="shopping-list-editorial diet-notebook space-y-2">
            {selector}
            {enPlatos && !sinPlatosElegidos && (
                <div className="shopping-list-editorial__routes">{botonWhatsApp}</div>
            )}
            {!enPlatos && optimizacion && (
                <section className="shopping-list-editorial__overview" aria-label="Resumen de compra">
                    <div className="shopping-list-editorial__metrics">
                        <div className="shopping-list-editorial__metric">
                            <p>Coste estimado de la cesta</p>
                            <strong>
                                {formatEuro(optimizacion.coste_total_multi_super)}
                            </strong>
                        </div>
                    </div>

                    <div className="shopping-list-editorial__routes">
                        {botonWhatsApp}
                    </div>
                </section>
            )}

            <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Cómo ver la lista">
                {(['ingredientes', 'platos'] as const).map(v => (
                    <button
                        key={v}
                        role="tab"
                        aria-selected={vista === v}
                        onClick={() => setVista(v)}
                        className="px-3 py-2 text-xs font-semibold"
                        style={{
                            background: vista === v ? 'var(--diet-warm)' : 'var(--diet-paper)',
                            color: vista === v ? 'var(--atelier-carbon)' : 'var(--text-secondary)',
                            border: `1px solid ${vista === v ? 'var(--diet-warm)' : 'var(--diet-rule)'}`,
                        }}
                    >
                        {v === 'ingredientes' ? 'Por categorías' : 'Por platos'}
                    </button>
                ))}
            </div>

            {enPlatos && (
                <section className="space-y-1.5" aria-label="Elige los platos">
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                        <span>
                            {platosElegidos.size
                                ? `${platosElegidos.size} de ${platos.length} platos elegidos`
                                : 'Elige los platos que vas a preparar'}
                        </span>
                        {platos.length > 1 && (
                            <button
                                className="font-semibold"
                                style={{ color: 'var(--diet-warm)' }}
                                onClick={() => setPlatosElegidos(
                                    platosElegidos.size === platos.length ? new Set() : new Set(platos.map(p => p.id))
                                )}
                            >
                                {platosElegidos.size === platos.length ? 'Quitar todos' : 'Elegir todos'}
                            </button>
                        )}
                    </div>
                    {platos.map(plato => {
                        const elegido = platosElegidos.has(plato.id)
                        const detalle = [plato.dia, plato.franja].filter(Boolean).join(' · ')
                        return (
                            <button
                                key={plato.id}
                                onClick={() => togglePlato(plato.id)}
                                aria-pressed={elegido}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                                style={{
                                    background: elegido ? 'color-mix(in srgb, var(--diet-warm) 22%, var(--surface))' : 'var(--surface)',
                                    border: `1px solid ${elegido ? 'var(--diet-warm)' : 'var(--border)'}`,
                                }}
                            >
                                <div
                                    className="w-5 h-5 flex-shrink-0 flex items-center justify-center"
                                    style={{
                                        border: `1px solid ${elegido ? 'var(--diet-warm)' : 'var(--border-strong)'}`,
                                        background: elegido ? 'var(--diet-warm)' : 'transparent',
                                    }}
                                >
                                    {elegido && <Check size={11} color="var(--atelier-carbon)" weight="bold" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{plato.nombre}</p>
                                    {detalle && (
                                        <p className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>{detalle}</p>
                                    )}
                                </div>
                                <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                    {plato.ingredientes.length} ingr.
                                </span>
                            </button>
                        )
                    })}
                </section>
            )}

            {sinPlatosElegidos && (
                <p className="text-center py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Marca uno o varios platos y verás solo sus ingredientes.
                </p>
            )}

            {/* Progreso */}
            {!sinPlatosElegidos && (
            <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <span>
                    {totalItems} ingredientes · {Object.keys(porCategoria).length} categorías
                    {enPlatos ? ` · ${platosElegidos.size} ${platosElegidos.size === 1 ? 'plato' : 'platos'}` : ''}
                </span>
                {totalMarcados > 0 && (
                    <span className="shopping-list-editorial__accent font-medium">
                        {totalMarcados}/{totalItems} en el carro
                    </span>
                )}
            </div>
            )}
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
                const todosMarcados = catItems.every(i => marcadosVista.has(i.id))

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
                                    const checked = marcadosVista.has(item.id)
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleMarcado(item.id)}
                                            className="shopping-list-editorial__item w-full flex items-center gap-3 text-left transition-colors"
                                            style={{ background: checked ? 'var(--bg)' : 'var(--surface)' }}
                                        >
                                            {/* Checkbox */}
                                            <div
                                                className="shopping-list-editorial__check w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all"
                                                style={{
                                                    borderColor: checked ? 'var(--diet-warm)' : 'var(--border-strong)',
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
                                                {item.origen.length > 0 && (
                                                    <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                                        {item.origen.join(' · ')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Cantidad */}
                                            <span
                                                className="text-xs font-semibold flex-shrink-0 inline-flex items-center gap-1"
                                                style={{ color: checked ? 'var(--text-muted)' : 'var(--diet-warm-muted, var(--text-secondary))' }}
                                            >
                                                {item.cantidad}
                                                {item.oferta && <Tag size={11} />}
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
                        setMarcadosVista(new Set())
                        localStorage.removeItem(storageKeyVista)
                    }}
                >
                    Limpiar selección
                </button>
            )}
        </div>
    )
}

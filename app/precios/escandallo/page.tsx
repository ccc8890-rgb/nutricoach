'use client'

import { useState, useEffect, useCallback } from 'react'
import SelectorProducto from '@/components/SelectorProducto'

interface EscandalloCliente {
    cliente_id: string
    cliente_nombre: string
    plan_id: string
    plan_nombre: string
    precio_total: number
    alimentos: EscandalloAlimento[]
    coste_por_comida: EscandalloComida[]
}

interface EscandalloAlimento {
    alimento_id: string
    alimento_nombre: string
    cantidad_gramos: number
    precio_por_kg: number
    coste_euros: number
    supermercado_nombre?: string
    nombre_original?: string
}

interface Supermercado {
    id: string
    nombre: string
}

interface EscandalloComida {
    comida_nombre: string
    coste_total: number
    alimentos?: EscandalloAlimento[]
}

interface EscandalloApiResponse {
    clientes?: Array<Omit<EscandalloCliente, 'alimentos'>>
    error?: string
}

interface CoberturaEscandallo {
    total_ingredientes: number
    ingredientes_con_precio: number
    ingredientes_sin_precio: number
    cobertura_pct: number
    precios_referencia: number
    recetas_baja_cobertura: Array<{
        id: string
        nombre: string
        cobertura_pct: number
        sinPrecio: number
    }>
    top_ingredientes_sin_precio: Array<{
        alimento_id: string
        alimento_nombre: string
        categoria: string | null
        usos: number
        gramos: number
        precio_sugerido_kg: number
        metodo: string
    }>
}

export default function EscandalloPage() {
    const [clientes, setClientes] = useState<EscandalloCliente[]>([])
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [supermercadoSel, setSupermercadoSel] = useState<string>('')
    const [cobertura, setCobertura] = useState<CoberturaEscandallo | null>(null)
    const [guardandoPrecio, setGuardandoPrecio] = useState<string | null>(null)
    const [preciosEditados, setPreciosEditados] = useState<Record<string, string>>({})
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [vistaDetallada, setVistaDetallada] = useState(false)

    const cargarEscandallo = useCallback(async (supermercadoId?: string) => {
        setCargando(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (supermercadoId) params.set('supermercado_id', supermercadoId)
            const res = await fetch(`/api/precios/escandallo?${params}`)
            const data = await res.json() as EscandalloApiResponse
            if (!res.ok) {
                setError(data.error || 'Error al cargar')
            } else {
                // Transformar alimentos del coste_por_comida a lista plana para SelectorProducto
                const clientesConAlimentos = (data.clientes || []).map((c) => {
                    const alimentosPlanos = extraerAlimentos(c.coste_por_comida || [])
                    return { ...c, alimentos: alimentosPlanos }
                })
                setClientes(clientesConAlimentos)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de red')
        } finally {
            setCargando(false)
        }
    }, [])

    const cargarCobertura = useCallback(async () => {
        try {
            const res = await fetch('/api/precios/cobertura')
            const data = await res.json() as CoberturaEscandallo
            if (res.ok) setCobertura(data)
        } catch (err) {
            console.error('[EscandalloPage] Error cargando cobertura:', err)
        }
    }, [])

    async function guardarPrecioReferencia(alimentoId: string, precioSugerido: number) {
        const raw = preciosEditados[alimentoId]
        const precio = Number(raw || precioSugerido)
        if (!Number.isFinite(precio) || precio <= 0) {
            setError('Introduce un precio €/kg válido')
            return
        }

        setGuardandoPrecio(alimentoId)
        setError('')
        try {
            const res = await fetch('/api/precios/referencia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ alimento_id: alimentoId, precio_por_kg: precio }),
            })
            const data = await res.json() as { error?: string }
            if (!res.ok) {
                setError(data.error || 'Error al guardar precio referencia')
                return
            }
            setPreciosEditados(prev => {
                const next = { ...prev }
                delete next[alimentoId]
                return next
            })
            await Promise.all([
                cargarCobertura(),
                cargarEscandallo(supermercadoSel || undefined),
            ])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de red')
        } finally {
            setGuardandoPrecio(null)
        }
    }

    useEffect(() => {
        fetch('/api/precios/supermercados')
            .then(r => r.json())
            .then(data => {
                setSupermercados(data.supermercados || data || [])
            })
            .catch(e => console.error('[EscandalloPage] Error cargando supermercados:', e))

        cargarEscandallo()
        cargarCobertura()
    }, [cargarCobertura, cargarEscandallo])

    useEffect(() => {
        cargarEscandallo(supermercadoSel || undefined)
    }, [supermercadoSel, cargarEscandallo])

    const totalSemanal = clientes.reduce((sum, c) => sum + (c.precio_total || 0), 0)

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Cabecera */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Escandallo de Costes</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        Coste semanal de la compra por cliente según precios de supermercado
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setVistaDetallada(!vistaDetallada)}
                        className={`btn btn-sm ${vistaDetallada ? 'btn-primary' : 'btn-secondary'}`}
                    >
                        {vistaDetallada ? '🔍 Vista simple' : '🔬 Vista detallada'}
                    </button>
                    <select
                        value={supermercadoSel}
                        onChange={e => setSupermercadoSel(e.target.value)}
                        className="px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                    >
                        <option value="">🏪 Todos los supermercados</option>
                        {supermercados.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Resumen global */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Clientes con plan</div>
                    <div className="text-2xl font-bold mt-1">{clientes.length}</div>
                </div>
                <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Coste semanal total</div>
                    <div className="text-2xl font-bold mt-1">{totalSemanal.toFixed(2)}€</div>
                </div>
                <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Coste mensual estimado</div>
                    <div className="text-2xl font-bold mt-1">{(totalSemanal * 4.33).toFixed(2)}€</div>
                </div>
            </div>

            {cobertura && (
                <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                    <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Cobertura escandallo</div>
                            <div className="text-2xl font-bold mt-1">{cobertura.cobertura_pct}%</div>
                        </div>
                        <div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Usos con precio</div>
                            <div className="text-2xl font-bold mt-1">{cobertura.ingredientes_con_precio}/{cobertura.total_ingredientes}</div>
                        </div>
                        <div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Sin precio</div>
                            <div className="text-2xl font-bold mt-1">{cobertura.ingredientes_sin_precio}</div>
                        </div>
                        <div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Precios referencia</div>
                            <div className="text-2xl font-bold mt-1">{cobertura.precios_referencia}</div>
                        </div>
                    </div>

                    {cobertura.top_ingredientes_sin_precio.length > 0 && (
                        <div className="p-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                                <div>
                                    <h2 className="text-sm font-semibold">Ingredientes que más desbloquean escandallos</h2>
                                    <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                        Guarda precios de referencia cuando el scraper no tenga un supermercado fiable.
                                    </p>
                                </div>
                                {cobertura.recetas_baja_cobertura.length > 0 && (
                                    <span className="text-xs px-2 py-1 rounded-md" style={{ background: '#fef3c7', color: '#92400e' }}>
                                        {cobertura.recetas_baja_cobertura.length} recetas por debajo del 80%
                                    </span>
                                )}
                            </div>

                            <div className="space-y-2">
                                {cobertura.top_ingredientes_sin_precio.slice(0, 10).map(item => (
                                    <div key={item.alimento_id} className="grid grid-cols-1 md:grid-cols-[1fr_160px_110px] gap-2 items-center p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                                        <div>
                                            <div className="text-sm font-medium">{item.alimento_nombre}</div>
                                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                {item.usos} usos · {Math.round(item.gramos)}g en recetas · {item.categoria || 'sin categoría'}
                                            </div>
                                        </div>
                                        <input
                                            value={preciosEditados[item.alimento_id] ?? String(item.precio_sugerido_kg)}
                                            onChange={e => setPreciosEditados(prev => ({ ...prev, [item.alimento_id]: e.target.value }))}
                                            inputMode="decimal"
                                            className="px-3 py-2 rounded-lg border text-sm"
                                            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
                                            aria-label={`Precio por kg de ${item.alimento_nombre}`}
                                        />
                                        <button
                                            onClick={() => guardarPrecioReferencia(item.alimento_id, item.precio_sugerido_kg)}
                                            disabled={guardandoPrecio === item.alimento_id}
                                            className="btn btn-sm btn-secondary disabled:opacity-50"
                                        >
                                            {guardandoPrecio === item.alimento_id ? 'Guardando' : 'Guardar €/kg'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <div className="p-4 rounded-xl border text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}>
                    ❌ {error}
                </div>
            )}

            {cargando ? (
                <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
                    Cargando escandallo...
                </div>
            ) : clientes.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
                    <p className="text-lg">No hay clientes con planes activos</p>
                    <p className="text-sm mt-2">Crea un plan nutricional para empezar a ver costes</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {clientes.map(cliente => (
                        <div key={cliente.cliente_id} className="rounded-xl border overflow-hidden"
                            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            {/* Cabecera del cliente */}
                            <div className="p-4 flex items-center justify-between flex-wrap gap-2"
                                style={{ borderBottom: '1px solid var(--border)' }}>
                                <div>
                                    <h3 className="font-semibold">{cliente.cliente_nombre}</h3>
                                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                        {cliente.plan_nombre}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-bold">{cliente.precio_total?.toFixed(2) || '0.00'}€</div>
                                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>/semana</div>
                                </div>
                            </div>

                            {vistaDetallada ? (
                                /* ── VISTA DETALLADA con SelectorProducto ── */
                                <div className="p-4 space-y-3">
                                    <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>
                                        🛒 Alimentos del plan — selecciona producto por alimento
                                    </p>

                                    {/* Agrupar alimentos únicos del plan */}
                                    {cliente.coste_por_comida && cliente.coste_por_comida.length > 0 ? (
                                        <>
                                            {/* Alimentos planos (sin repetir) de todas las comidas */}
                                            {(() => {
                                                const alimentosUnicos = extraerAlimentosUnicos(cliente.coste_por_comida)
                                                return alimentosUnicos.map((al, idx) => (
                                                    <div key={`${al.alimento_id}-${idx}`} className="p-3 rounded-lg space-y-1.5"
                                                        style={{ background: 'var(--bg)' }}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium">{al.alimento_nombre}</span>
                                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                                {al.cantidad_gramos}g/sem
                                                            </span>
                                                        </div>
                                                        <SelectorProducto
                                                            alimentoId={al.alimento_id}
                                                            alimentoNombre={al.alimento_nombre}
                                                            cantidadGramos={al.cantidad_gramos}
                                                            supermercadoActivoId={supermercadoSel || undefined}
                                                            precioActualKg={al.precio_por_kg}
                                                            mostrarCoste={true}
                                                        />
                                                    </div>
                                                ))
                                            })()}

                                            {/* Desglose por comida (compacto) */}
                                            <details className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                                                <summary className="cursor-pointer hover:opacity-80">
                                                    Ver desglose por comida
                                                </summary>
                                                <div className="mt-2 space-y-2">
                                                    {cliente.coste_por_comida.map((comida, i) => (
                                                        <div key={i} className="p-2 rounded" style={{ background: 'var(--surface)' }}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-xs font-medium">{comida.comida_nombre}</span>
                                                                <span className="text-xs font-semibold">{comida.coste_total?.toFixed(2) || '0.00'}€</span>
                                                            </div>
                                                            {comida.alimentos && (
                                                                <div className="space-y-0.5">
                                                                    {comida.alimentos.map((al, j) => (
                                                                        <div key={j} className="flex justify-between text-[11px]">
                                                                            <span>{al.alimento_nombre} ({al.cantidad_gramos}g)</span>
                                                                            <span>{al.coste_euros?.toFixed(2) || '0.00'}€</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </>
                                    ) : (
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            No hay alimentos en el plan
                                        </p>
                                    )}
                                </div>
                            ) : (
                                /* ── VISTA SIMPLE (actual) ── */
                                <>
                                    {cliente.coste_por_comida && cliente.coste_por_comida.length > 0 && (
                                        <div className="p-4 space-y-3">
                                            <p className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>Desglose por comida</p>
                                            {cliente.coste_por_comida.map((comida, i) => (
                                                <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-medium">{comida.comida_nombre}</span>
                                                        <span className="text-sm font-semibold">{comida.coste_total?.toFixed(2) || '0.00'}€</span>
                                                    </div>
                                                    {comida.alimentos && (
                                                        <div className="space-y-1">
                                                            {comida.alimentos.map((al, j) => (
                                                                <div key={j} className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                                    <span>{al.alimento_nombre} ({al.cantidad_gramos}g)</span>
                                                                    <span>{al.coste_euros?.toFixed(2) || '0.00'}€</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Proyecciones */}
                            <div className="p-4 grid grid-cols-3 gap-3 text-center text-xs"
                                style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                                <div>
                                    <div className="font-semibold" style={{ color: 'var(--muted-foreground)' }}>Diario</div>
                                    <div className="text-sm font-bold">{(cliente.precio_total / 7).toFixed(2)}€</div>
                                </div>
                                <div>
                                    <div className="font-semibold" style={{ color: 'var(--muted-foreground)' }}>Mensual</div>
                                    <div className="text-sm font-bold">{(cliente.precio_total * 4.33).toFixed(2)}€</div>
                                </div>
                                <div>
                                    <div className="font-semibold" style={{ color: 'var(--muted-foreground)' }}>Anual</div>
                                    <div className="text-sm font-bold">{(cliente.precio_total * 52).toFixed(2)}€</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="p-4 rounded-xl border text-xs" style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
                <strong>📌 Nota:</strong> Los costes se calculan en base a los precios por kg de cada supermercado.
                Si un alimento no tiene precio registrado, aparece como 0€.
                Los precios se actualizan automáticamente al scrapear.
                {vistaDetallada && ' En vista detallada puedes elegir entre múltiples productos del mismo alimento y marcar preferidos.'}
            </div>
        </div>
    )
}

// ── Helpers ────────────────────────────────────────────────────

/** Extrae lista plana de alimentos de coste_por_comida */
function extraerAlimentos(costePorComida: EscandalloComida[]): EscandalloAlimento[] {
    const result: EscandalloAlimento[] = []
    for (const comida of costePorComida) {
        for (const al of comida.alimentos || []) {
            result.push({
                alimento_id: al.alimento_id,
                alimento_nombre: al.alimento_nombre,
                cantidad_gramos: al.cantidad_gramos,
                precio_por_kg: al.precio_por_kg,
                coste_euros: al.coste_euros || 0,
            })
        }
    }
    return result
}

/** Extrae alimentos únicos (sumando cantidades) de coste_por_comida */
function extraerAlimentosUnicos(costePorComida: EscandalloComida[]): EscandalloAlimento[] {
    const mapa = new Map<string, EscandalloAlimento>()
    for (const comida of costePorComida) {
        for (const al of comida.alimentos || []) {
            const id = al.alimento_id
            if (mapa.has(id)) {
                mapa.get(id)!.cantidad_gramos += al.cantidad_gramos
                mapa.get(id)!.coste_euros += al.coste_euros || 0
            } else {
                mapa.set(id, {
                    alimento_id: id,
                    alimento_nombre: al.alimento_nombre,
                    cantidad_gramos: al.cantidad_gramos,
                    precio_por_kg: al.precio_por_kg,
                    coste_euros: al.coste_euros || 0,
                })
            }
        }
    }
    return Array.from(mapa.values()).sort((a, b) => b.coste_euros - a.coste_euros)
}

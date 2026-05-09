'use client'

import { useState, useEffect, useCallback } from 'react'
import SelectorProducto from '@/components/SelectorProducto'

interface EscandalloCliente {
    cliente_id: string
    cliente_nombre: string
    plan_id: string
    plan_nombre: string
    precio_total: number
    alimentos: any[]
    coste_por_comida: any[]
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

export default function EscandalloPage() {
    const [clientes, setClientes] = useState<EscandalloCliente[]>([])
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])
    const [supermercadoSel, setSupermercadoSel] = useState<string>('')
    const [cargando, setCargando] = useState(true)
    const [error, setError] = useState('')
    const [vistaDetallada, setVistaDetallada] = useState(false)

    async function cargarEscandallo(supermercadoId?: string) {
        setCargando(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (supermercadoId) params.set('supermercado_id', supermercadoId)
            const res = await fetch(`/api/precios/escandallo?${params}`)
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Error al cargar')
            } else {
                // Transformar alimentos del coste_por_comida a lista plana para SelectorProducto
                const clientesConAlimentos = (data.clientes || []).map((c: any) => {
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
    }

    useEffect(() => {
        fetch('/api/precios/supermercados')
            .then(r => r.json())
            .then(data => {
                setSupermercados(data.supermercados || data || [])
            })
            .catch(() => { })

        cargarEscandallo()
    }, [])

    useEffect(() => {
        cargarEscandallo(supermercadoSel || undefined)
    }, [supermercadoSel])

    const totalSemanal = clientes.reduce((sum, c) => sum + (c.precio_total || 0), 0)

    // Calcular alimentos únicos para SelectorProducto (vista detallada)
    const [alimentoSeleccionado, setAlimentoSeleccionado] = useState<{
        clienteId: string
        alimentoId: string
    } | null>(null)

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-6">
            {/* Cabecera */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">📊 Escandallo de Costes</h1>
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
                                                    {cliente.coste_por_comida.map((comida: any, i: number) => (
                                                        <div key={i} className="p-2 rounded" style={{ background: 'var(--surface)' }}>
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-xs font-medium">{comida.comida_nombre}</span>
                                                                <span className="text-xs font-semibold">{comida.coste_total?.toFixed(2) || '0.00'}€</span>
                                                            </div>
                                                            {comida.alimentos && (
                                                                <div className="space-y-0.5">
                                                                    {comida.alimentos.map((al: any, j: number) => (
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
                                            {cliente.coste_por_comida.map((comida: any, i: number) => (
                                                <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-sm font-medium">{comida.comida_nombre}</span>
                                                        <span className="text-sm font-semibold">{comida.coste_total?.toFixed(2) || '0.00'}€</span>
                                                    </div>
                                                    {comida.alimentos && (
                                                        <div className="space-y-1">
                                                            {comida.alimentos.map((al: any, j: number) => (
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
function extraerAlimentos(costePorComida: any[]): EscandalloAlimento[] {
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
function extraerAlimentosUnicos(costePorComida: any[]): EscandalloAlimento[] {
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

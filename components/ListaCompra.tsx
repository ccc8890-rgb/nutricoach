// components/ListaCompra.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Copy, Check, Store, Loader2 } from 'lucide-react'
import ItemConPrecios from './lista-compra/ItemConPrecios'
import type { ListaCompraSemanal, PrecioOpcion, ResumenSupermercado } from '@/types'

interface ListaCompraProps {
    planId: string
    clienteId: string
    semanaInicio?: string   // YYYY-MM-DD, opcional — usa el lunes actual si se omite
    nombrePlan?: string
    /** 'coach' | 'cliente' — determina seleccionado_por al guardar */
    rol?: 'coach' | 'cliente'
}

function getLunesActual(): string {
    const hoy = new Date()
    const dia = hoy.getDay()
    const diff = dia === 0 ? -6 : 1 - dia
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() + diff)
    return lunes.toISOString().split('T')[0]
}

function formatearEuro(n: number) { return `${n.toFixed(2)} €` }

export default function ListaCompra({ planId, clienteId, semanaInicio, nombrePlan, rol = 'cliente' }: ListaCompraProps) {
    const semana = semanaInicio || getLunesActual()
    const [abierto, setAbierto] = useState(false)
    const [datos, setDatos] = useState<ListaCompraSemanal | null>(null)
    const [cargando, setCargando] = useState(false)
    const [guardando, setGuardando] = useState<string | null>(null) // alimento_id en proceso
    const [copiado, setCopiado] = useState(false)
    const [error, setError] = useState('')

    const cargar = useCallback(async () => {
        if (!planId) return
        setCargando(true)
        setError('')
        try {
            const res = await fetch(`/api/lista-compra/semanal?plan_id=${planId}&semana_inicio=${semana}`)
            const json = await res.json()
            if (!res.ok) setError(json.error || 'Error al cargar lista')
            else setDatos(json)
        } catch {
            setError('Error de red')
        } finally {
            setCargando(false)
        }
    }, [planId, semana])

    useEffect(() => {
        if (abierto && !datos) cargar()
    }, [abierto, datos, cargar])

    async function handleSeleccionar(alimentoId: string, opcion: PrecioOpcion) {
        setGuardando(alimentoId)
        try {
            await fetch('/api/lista-compra/selecciones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente_id: clienteId,
                    plan_id: planId,
                    alimento_id: alimentoId,
                    supermercado_id: opcion.supermercado_id,
                    precio_por_kg: opcion.precio_por_kg,
                    url_producto: opcion.url_producto,
                    semana_inicio: semana,
                    seleccionado_por: rol,
                }),
            })
            // Actualizar local sin refetch completo
            setDatos(prev => {
                if (!prev) return prev
                const ingredientes = prev.ingredientes.map(ing => {
                    if (ing.alimento_id !== alimentoId) return ing
                    return {
                        ...ing,
                        seleccion: {
                            cliente_id: clienteId,
                            plan_id: planId,
                            alimento_id: alimentoId,
                            supermercado_id: opcion.supermercado_id,
                            producto_nombre: opcion.supermercado_nombre,
                            precio_por_kg: opcion.precio_por_kg,
                            url_producto: opcion.url_producto,
                            semana_inicio: semana,
                            seleccionado_por: rol,
                        },
                    }
                })
                // Recalcular coste total
                let costeTotal = 0
                for (const ing of ingredientes) {
                    const p = ing.seleccion
                        ? ing.precios.find(px => px.supermercado_id === ing.seleccion?.supermercado_id)
                        : ing.precios[0]
                    if (p) costeTotal += p.coste_euros
                }
                return { ...prev, ingredientes, coste_total: Math.round(costeTotal * 100) / 100 }
            })
        } catch {
            // silencioso — la selección fallará en silencio pero la UI sigue funcionando
        } finally {
            setGuardando(null)
        }
    }

    async function copiarLista() {
        if (!datos) return
        const lineas = [`🛒 LISTA DE LA COMPRA${nombrePlan ? ` — ${nombrePlan}` : ''}`]
        for (const ing of datos.ingredientes) {
            const g = ing.cantidad_gramos_total
            const texto = g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${Math.round(g)} g`
            const super_ = ing.seleccion?.supermercado_id
                ? ing.precios.find(p => p.supermercado_id === ing.seleccion?.supermercado_id)
                : ing.precios[0]
            const precio = super_ ? ` — ${super_.coste_euros.toFixed(2)} € (${super_.supermercado_nombre})` : ''
            lineas.push(`  • ${ing.alimento_nombre} — ${texto}${precio}`)
        }
        if (datos.coste_total > 0) lineas.push(`\n💰 Total estimado: ${formatearEuro(datos.coste_total)}`)
        try {
            await navigator.clipboard.writeText(lineas.join('\n'))
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch { /* fallback silencioso */ }
    }

    const totalItems = datos?.ingredientes.length ?? 0

    return (
        <div className="card overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setAbierto(!abierto)}
                className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#F0FDF4' }}>
                        <ShoppingCart size={20} style={{ color: '#16A34A' }} />
                    </div>
                    <div className="text-left">
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>Lista de la compra</p>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            {totalItems > 0
                                ? `${totalItems} producto${totalItems !== 1 ? 's' : ''}`
                                : 'Cargando...'}
                            {datos && datos.coste_total > 0 && (
                                <span className="ml-2 font-semibold" style={{ color: '#16A34A' }}>
                                    · {formatearEuro(datos.coste_total)}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {datos && (
                        <button
                            onClick={e => { e.stopPropagation(); copiarLista() }}
                            className="p-2 rounded-lg transition-colors"
                            style={{ background: 'var(--surface)' }}
                            title="Copiar lista"
                        >
                            {copiado ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} style={{ color: 'var(--muted-foreground)' }} />}
                        </button>
                    )}
                    <span style={{ color: 'var(--muted-foreground)' }}>{abierto ? '▲' : '▼'}</span>
                </div>
            </button>

            {/* Cuerpo */}
            {abierto && (
                <div className="px-4 pb-4 space-y-5" style={{ borderTop: '1px solid var(--border)' }}>

                    {cargando && (
                        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--muted-foreground)' }}>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Cargando ingredientes y precios...</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626' }}>
                            ❌ {error}
                        </div>
                    )}

                    {datos && !cargando && (
                        <>
                            {/* Lista de ingredientes */}
                            <div className="pt-3 space-y-2">
                                {datos.ingredientes.length === 0 ? (
                                    <p className="text-sm text-center py-4" style={{ color: 'var(--muted-foreground)' }}>
                                        Este plan no tiene ingredientes.
                                    </p>
                                ) : (
                                    datos.ingredientes.map(ing => (
                                        <ItemConPrecios
                                            key={ing.alimento_id}
                                            ingrediente={ing}
                                            onSeleccionar={handleSeleccionar}
                                            guardando={guardando === ing.alimento_id}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Resumen por supermercado */}
                            {datos.resumen_por_supermercado.length > 0 && (
                                <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--surface)' }}>
                                    <div className="flex items-center gap-2">
                                        <Store className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                                            Resumen por supermercado
                                        </h4>
                                    </div>
                                    <div className="space-y-2">
                                        {datos.resumen_por_supermercado.map((r: ResumenSupermercado) => (
                                            <div key={r.supermercado_id} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ background: r.supermercado_color || '#9ca3af' }}
                                                    />
                                                    <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                                                        {r.supermercado_nombre}
                                                    </span>
                                                    <span className="text-xs truncate hidden sm:block" style={{ color: 'var(--muted-foreground)' }}>
                                                        ({r.ingredientes.slice(0, 3).join(', ')}{r.ingredientes.length > 3 ? `... +${r.ingredientes.length - 3}` : ''})
                                                    </span>
                                                </div>
                                                <span className="text-sm font-bold shrink-0 ml-2" style={{ color: 'var(--text)' }}>
                                                    {formatearEuro(r.coste_total)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                        <div className="flex justify-between">
                                            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Total estimado</span>
                                            <span className="text-sm font-bold" style={{ color: '#16a34a' }}>{formatearEuro(datos.coste_total)}</span>
                                        </div>
                                        {datos.coste_total_mas_caro > datos.coste_total && (
                                            <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>
                                                Ahorro vs. comprar todo en el super más caro: {formatearEuro(datos.coste_total_mas_caro - datos.coste_total)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

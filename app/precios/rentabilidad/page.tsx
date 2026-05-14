'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Search } from 'lucide-react'
import DashboardRentabilidad from '@/components/DashboardRentabilidad'

export default function RentabilidadPage() {
    const router = useRouter()
    const [clienteId, setClienteId] = useState<string>('')
    const [buscando, setBuscando] = useState(false)
    const [resultados, setResultados] = useState<{ id: string; nombre: string; email: string }[]>([])
    const [query, setQuery] = useState('')
    const [seleccionado, setSeleccionado] = useState<string | null>(null)

    const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)

    async function buscarCliente(q: string) {
        setQuery(q)
        setErrorBusqueda(null)
        if (q.trim().length < 2) {
            setResultados([])
            return
        }
        setBuscando(true)
        try {
            const res = await fetch(`/api/clientes/buscar?q=${encodeURIComponent(q)}`)
            if (!res.ok) throw new Error(`Error ${res.status}`)
            const data = await res.json()
            setResultados(Array.isArray(data.clientes) ? data.clientes : [])
        } catch (err) {
            setErrorBusqueda(err instanceof Error ? err.message : 'Error al buscar')
            setResultados([])
        } finally {
            setBuscando(false)
        }
    }

    return (
        <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Selector de cliente */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                    <Store className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                        Seleccionar cliente
                    </h2>
                </div>

                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => buscarCliente(e.target.value)}
                        placeholder="Buscar cliente por nombre o email..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none"
                    />
                </div>

                {buscando && (
                    <p className="text-xs text-neutral-400 mt-2">Buscando...</p>
                )}

                {errorBusqueda && (
                    <p className="text-xs text-red-500 mt-2">{errorBusqueda}</p>
                )}

                {resultados.length > 0 && (
                    <ul className="mt-3 max-w-md space-y-1">
                        {resultados.map(c => (
                            <li key={c.id}>
                                <button
                                    onClick={() => {
                                        setSeleccionado(c.id)
                                        setClienteId(c.id)
                                        setResultados([])
                                        setQuery(`${c.nombre} (${c.email})`)
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${seleccionado === c.id
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-medium'
                                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                                        }`}
                                >
                                    {c.nombre}
                                    <span className="text-neutral-400 ml-2 text-xs">{c.email}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                {seleccionado && !resultados.length && !buscando && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        ✓ Cliente seleccionado. El dashboard se muestra abajo.
                    </p>
                )}

                {!seleccionado && !buscando && resultados.length === 0 && !query && (
                    <p className="text-xs text-neutral-400 mt-2">
                        Busca un cliente para ver su dashboard de rentabilidad.
                    </p>
                )}
            </div>

            {/* Dashboard */}
            {clienteId && (
                <DashboardRentabilidad clienteId={clienteId} />
            )}
        </div>
    )
}

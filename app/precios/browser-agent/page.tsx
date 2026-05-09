'use client'

import { useState } from 'react'

export default function BrowserAgentPage() {
    const [url, setUrl] = useState('')
    const [supermercado, setSupermercado] = useState('')
    const [resultado, setResultado] = useState<any>(null)
    const [cargando, setCargando] = useState(false)
    const [error, setError] = useState('')

    async function ejecutar() {
        if (!url || !supermercado) return
        setCargando(true)
        setError('')
        setResultado(null)

        try {
            const res = await fetch('/api/precios/browser-agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, supermercado }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Error del servidor')
            } else {
                setResultado(data)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error de red')
        } finally {
            setCargando(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">🤖 Browser Agent IA</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                    Navegador automático con DeepSeek + Playwright para scrapear supermercados
                </p>
            </div>

            <div className="grid gap-4 p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                <div>
                    <label className="text-sm font-medium block mb-1">URL del supermercado</label>
                    <input
                        type="url"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="https://www.carrefour.es/..."
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                    />
                </div>
                <div>
                    <label className="text-sm font-medium block mb-1">Nombre del supermercado</label>
                    <input
                        type="text"
                        value={supermercado}
                        onChange={e => setSupermercado(e.target.value)}
                        placeholder="Carrefour, Día, Alcampo..."
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}
                    />
                </div>
                <button
                    onClick={ejecutar}
                    disabled={cargando || !url || !supermercado}
                    className="px-4 py-2 rounded-lg text-white font-medium text-sm disabled:opacity-50"
                    style={{ background: 'var(--primary)' }}
                >
                    {cargando ? '🔍 Analizando...' : '🚀 Ejecutar Browser Agent'}
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl border text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: '#dc2626' }}>
                    ❌ {error}
                </div>
            )}

            {resultado && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <div className="text-2xl font-bold">{resultado.productos?.length || 0}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Productos extraídos</div>
                        </div>
                        <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <div className="text-2xl font-bold">{resultado.pasos?.length || 0}</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Pasos ejecutados</div>
                        </div>
                        <div className="p-4 rounded-xl border text-center" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <div className="text-2xl font-bold">{(resultado.duracion_ms / 1000).toFixed(1)}s</div>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Duración</div>
                        </div>
                    </div>

                    {resultado.pasos?.length > 0 && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <h3 className="font-medium text-sm mb-2">📋 Pasos</h3>
                            <ol className="space-y-1">
                                {resultado.pasos.map((paso: string, i: number) => (
                                    <li key={i} className="text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{paso}</li>
                                ))}
                            </ol>
                        </div>
                    )}

                    {resultado.productos?.length > 0 && (
                        <div className="p-4 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <h3 className="font-medium text-sm mb-3">🛒 Productos encontrados</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left" style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th className="pb-2 font-medium">Nombre</th>
                                            <th className="pb-2 font-medium">Precio</th>
                                            <th className="pb-2 font-medium">Precio/kg</th>
                                            <th className="pb-2 font-medium">Marca</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {resultado.productos.map((p: any, i: number) => (
                                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                                                <td className="py-1.5 pr-4">{p.nombre}</td>
                                                <td className="py-1.5 pr-4">{p.precio_actual?.toFixed(2)}€</td>
                                                <td className="py-1.5 pr-4">{p.precio_por_kg ? `${p.precio_por_kg.toFixed(2)}€` : '-'}</td>
                                                <td className="py-1.5">{p.marca || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {resultado.errores?.length > 0 && (
                        <div className="p-4 rounded-xl border" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
                            <h3 className="font-medium text-sm mb-2" style={{ color: '#dc2626' }}>⚠️ Errores</h3>
                            <ul className="space-y-1">
                                {resultado.errores.map((e: string, i: number) => (
                                    <li key={i} className="text-xs">{e}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

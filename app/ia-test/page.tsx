'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, Bot, Settings, FlaskConical, Copy, Check, Trash2 } from 'lucide-react'

const SYSTEM_PROMPTS = [
    { key: 'neutral', label: '🤖 Asistente neutral' },
    { key: 'coach_nutricional', label: '🥗 Coach nutricional' },
    { key: 'generador_recetas', label: '👨‍🍳 Generador de recetas' },
    { key: 'traductor_macros', label: '📊 Traductor de macros (JSON)' },
] as const

const PROMPTS_RAPIDOS = [
    '¿Qué desayuno recomendado para un día de entreno de fuerza?',
    'Genera una receta de batch cooking alta en proteína para 4 días',
    '¿Cuánta proteína debería tomar un hombre de 80kg que entrena 5x/semana?',
    'Traduce a macros: 2 huevos revueltos, 100g de pavo, 50g de pan integral, aguacate',
    'Háblame sobre la suplementación con creatina (evidencia científica)',
]

interface HistorialEntry {
    id: number
    systemPrompt: string
    prompt: string
    respuesta: string
    tokens: { prompt: number; completion: number; total: number } | null
    modelo: string
    timestamp: string
}

export default function IATestPage() {
    const [prompt, setPrompt] = useState('')
    const [systemKey, setSystemKey] = useState('neutral')
    const [temperatura, setTemperatura] = useState(0.7)
    const [maxTokens, setMaxTokens] = useState(2000)
    const [cargando, setCargando] = useState(false)
    const [respuesta, setRespuesta] = useState('')
    const [modelo, setModelo] = useState('')
    const [tokens, setTokens] = useState<{ prompt: number; completion: number; total: number } | null>(null)
    const [error, setError] = useState('')
    const [historial, setHistorial] = useState<HistorialEntry[]>([])
    const [copiado, setCopiado] = useState(false)
    const [mostrarOpciones, setMostrarOpciones] = useState(false)

    async function enviarPrompt(promptTexto?: string) {
        const texto = promptTexto || prompt
        if (!texto.trim()) return

        setCargando(true)
        setError('')
        setRespuesta('')

        try {
            const res = await fetch('/api/ia-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: texto,
                    systemPromptKey: systemKey,
                    temperatura,
                    maxTokens,
                }),
            })
            const data = await res.json()

            if (!res.ok) {
                setError(data.error || `Error ${res.status}`)
                return
            }

            const respuestaTexto = data.respuesta || ''
            setRespuesta(respuestaTexto)
            setModelo(data.modelo || '')
            setTokens(data.tokens || null)

            const entry: HistorialEntry = {
                id: Date.now(),
                systemPrompt: systemKey,
                prompt: texto,
                respuesta: respuestaTexto,
                tokens: data.tokens || null,
                modelo: data.modelo || '',
                timestamp: new Date().toLocaleString('es-ES'),
            }
            setHistorial(prev => [entry, ...prev].slice(0, 20))
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error de red'
            setError(msg)
        } finally {
            setCargando(false)
        }
    }

    async function copiarRespuesta() {
        if (!respuesta) return
        await navigator.clipboard.writeText(respuesta)
        setCopiado(true)
        setTimeout(() => setCopiado(false), 2000)
    }

    function limpiar() {
        setRespuesta('')
        setError('')
        setTokens(null)
        setModelo('')
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Nav */}
            <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-800">
                    <ArrowLeft size={20} />
                </Link>
                <Bot size={22} className="text-teal-600" />
                <h1 className="font-bold text-lg text-gray-900">Probador de IA</h1>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">DeepSeek</span>
            </header>

            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
                {/* Config row */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => setMostrarOpciones(!mostrarOpciones)}
                        className="text-sm text-gray-500 flex items-center gap-1.5 hover:text-gray-800"
                    >
                        <Settings size={16} />
                        Opciones avanzadas
                    </button>
                    <div className="flex gap-2">
                        <button onClick={limpiar} className="text-sm text-gray-400 flex items-center gap-1 hover:text-gray-600">
                            <Trash2 size={14} /> Limpiar
                        </button>
                    </div>
                </div>

                {mostrarOpciones && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">System Prompt</label>
                            <select
                                value={systemKey}
                                onChange={e => setSystemKey(e.target.value)}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                            >
                                {SYSTEM_PROMPTS.map(sp => (
                                    <option key={sp.key} value={sp.key}>{sp.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                Temperatura: {temperatura.toFixed(1)}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={temperatura}
                                onChange={e => setTemperatura(Number(e.target.value))}
                                className="w-full"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>Preciso</span>
                                <span>Creativo</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Max tokens</label>
                            <input
                                type="number"
                                value={maxTokens}
                                onChange={e => setMaxTokens(Number(e.target.value))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                                min={100}
                                max={8000}
                                step={100}
                            />
                        </div>
                    </div>
                )}

                {/* Prompts rápidos */}
                <div className="flex flex-wrap gap-2">
                    {PROMPTS_RAPIDOS.map((pr, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setPrompt(pr)
                                enviarPrompt(pr)
                            }}
                            disabled={cargando}
                            className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:border-teal-300 hover:text-teal-700 transition-colors disabled:opacity-50"
                        >
                            {pr.length > 50 ? pr.slice(0, 50) + '…' : pr}
                        </button>
                    ))}
                </div>

                {/* Prompt input */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <textarea
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                        placeholder="Escribe tu prompt aquí..."
                        rows={5}
                        className="w-full px-5 py-4 text-sm resize-none outline-none border-none"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                enviarPrompt()
                            }
                        }}
                    />
                    <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-t border-gray-100">
                        <span className="text-xs text-gray-400">
                            {prompt.length} caracteres · Cmd+Enter para enviar
                        </span>
                        <button
                            onClick={() => enviarPrompt()}
                            disabled={cargando || !prompt.trim()}
                            className="btn-primary btn-sm flex items-center gap-1.5"
                        >
                            {cargando ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Send size={16} />
                            )}
                            {cargando ? 'Enviando…' : 'Enviar'}
                        </button>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm text-red-700">
                        ❌ {error}
                    </div>
                )}

                {/* Respuesta */}
                {cargando && (
                    <div className="bg-white rounded-xl border border-gray-200 p-8 flex items-center justify-center gap-3 text-gray-400">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm">DeepSeek está pensando...</span>
                    </div>
                )}

                {respuesta && !cargando && (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <Bot size={18} className="text-teal-600" />
                                <span className="text-sm font-medium text-gray-700">Respuesta</span>
                                {modelo && (
                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{modelo}</span>
                                )}
                                {tokens && (
                                    <span className="text-xs text-gray-400">
                                        {tokens.total} tokens · {tokens.prompt}p / {tokens.completion}c
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={copiarRespuesta}
                                className="text-gray-400 hover:text-gray-600"
                                title="Copiar respuesta"
                            >
                                {copiado ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                            </button>
                        </div>
                        <pre className="px-5 py-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed max-h-[500px] overflow-y-auto">
                            {respuesta}
                        </pre>
                    </div>
                )}

                {/* Historial */}
                {historial.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                            <FlaskConical size={16} />
                            Historial de pruebas ({historial.length})
                        </h2>
                        <div className="flex flex-col gap-2">
                            {historial.map(entry => (
                                <button
                                    key={entry.id}
                                    onClick={() => {
                                        setPrompt(entry.prompt)
                                        setRespuesta(entry.respuesta)
                                        setTokens(entry.tokens)
                                        setModelo(entry.modelo)
                                    }}
                                    className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-teal-200 transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-400">
                                            {entry.timestamp}
                                        </span>
                                        <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                            {entry.tokens?.total || '?'} tokens
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-700 line-clamp-2">{entry.prompt}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

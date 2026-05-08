'use client'

import { useState } from 'react'
import type { Cuestionario } from '@/types'

interface Props {
    cuestionario: Cuestionario
    onSubmit: (respuestas: Record<string, string | string[] | number>, nombre?: string, email?: string) => Promise<void>
    enviando?: boolean
    enviado?: boolean
}

export default function FormularioCliente({ cuestionario, onSubmit, enviando, enviado }: Props) {
    const [respuestas, setRespuestas] = useState<Record<string, string | string[] | number>>({})
    const [nombre, setNombre] = useState('')
    const [email, setEmail] = useState('')
    const [errores, setErrores] = useState<Record<string, string>>({})

    function actualizarRespuesta(preguntaId: string, valor: string | number) {
        setRespuestas(prev => ({ ...prev, [preguntaId]: valor }))
        setErrores(prev => {
            const copy = { ...prev }
            delete copy[preguntaId]
            return copy
        })
    }

    function actualizarMultiselect(preguntaId: string, opcionValue: string, checked: boolean) {
        setRespuestas(prev => {
            const actual = (prev[preguntaId] as string[]) || []
            const nuevo = checked
                ? [...actual, opcionValue]
                : actual.filter(v => v !== opcionValue)
            return { ...prev, [preguntaId]: nuevo }
        })
        setErrores(prev => {
            const copy = { ...prev }
            delete copy[preguntaId]
            return copy
        })
    }

    function validar(): boolean {
        const nuevosErrores: Record<string, string> = {}
        for (const pregunta of cuestionario.preguntas) {
            if (!pregunta.requerida) continue
            const valor = respuestas[pregunta.id]
            if (valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0)) {
                nuevosErrores[pregunta.id] = 'Esta pregunta es obligatoria'
            }
        }
        setErrores(nuevosErrores)
        return Object.keys(nuevosErrores).length === 0
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!validar()) return
        await onSubmit(respuestas, nombre || undefined, email || undefined)
    }

    if (enviado) {
        return (
            <div className="text-center py-12 animate-fade-in">
                <div className="text-5xl mb-4">✅</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">¡Respuestas enviadas!</h2>
                <p className="text-gray-500">
                    Gracias por completar el cuestionario. El coach revisará tus respuestas pronto.
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Datos del cliente (opcional) */}
            <div className="card space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Tus datos (opcional)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                        type="text"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        placeholder="Tu nombre"
                        className="input"
                    />
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="Tu email"
                        className="input"
                    />
                </div>
            </div>

            {/* Preguntas */}
            {cuestionario.preguntas.map((pregunta, index) => (
                <div
                    key={pregunta.id}
                    className="card animate-slide-up"
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    <label className="block text-sm font-medium text-gray-800 mb-1">
                        {pregunta.titulo}
                        {pregunta.requerida && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {pregunta.descripcion && (
                        <p className="text-xs text-gray-500 mb-2">{pregunta.descripcion}</p>
                    )}

                    {pregunta.tipo === 'texto' && (
                        <input
                            type="text"
                            value={(respuestas[pregunta.id] as string) || ''}
                            onChange={e => actualizarRespuesta(pregunta.id, e.target.value)}
                            placeholder={pregunta.placeholder || 'Escribe tu respuesta...'}
                            className={`input ${errores[pregunta.id] ? '!border-red-400 !ring-red-200' : ''}`}
                        />
                    )}

                    {pregunta.tipo === 'textarea' && (
                        <textarea
                            value={(respuestas[pregunta.id] as string) || ''}
                            onChange={e => actualizarRespuesta(pregunta.id, e.target.value)}
                            placeholder={pregunta.placeholder || 'Escribe tu respuesta...'}
                            rows={4}
                            className={`input resize-y ${errores[pregunta.id] ? '!border-red-400 !ring-red-200' : ''}`}
                        />
                    )}

                    {pregunta.tipo === 'numero' && (
                        <input
                            type="number"
                            value={(respuestas[pregunta.id] as number) ?? ''}
                            onChange={e => actualizarRespuesta(pregunta.id, e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className={`input ${errores[pregunta.id] ? '!border-red-400 !ring-red-200' : ''}`}
                        />
                    )}

                    {pregunta.tipo === 'select' && (
                        <select
                            value={(respuestas[pregunta.id] as string) || ''}
                            onChange={e => actualizarRespuesta(pregunta.id, e.target.value)}
                            className={`input ${errores[pregunta.id] ? '!border-red-400 !ring-red-200' : ''}`}
                        >
                            <option value="">Selecciona una opción...</option>
                            {(pregunta.opciones || []).map(op => (
                                <option key={op.id} value={op.value}>{op.label}</option>
                            ))}
                        </select>
                    )}

                    {pregunta.tipo === 'multiselect' && (
                        <div className="space-y-2">
                            {(pregunta.opciones || []).map(op => {
                                const seleccionados = (respuestas[pregunta.id] as string[]) || []
                                return (
                                    <label key={op.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                        <input
                                            type="checkbox"
                                            checked={seleccionados.includes(op.value)}
                                            onChange={e => actualizarMultiselect(pregunta.id, op.value, e.target.checked)}
                                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                        />
                                        {op.label}
                                    </label>
                                )
                            })}
                        </div>
                    )}

                    {pregunta.tipo === 'checkbox' && (
                        <div className="space-y-2">
                            {(pregunta.opciones || []).map(op => (
                                <label key={op.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900">
                                    <input
                                        type="checkbox"
                                        checked={((respuestas[pregunta.id] as string[]) || []).includes(op.value)}
                                        onChange={e => actualizarMultiselect(pregunta.id, op.value, e.target.checked)}
                                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                    />
                                    {op.label}
                                </label>
                            ))}
                        </div>
                    )}

                    {pregunta.tipo === 'fecha' && (
                        <input
                            type="date"
                            value={(respuestas[pregunta.id] as string) || ''}
                            onChange={e => actualizarRespuesta(pregunta.id, e.target.value)}
                            className={`input ${errores[pregunta.id] ? '!border-red-400 !ring-red-200' : ''}`}
                        />
                    )}

                    {errores[pregunta.id] && (
                        <p className="text-xs text-red-500 mt-1 animate-fade-in">{errores[pregunta.id]}</p>
                    )}
                </div>
            ))}

            <button
                type="submit"
                disabled={enviando}
                className="btn btn-primary w-full !py-3"
            >
                {enviando ? 'Enviando...' : 'Enviar respuestas'}
            </button>
        </form>
    )
}

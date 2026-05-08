'use client'

import { useState } from 'react'
import { Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import type { Pregunta, TipoPregunta } from '@/types'

interface Props {
    preguntasIniciales?: Pregunta[]
    onGuardar: (preguntas: Pregunta[]) => void
    guardando?: boolean
}

const TIPOS_PREGUNTA: { value: TipoPregunta; label: string }[] = [
    { value: 'texto', label: 'Texto corto' },
    { value: 'textarea', label: 'Texto largo' },
    { value: 'numero', label: 'Número' },
    { value: 'select', label: 'Selección única' },
    { value: 'multiselect', label: 'Selección múltiple' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'fecha', label: 'Fecha' },
]

function generarId(): string {
    return `p_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function crearPreguntaVacia(orden: number): Pregunta {
    return {
        id: generarId(),
        tipo: 'texto',
        titulo: '',
        descripcion: '',
        requerida: false,
        opciones: [],
        placeholder: '',
        orden,
    }
}

export default function CuestionarioCreador({ preguntasIniciales = [], onGuardar, guardando }: Props) {
    const [preguntas, setPreguntas] = useState<Pregunta[]>(
        preguntasIniciales.length > 0
            ? preguntasIniciales
            : [crearPreguntaVacia(0)]
    )

    function actualizarPregunta(id: string, campo: keyof Pregunta, valor: unknown) {
        setPreguntas(prev =>
            prev.map(p => (p.id === id ? { ...p, [campo]: valor } : p))
        )
    }

    function agregarPregunta() {
        setPreguntas(prev => [...prev, crearPreguntaVacia(prev.length)])
    }

    function eliminarPregunta(id: string) {
        setPreguntas(prev => {
            const filtradas = prev.filter(p => p.id !== id)
            return filtradas.map((p, i) => ({ ...p, orden: i }))
        })
    }

    function moverPregunta(id: string, direccion: 'arriba' | 'abajo') {
        setPreguntas(prev => {
            const idx = prev.findIndex(p => p.id === id)
            if (idx === -1) return prev
            if (direccion === 'arriba' && idx === 0) return prev
            if (direccion === 'abajo' && idx === prev.length - 1) return prev

            const nuevas = [...prev]
            const swapIdx = direccion === 'arriba' ? idx - 1 : idx + 1
                ;[nuevas[idx], nuevas[swapIdx]] = [nuevas[swapIdx], nuevas[idx]]
            return nuevas.map((p, i) => ({ ...p, orden: i }))
        })
    }

    function agregarOpcion(preguntaId: string) {
        setPreguntas(prev =>
            prev.map(p => {
                if (p.id !== preguntaId) return p
                const opciones = p.opciones || []
                return {
                    ...p,
                    opciones: [
                        ...opciones,
                        {
                            id: `opt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                            label: '',
                            value: '',
                        },
                    ],
                }
            })
        )
    }

    function actualizarOpcion(preguntaId: string, opcionId: string, campo: 'label' | 'value', valor: string) {
        setPreguntas(prev =>
            prev.map(p => {
                if (p.id !== preguntaId) return p
                return {
                    ...p,
                    opciones: (p.opciones || []).map(o =>
                        o.id === opcionId ? { ...o, [campo]: valor } : o
                    ),
                }
            })
        )
    }

    function eliminarOpcion(preguntaId: string, opcionId: string) {
        setPreguntas(prev =>
            prev.map(p => {
                if (p.id !== preguntaId) return p
                return { ...p, opciones: (p.opciones || []).filter(o => o.id !== opcionId) }
            })
        )
    }

    function handleGuardar() {
        const validas = preguntas.filter(p => p.titulo.trim().length > 0)
        if (validas.length === 0) return
        onGuardar(validas)
    }

    const necesitaOpciones = (tipo: TipoPregunta) =>
        tipo === 'select' || tipo === 'multiselect' || tipo === 'checkbox'

    return (
        <div className="space-y-4">
            {preguntas.map((pregunta, index) => (
                <div
                    key={pregunta.id}
                    className="card"
                    style={{ animationDelay: `${index * 0.05}s` }}
                >
                    {/* Cabecera de la pregunta */}
                    <div className="flex items-center gap-2 mb-3">
                        <GripVertical size={16} style={{ color: 'var(--text-muted)' }} className="cursor-grab" />
                        <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg)' }}>
                            #{index + 1}
                        </span>
                        <div className="flex-1" />
                        <button
                            onClick={() => moverPregunta(pregunta.id, 'arriba')}
                            disabled={index === 0}
                            className="p-1 disabled:opacity-30"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                            title="Mover arriba"
                        >
                            <ArrowUp size={14} />
                        </button>
                        <button
                            onClick={() => moverPregunta(pregunta.id, 'abajo')}
                            disabled={index === preguntas.length - 1}
                            className="p-1 disabled:opacity-30"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
                            title="Mover abajo"
                        >
                            <ArrowDown size={14} />
                        </button>
                        <button
                            onClick={() => eliminarPregunta(pregunta.id)}
                            className="p-1"
                            style={{ color: '#F87171' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444' }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#F87171' }}
                            title="Eliminar pregunta"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>

                    {/* Tipo de pregunta */}
                    <div className="mb-3">
                        <select
                            value={pregunta.tipo}
                            onChange={e => actualizarPregunta(pregunta.id, 'tipo', e.target.value as TipoPregunta)}
                            className="input"
                        >
                            {TIPOS_PREGUNTA.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Título */}
                    <input
                        type="text"
                        value={pregunta.titulo}
                        onChange={e => actualizarPregunta(pregunta.id, 'titulo', e.target.value)}
                        placeholder="Escribe la pregunta..."
                        className="input mb-2 font-medium"
                    />

                    {/* Descripción */}
                    <input
                        type="text"
                        value={pregunta.descripcion || ''}
                        onChange={e => actualizarPregunta(pregunta.id, 'descripcion', e.target.value)}
                        placeholder="Descripción opcional..."
                        className="input mb-2 text-xs"
                    />

                    {/* Placeholder (solo para texto/textarea) */}
                    {(pregunta.tipo === 'texto' || pregunta.tipo === 'textarea') && (
                        <input
                            type="text"
                            value={pregunta.placeholder || ''}
                            onChange={e => actualizarPregunta(pregunta.id, 'placeholder', e.target.value)}
                            placeholder="Placeholder..."
                            className="input mb-2 text-xs"
                        />
                    )}

                    {/* Opciones (para select/multiselect/checkbox) */}
                    {necesitaOpciones(pregunta.tipo) && (
                        <div className="ml-4 space-y-1.5 mb-2">
                            {(pregunta.opciones || []).map(opcion => (
                                <div key={opcion.id} className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={opcion.label}
                                        onChange={e => actualizarOpcion(pregunta.id, opcion.id, 'label', e.target.value)}
                                        placeholder="Etiqueta"
                                        className="input flex-1 text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={opcion.value}
                                        onChange={e => actualizarOpcion(pregunta.id, opcion.id, 'value', e.target.value)}
                                        placeholder="Valor"
                                        className="input flex-1 text-xs"
                                    />
                                    <button
                                        onClick={() => eliminarOpcion(pregunta.id, opcion.id)}
                                        className="text-red-400 hover:text-red-600"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => agregarOpcion(pregunta.id)}
                                className="text-xs flex items-center gap-1 mt-1 font-medium"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                            >
                                <Plus size={12} /> Añadir opción
                            </button>
                        </div>
                    )}

                    {/* Requerida */}
                    <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                        <input
                            type="checkbox"
                            checked={pregunta.requerida}
                            onChange={e => actualizarPregunta(pregunta.id, 'requerida', e.target.checked)}
                            className="rounded"
                            style={{ borderColor: 'var(--border)' }}
                        />
                        Obligatoria
                    </label>
                </div>
            ))}

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
                <button
                    onClick={agregarPregunta}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
                >
                    <Plus size={16} /> Añadir pregunta
                </button>
                <div className="flex-1" />
                <button
                    onClick={handleGuardar}
                    disabled={guardando || preguntas.every(p => !p.titulo.trim())}
                    className="btn btn-primary btn-sm"
                >
                    {guardando ? 'Guardando...' : 'Guardar preguntas'}
                </button>
            </div>

            {preguntas.every(p => !p.titulo.trim()) && (
                <p className="text-xs" style={{ color: '#8E8E93' }}>Añade al menos una pregunta con título para guardar.</p>
            )}
        </div>
    )
}

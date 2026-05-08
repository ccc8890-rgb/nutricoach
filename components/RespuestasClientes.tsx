'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Clock, Loader2, XCircle, Sparkles, UtensilsCrossed, ChevronDown, ChevronUp, SquareArrowOutUpRight, MessageSquareReply } from 'lucide-react'
import type { RespuestaCliente, EstadoRespuesta } from '@/types'
import Link from 'next/link'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

interface Props {
    respuestas: RespuestaCliente[]
    onActualizar: () => void
}

const ESTADOS: { value: EstadoRespuesta; label: string; color: string; badgeClass: string }[] = [
    { value: 'nueva', label: 'Nueva', color: '#8E8E93', badgeClass: 'badge-graphite' },
    { value: 'procesando', label: 'Procesando (IA)', color: '#2563EB', badgeClass: 'badge-blue' },
    { value: 'dieta_lista', label: 'Dieta lista', color: '#059669', badgeClass: 'badge-green' },
    { value: 'dieta_aprobada', label: 'Aprobada', color: '#0D9488', badgeClass: 'badge-teal' },
    { value: 'dieta_rechazada', label: 'Rechazada', color: '#DC2626', badgeClass: 'badge-red' },
]

export default function RespuestasClientes({ respuestas, onActualizar }: Props) {
    const { addToast } = useToast()
    const [filtroEstado, setFiltroEstado] = useState<string>('todas')
    const [cambiandoEstado, setCambiandoEstado] = useState<string | null>(null)
    const [generando, setGenerando] = useState<string | null>(null)
    const [respuestaExpandida, setRespuestaExpandida] = useState<string | null>(null)
    const [modalConfirmar, setModalConfirmar] = useState<{
        abierto: boolean
        titulo: string
        descripcion: string
        onConfirmar: () => void
        variant?: 'primary' | 'danger'
        loading?: boolean
    }>({ abierto: false, titulo: '', descripcion: '', onConfirmar: () => { } })

    const filtradas = filtroEstado === 'todas'
        ? respuestas
        : respuestas.filter(r => r.estado === filtroEstado)

    function confirmar(titulo: string, descripcion: string, onConfirmar: () => void, variant?: 'primary' | 'danger') {
        setModalConfirmar({ abierto: true, titulo, descripcion, onConfirmar, variant })
    }

    function cerrarModal() {
        setModalConfirmar(prev => ({ ...prev, abierto: false }))
    }

    async function cambiarEstado(id: string, nuevoEstado: EstadoRespuesta) {
        setCambiandoEstado(id)
        try {
            const res = await fetch(`/api/respuestas/${id}/estado`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevoEstado }),
            })

            if (!res.ok) {
                const errData = await res.json()
                throw new Error(errData.error || 'Error al actualizar estado')
            }

            const label = ESTADOS.find(e => e.value === nuevoEstado)?.label ?? nuevoEstado
            addToast({ type: 'success', title: 'Estado actualizado', message: `Respuesta marcada como "${label}"` })
            onActualizar()
        } catch (error) {
            console.error('Error al cambiar estado:', error)
            addToast({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'No se pudo actualizar el estado' })
        } finally {
            setCambiandoEstado(null)
        }
    }

    async function handleGenerarDieta(respuestaId: string) {
        setGenerando(respuestaId)
        try {
            const res = await fetch('/api/generar-dieta-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ respuesta_cliente_id: respuestaId }),
            })

            const data = await res.json()

            if (!res.ok) {
                addToast({ type: 'error', title: 'Error al generar dieta', message: data.error || 'Error desconocido' })
                return
            }

            addToast({
                type: 'success',
                title: '✅ Dieta generada correctamente',
                message: `Plan creado con éxito`,
                duration: 6000,
            })
            onActualizar()
        } catch (error) {
            console.error('Error al generar dieta:', error)
            addToast({ type: 'error', title: 'Error de conexión', message: 'No se pudo conectar con el servidor' })
        } finally {
            setGenerando(null)
        }
    }

    function getEstadoInfo(estado: string) {
        return ESTADOS.find(e => e.value === estado) || ESTADOS[0]
    }

    if (respuestas.length === 0) {
        return (
            <div className="card text-center py-16">
                <MessageSquareReply size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No hay respuestas de clientes todavía</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Comparte el enlace de un cuestionario para empezar a recibir respuestas.
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Modal de confirmación */}
            <Modal
                abierto={modalConfirmar.abierto}
                onCerrar={cerrarModal}
                titulo={modalConfirmar.titulo}
                descripcion={modalConfirmar.descripcion}
                accion={{
                    label: 'Confirmar',
                    onClick: () => {
                        modalConfirmar.onConfirmar()
                        cerrarModal()
                    },
                    variant: modalConfirmar.variant,
                    loading: modalConfirmar.loading,
                }}
                accionSecundaria={{ label: 'Cancelar', onClick: cerrarModal }}
            />

            {/* Filtros con transiciones */}
            <div className="flex items-center gap-2 flex-wrap">
                {[
                    { value: 'todas', label: 'Todas', count: respuestas.length, color: '#0D9488' },
                    ...ESTADOS.map(e => ({
                        value: e.value,
                        label: e.label,
                        count: respuestas.filter(r => r.estado === e.value).length,
                        color: e.color,
                    })),
                ].map(({ value, label, count, color }) => (
                    <button
                        key={value}
                        onClick={() => setFiltroEstado(value)}
                        className={`text-xs font-medium rounded-full px-3 py-1.5 transition-all duration-150 ${filtroEstado === value
                            ? 'text-white shadow-sm scale-105'
                            : ''
                            }`}
                        style={filtroEstado === value ? { background: color, borderColor: color } : { color: 'var(--text-secondary)', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                        <span className="font-bold mr-1">{count}</span>
                        {label}
                    </button>
                ))}
            </div>

            {/* Lista de respuestas */}
            {filtradas.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay respuestas con este filtro</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Prueba con otro filtro o espera nuevas respuestas</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtradas.map(respuesta => {
                        const estado = getEstadoInfo(respuesta.estado)
                        const expandida = respuestaExpandida === respuesta.id

                        return (
                            <div
                                key={respuesta.id}
                                className="card overflow-hidden !p-0 animate-fade-in"
                            >
                                {/* Cabecera */}
                                <div className="p-4 flex items-center gap-3">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                                        style={{ background: estado.color }}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                                            {respuesta.nombre_cliente || 'Cliente anónimo'}
                                        </p>
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {respuesta.cuestionario && (respuesta.cuestionario as unknown as Record<string, unknown>).titulo
                                                ? ((respuesta.cuestionario as unknown as Record<string, unknown>).titulo as string)
                                                : 'Cuestionario'}
                                            {' · '}
                                            {new Date(respuesta.created_at).toLocaleDateString('es-ES', {
                                                day: 'numeric', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {/* Badge estado */}
                                        <span
                                            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estado.badgeClass}`}
                                        >
                                            {estado.label}
                                        </span>

                                        {/* Botón "Generar dieta" */}
                                        {(respuesta.estado === 'nueva' || respuesta.estado === 'dieta_rechazada') && (
                                            <button
                                                onClick={() => confirmar(
                                                    'Generar dieta con IA',
                                                    'Se usarán las plantillas y recetas disponibles para crear un plan personalizado.',
                                                    () => handleGenerarDieta(respuesta.id),
                                                )}
                                                disabled={generando === respuesta.id}
                                                className="btn btn-primary btn-sm"
                                            >
                                                {generando === respuesta.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <Sparkles size={12} />
                                                )}
                                                {generando === respuesta.id ? 'Generando...' : 'Generar dieta'}
                                            </button>
                                        )}

                                        {/* Link a la dieta */}
                                        {(respuesta.estado === 'dieta_lista' || respuesta.estado === 'dieta_aprobada') && respuesta.plan_id && (
                                            <Link
                                                href={`/dietas/${respuesta.plan_id}`}
                                                className="btn btn-sm badge-blue"
                                            >
                                                <UtensilsCrossed size={12} />
                                                Dieta
                                            </Link>
                                        )}

                                        {/* Expandir */}
                                        <button
                                            onClick={() => setRespuestaExpandida(expandida ? null : respuesta.id)}
                                            className="btn btn-ghost btn-sm !px-2"
                                        >
                                            {expandida ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Contenido expandido */}
                                {expandida && (
                                    <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
                                        {respuesta.email_cliente && (
                                            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="font-medium" style={{ color: 'var(--text)' }}>Email:</span>
                                                <a href={`mailto:${respuesta.email_cliente}`} style={{ color: 'var(--primary)' }} className="hover:underline">{respuesta.email_cliente}</a>
                                            </div>
                                        )}
                                        {respuesta.plan_id && (
                                            <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                                                <span className="font-medium" style={{ color: 'var(--text)' }}>Plan de dieta:</span>
                                                <Link href={`/dietas/${respuesta.plan_id}`} style={{ color: 'var(--primary)' }} className="hover:underline inline-flex items-center gap-1">
                                                    Ver plan <SquareArrowOutUpRight size={10} />
                                                </Link>
                                            </div>
                                        )}

                                        {/* Botones de acción rápida */}
                                        {respuesta.estado === 'dieta_lista' && (
                                            <div className="flex items-center gap-2 pt-1">
                                                <button
                                                    onClick={() => confirmar(
                                                        'Aprobar dieta',
                                                        'Al aprobar, se generará un enlace público para compartir con el cliente.',
                                                        () => cambiarEstado(respuesta.id, 'dieta_aprobada'),
                                                    )}
                                                    disabled={cambiandoEstado === respuesta.id}
                                                    className="btn btn-sm badge-green"
                                                >
                                                    {cambiandoEstado === respuesta.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                                                    Aprobar
                                                </button>
                                                <button
                                                    onClick={() => confirmar(
                                                        'Rechazar dieta',
                                                        'La dieta pasará a estado "Rechazada". Podrás generar una nueva versión después.',
                                                        () => cambiarEstado(respuesta.id, 'dieta_rechazada'),
                                                        'danger'
                                                    )}
                                                    disabled={cambiandoEstado === respuesta.id}
                                                    className="btn btn-danger btn-sm"
                                                >
                                                    {cambiandoEstado === respuesta.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                                                    Rechazar
                                                </button>
                                            </div>
                                        )}

                                        {/* Las respuestas del cuestionario */}
                                        <div className="space-y-2">
                                            {Object.entries(respuesta.respuestas).map(([key, valor]) => (
                                                <div key={key} className="bg-white rounded-lg p-3 border border-gray-100">
                                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{key}</p>
                                                    <p className="text-sm text-gray-800">
                                                        {Array.isArray(valor) ? valor.join(', ') : String(valor)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

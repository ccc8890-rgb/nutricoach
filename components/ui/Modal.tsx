'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
    abierto: boolean
    onCerrar: () => void
    titulo: string
    descripcion?: string
    children?: React.ReactNode
    accion?: {
        label: string
        onClick: () => void
        variant?: 'primary' | 'danger'
        loading?: boolean
        disabled?: boolean
    }
    accionSecundaria?: {
        label: string
        onClick: () => void
    }
}

export default function Modal({
    abierto,
    onCerrar,
    titulo,
    descripcion,
    children,
    accion,
    accionSecundaria,
}: ModalProps) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        if (abierto) {
            setVisible(true)
        } else {
            const timer = setTimeout(() => setVisible(false), 200)
            return () => clearTimeout(timer)
        }
    }, [abierto])

    useEffect(() => {
        if (!abierto) return
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') onCerrar()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [abierto, onCerrar])

    if (!visible) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Overlay */}
            <div
                className={`absolute inset-0 transition-opacity duration-200 ${abierto ? 'opacity-100' : 'opacity-0'
                    }`}
                style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(8px)' }}
                onClick={onCerrar}
            />

            {/* Modal — full-screen en mobile, centered en desktop */}
            <div
                className={`relative w-full sm:max-w-md transition-all duration-200 ${abierto ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
                    }`}
                style={{
                    background: 'var(--surface)',
                    borderRadius: '16px 16px 0 0',
                    boxShadow: 'var(--shadow-xl)',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {/* Handle visual para iOS (solo mobile) */}
                <div className="flex justify-center pt-2 pb-1 sm:hidden">
                    <div
                        className="w-9 h-1 rounded-full"
                        style={{ background: 'var(--text-muted)', opacity: 0.3 }}
                    />
                </div>

                {/* Header */}
                <div className="flex items-start justify-between px-5 pt-2 pb-3 sm:pt-5">
                    <div className="flex-1 pr-4">
                        <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>{titulo}</h2>
                        {descripcion && (
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{descripcion}</p>
                        )}
                    </div>
                    <button
                        onClick={onCerrar}
                        className="transition-colors p-1.5 rounded-lg touch-manipulation"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                {children && <div className="px-5 pb-3">{children}</div>}

                {/* Footer — sticky en mobile */}
                {(accion || accionSecundaria) && (
                    <div className="flex items-center justify-end gap-2 p-5 pt-3 border-t sticky bottom-0"
                        style={{
                            borderColor: 'var(--border-light)',
                            background: 'var(--surface)',
                        }}>
                        {accionSecundaria && (
                            <button
                                onClick={accionSecundaria.onClick}
                                className="btn btn-ghost btn-sm"
                            >
                                {accionSecundaria.label}
                            </button>
                        )}
                        {accion && (
                            <button
                                onClick={accion.onClick}
                                disabled={accion.disabled || accion.loading}
                                className={`btn btn-sm ${accion.variant === 'danger' ? 'btn-danger' : 'btn-primary'
                                    }`}
                            >
                                {accion.loading ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        {accion.label}
                                    </>
                                ) : (
                                    accion.label
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

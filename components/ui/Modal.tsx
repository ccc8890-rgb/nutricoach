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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${abierto ? 'opacity-100' : 'opacity-0'
                    }`}
                onClick={onCerrar}
            />

            {/* Modal */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md transition-all duration-200 ${abierto ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2'
                    }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-5 pb-3">
                    <div className="flex-1 pr-4">
                        <h2 className="text-lg font-bold text-gray-900">{titulo}</h2>
                        {descripcion && (
                            <p className="text-sm text-gray-500 mt-1">{descripcion}</p>
                        )}
                    </div>
                    <button
                        onClick={onCerrar}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                {children && <div className="px-5 pb-3">{children}</div>}

                {/* Footer */}
                {(accion || accionSecundaria) && (
                    <div className="flex items-center justify-end gap-2 p-5 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
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

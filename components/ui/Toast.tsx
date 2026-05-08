'use client'
import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
    id: string
    type: ToastType
    title: string
    message?: string
    duration?: number
}

interface ToastContextValue {
    addToast: (toast: Omit<Toast, 'id'>) => void
    removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error('useToast debe usarse dentro de ToastProvider')
    return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setToasts(prev => [...prev, { ...toast, id }])
    }, [])

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
                {toasts.map(t => (
                    <ToastItem key={t.id} toast={t} onClose={() => removeToast(t.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    )
}

const ICONS: Record<ToastType, { icon: React.ReactNode; color: string }> = {
    success: { icon: <CheckCircle size={18} />, color: '#10B981' },
    error: { icon: <AlertCircle size={18} />, color: '#EF4444' },
    warning: { icon: <AlertTriangle size={18} />, color: '#F59E0B' },
    info: { icon: <Info size={18} />, color: '#3B82F6' },
}

const STYLES: Record<ToastType, { border: string; bg: string }> = {
    success: { border: '#A7F3D0', bg: '#ECFDF5' },
    error: { border: '#FECACA', bg: '#FEF2F2' },
    warning: { border: '#FDE68A', bg: '#FFFBEB' },
    info: { border: '#BFDBFE', bg: '#EFF6FF' },
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const [visible, setVisible] = useState(false)
    const [exiting, setExiting] = useState(false)

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true))

        const duration = toast.duration ?? 4000
        const timer = setTimeout(() => {
            setExiting(true)
            setTimeout(onClose, 200)
        }, duration)

        return () => clearTimeout(timer)
    }, [toast.duration, onClose])

    const style = STYLES[toast.type]
    const iconData = ICONS[toast.type]

    function handleClose() {
        setExiting(true)
        setTimeout(onClose, 200)
    }

    return (
        <div
            className={`rounded-xl border p-3.5 shadow-lg transition-all duration-200 ${visible && !exiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                }`}
            style={{ background: style.bg, borderColor: style.border }}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0" style={{ color: iconData.color }}>
                    {iconData.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{toast.title}</p>
                    {toast.message && (
                        <p className="text-xs text-gray-500 mt-0.5">{toast.message}</p>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-0.5 rounded-md hover:bg-white/50"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}

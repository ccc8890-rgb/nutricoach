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
    success: { icon: <CheckCircle size={18} />, color: 'var(--success)' },
    error: { icon: <AlertCircle size={18} />, color: 'var(--error)' },
    warning: { icon: <AlertTriangle size={18} />, color: 'var(--warning)' },
    info: { icon: <Info size={18} />, color: 'var(--info)' },
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

    const iconData = ICONS[toast.type]

    function handleClose() {
        setExiting(true)
        setTimeout(onClose, 200)
    }

    return (
        <div
            className={`rounded-xl p-3.5 transition-all duration-200 ${visible && !exiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
                }`}
            style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-lg)',
            }}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0" style={{ color: iconData.color }}>
                    {iconData.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{toast.title}</p>
                    {toast.message && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{toast.message}</p>
                    )}
                </div>
                <button
                    onClick={handleClose}
                    className="transition-colors flex-shrink-0 p-0.5 rounded-md"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    )
}

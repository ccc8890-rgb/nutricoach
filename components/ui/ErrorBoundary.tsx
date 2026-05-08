'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
    hasError: boolean
    error: Error | null
}

/**
 * ErrorBoundary — Captura errores de render en componentes hijos
 * y muestra un fallback visual en lugar de romper toda la página.
 *
 * USO:
 *   <ErrorBoundary>
 *       <ComponenteCritico />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Error capturado:', error, errorInfo)
        this.props.onError?.(error, errorInfo)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{ background: 'var(--error-bg)' }}
                    >
                        <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
                    </div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>
                        Algo salió mal
                    </h3>
                    <p className="text-sm mb-4 max-w-md" style={{ color: 'var(--text-secondary)' }}>
                        {this.state.error?.message || 'Error inesperado al renderizar este componente.'}
                    </p>
                    <button
                        onClick={this.handleReset}
                        className="btn btn-primary btn-sm flex items-center gap-2"
                    >
                        <RefreshCcw size={14} />
                        Reintentar
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}

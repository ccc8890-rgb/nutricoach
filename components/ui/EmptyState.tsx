'use client'

import { Inbox } from 'lucide-react'

interface EmptyStateProps {
    icon?: React.ReactNode
    titulo: string
    descripcion?: string
    accion?: {
        label: string
        onClick: () => void
    }
    className?: string
}

/**
 * EmptyState — Componente para estados vacíos (tablas sin datos,
 * búsquedas sin resultados, listas vacías).
 *
 * Sigue el Design System v6 Graphite Apple Pro:
 * - Sin sombras (flat)
 * - Usa CSS variables para respetar dark/light mode
 * - Icono grande y centrado como foco visual
 *
 * USO:
 *   <EmptyState
 *       titulo="Sin recetas aún"
 *       descripcion="Crea tu primera receta para empezar."
 *       accion={{ label: "Crear receta", onClick: handleCreate }}
 *   />
 */
export default function EmptyState({
    icon,
    titulo,
    descripcion,
    accion,
    className = '',
}: EmptyStateProps) {
    const defaultIcon = (
        <Inbox size={40} style={{ color: 'var(--text-muted)' }} />
    )

    return (
        <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
            <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: 'var(--accent-bg)' }}
            >
                {icon ?? defaultIcon}
            </div>
            <h3
                className="text-lg font-semibold mb-1"
                style={{ color: 'var(--text)' }}
            >
                {titulo}
            </h3>
            {descripcion && (
                <p
                    className="text-sm max-w-sm mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {descripcion}
                </p>
            )}
            {accion && (
                <button
                    onClick={accion.onClick}
                    className="btn btn-primary"
                >
                    {accion.label}
                </button>
            )}
        </div>
    )
}

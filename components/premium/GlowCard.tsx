'use client'

import { useState, type ReactNode } from 'react'

/**
 * GlowCard — card con borde gradiente animado al hacer hover
 * Efecto: el borde se ilumina siguiendo al ratón
 * Inspirado en Aceternity UI hover-border-gradient
 */
interface GlowCardProps {
    children: ReactNode
    className?: string
    as?: 'div' | 'a' | 'button'
    href?: string
    onClick?: () => void
}

export function GlowCard({
    children,
    className = '',
    as: Tag = 'div',
    href,
    onClick,
}: GlowCardProps) {
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [opacity, setOpacity] = useState(0)

    function handleMouseMove(e: React.MouseEvent<HTMLElement>) {
        const rect = e.currentTarget.getBoundingClientRect()
        setPosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        })
        setOpacity(1)
    }

    function handleMouseLeave(e: React.MouseEvent<HTMLElement>) {
        setOpacity(0)
        e.currentTarget.style.borderColor = 'var(--border)'
    }

    function handleMouseEnter(e: React.MouseEvent<HTMLElement>) {
        e.currentTarget.style.borderColor = 'var(--border-accent)'
    }

    const Component = Tag === 'a' ? 'a' : Tag === 'button' ? 'button' : 'div'

    return (
        <Component
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
            href={Tag === 'a' ? href : undefined}
            onClick={onClick}
            className={`relative overflow-hidden rounded-xl border ${className}`}
            style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                transition: 'border-color 0.2s ease',
            }}
        >
            {/* Glow spotlight que sigue al ratón */}
            <div
                className="pointer-events-none absolute -inset-px rounded-xl"
                style={{
                    opacity,
                    background: `radial-gradient(400px circle at ${position.x}px ${position.y}px, var(--accent-glow), transparent 40%)`,
                    transition: 'opacity 0.15s ease',
                }}
            />
            {/* Borde glow sutil */}
            <div
                className="pointer-events-none absolute inset-0 rounded-xl"
                style={{
                    opacity: opacity * 0.5,
                    boxShadow: 'inset 0 0 0 1px var(--accent-glow)',
                    transition: 'opacity 0.15s ease',
                }}
            />
            <div className="relative z-10">{children}</div>
        </Component>
    )
}

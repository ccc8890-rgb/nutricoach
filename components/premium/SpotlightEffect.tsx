'use client'

import { useRef, useState, type ReactNode } from 'react'

/**
 * SpotlightEffect — wrapper que proyecta un spotlight
 * que sigue al ratón sobre cualquier contenido
 *
 * Inspirado en Aceternity UI Spotlight
 */
interface SpotlightEffectProps {
    children: ReactNode
    className?: string
    size?: number
    color?: string
}

export function SpotlightEffect({
    children,
    className = '',
    size = 500,
    color,
}: SpotlightEffectProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [opacity, setOpacity] = useState(0)

    function handleMouseMove(e: React.MouseEvent) {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        setPosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        })
        setOpacity(1)
    }

    function handleMouseLeave() {
        setOpacity(0)
    }

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative overflow-hidden ${className}`}
        >
            {/* Spotlight */}
            <div
                className="pointer-events-none absolute inset-0 z-0"
                style={{
                    opacity,
                    background: `radial-gradient(${size}px circle at ${position.x}px ${position.y}px, ${color || 'var(--accent-glow)'}, transparent 60%)`,
                    transition: 'opacity 0.3s ease',
                }}
            />
            <div className="relative z-10">{children}</div>
        </div>
    )
}

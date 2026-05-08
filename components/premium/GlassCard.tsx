'use client'

/**
 * GlassCard — componente con efecto glassmorphism premium
 * - backdrop-filter blur
 * - borde translúcido
 * - glow graphite en hover
 * - variante con/sin hover effect
 */
interface GlassCardProps {
    children: React.ReactNode
    className?: string
    hoverable?: boolean
    glow?: boolean
    padding?: 'sm' | 'md' | 'lg'
}

export function GlassCard({
    children,
    className = '',
    hoverable = false,
    glow = false,
    padding = 'md',
}: GlassCardProps) {
    const paddings = {
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-7',
    }

    return (
        <div
            className={`${paddings[padding]} rounded-xl ${hoverable ? 'cursor-pointer' : ''} ${className}`}
            style={{
                background: 'var(--glass-bg)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid var(--glass-border)',
                boxShadow: glow
                    ? 'var(--glass-shadow), var(--shadow-glow)'
                    : 'var(--glass-shadow)',
                transition: 'all 0.25s ease',
            }}
            onMouseEnter={e => {
                if (hoverable) {
                    e.currentTarget.style.borderColor = 'var(--border-accent)'
                    e.currentTarget.style.boxShadow = 'var(--glass-shadow), var(--shadow-glow)'
                }
            }}
            onMouseLeave={e => {
                if (hoverable) {
                    e.currentTarget.style.borderColor = 'var(--glass-border)'
                    e.currentTarget.style.boxShadow = 'var(--glass-shadow)'
                }
            }}
        >
            {children}
        </div>
    )
}

'use client'

import type { ReactElement } from 'react'
import { CountUp } from '@/components/ui/CountUp'
import { SpotlightEffect } from './SpotlightEffect'

/**
 * StatCardPremium — tarjeta de estadística con glow y spotlight
 * Inspirado en Linear / Raycast
 */
interface StatCardPremiumProps {
    label: string
    value: number | string
    icon: ReactElement
    sublabel?: string
    accent?: boolean
    className?: string
}

export function StatCardPremium({
    label,
    value,
    icon,
    sublabel,
    accent = false,
    className = '',
}: StatCardPremiumProps) {
    return (
        <SpotlightEffect className={`rounded-xl ${className}`}>
            <div
                className="relative overflow-hidden rounded-xl p-5 border"
                style={{
                    background: accent
                        ? 'linear-gradient(135deg, var(--accent-bg), transparent)'
                        : 'var(--surface)',
                    borderColor: accent ? 'var(--border-accent)' : 'var(--border)',
                    boxShadow: accent ? 'var(--shadow-glow)' : 'var(--shadow-sm)',
                }}
            >
                <div className="flex items-start justify-between mb-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                            background: accent ? 'var(--accent-bg)' : 'var(--surface-hover)',
                            color: accent ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                    >
                        {icon}
                    </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                    {typeof value === 'number' ? <CountUp to={value} /> : value}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {label}
                </p>
                {sublabel && (
                    <p className="text-[11px] mt-1 font-medium" style={{ color: accent ? 'var(--accent)' : 'var(--text-muted)' }}>
                        {sublabel}
                    </p>
                )}
            </div>
        </SpotlightEffect>
    )
}

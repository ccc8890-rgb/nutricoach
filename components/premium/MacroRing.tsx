'use client'

import { useEffect, useState } from 'react'

interface MacroRingProps {
    kcal: number
    proteinas: number
    carbohidratos: number
    grasas: number
    size?: number
    className?: string
}

/**
 * MacroRing — anillos de progreso tipo Apple Watch Activity
 * Inspirado en los activity rings de Apple y Drizzle
 * Muestra kcal en el centro + 3 anillos (proteína, carbs, grasa)
 */
export function MacroRing({
    kcal,
    proteinas,
    carbohidratos,
    grasas,
    size = 140,
    className = '',
}: MacroRingProps) {
    const [animated, setAnimated] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setAnimated(true), 200)
        return () => clearTimeout(timer)
    }, [])

    // Valores máximos de referencia para el anillo completo
    const maxKcal = Math.max(kcal, 800)
    const maxProtein = Math.max(proteinas, 50)
    const maxCarbs = Math.max(carbohidratos, 80)
    const maxFat = Math.max(grasas, 30)

    const strokeWidth = 6
    const radius = (size - strokeWidth * 2) / 2
    const circumference = 2 * Math.PI * radius
    const center = size / 2

    function offset(value: number, max: number): number {
        const progress = animated ? Math.min(value / max, 1) : 0
        return circumference * (1 - progress)
    }

    return (
        <div
            className={`relative inline-flex items-center justify-center ${className}`}
            style={{ width: size, height: size }}
        >
            <svg width={size} height={size} className="transform -rotate-90">
                {/* Anillo de proteína (rojo) — exterior */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius - 2}
                    fill="none"
                    stroke="var(--macro-protein)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ opacity: 0.15 }}
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius - 2}
                    fill="none"
                    stroke="var(--macro-protein)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset(proteinas, maxProtein)}
                    style={{
                        transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
                        filter: 'drop-shadow(0 0 4px var(--macro-protein))',
                    }}
                />

                {/* Anillo de carbs (graphite) — medio */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth - 4}
                    fill="none"
                    stroke="var(--macro-carbs)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ opacity: 0.15 }}
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth - 4}
                    fill="none"
                    stroke="var(--macro-carbs)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset(carbohidratos, maxCarbs)}
                    style={{
                        transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.1s',
                        filter: 'drop-shadow(0 0 4px var(--macro-carbs))',
                    }}
                />

                {/* Anillo de grasa (azul) — interior */}
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth * 2 - 6}
                    fill="none"
                    stroke="var(--macro-fat)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    style={{ opacity: 0.15 }}
                />
                <circle
                    cx={center}
                    cy={center}
                    r={radius - strokeWidth * 2 - 6}
                    fill="none"
                    stroke="var(--macro-fat)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset(grasas, maxFat)}
                    style={{
                        transition: 'stroke-dashoffset 1.6s cubic-bezier(0.22, 1, 0.36, 1) 0.2s',
                        filter: 'drop-shadow(0 0 4px var(--macro-fat))',
                    }}
                />
            </svg>

            {/* Centro: kcal */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span
                    className="font-bold leading-none tabular-nums"
                    style={{
                        fontSize: size * 0.22,
                        color: 'var(--text)',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {Math.round(kcal)}
                </span>
                <span
                    className="text-xs leading-none mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                >
                    kcal
                </span>
            </div>

            {/* Leyenda compacta abajo */}
            <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3"
                style={{ width: size }}
            >
                <LegendDot color="var(--macro-protein)" label={`${Math.round(proteinas)}g`} />
                <LegendDot color="var(--macro-carbs)" label={`${Math.round(carbohidratos)}g`} />
                <LegendDot color="var(--macro-fat)" label={`${Math.round(grasas)}g`} />
            </div>
        </div>
    )
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color }}>
            <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 4px ${color}` }}
            />
            {label}
        </span>
    )
}

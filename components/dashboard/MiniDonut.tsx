'use client'
import { memo } from 'react'

interface DonutSlice {
    label: string
    valor: number
    color: string
}

interface MiniDonutProps {
    data: DonutSlice[]
    size?: number
    innerRadius?: number
}

const MiniDonut = memo(function MiniDonut({ data, size = 24, innerRadius = 8 }: MiniDonutProps) {
    const total = data.reduce((s, d) => s + d.valor, 0)
    if (total === 0) return null

    const radio = size / 2
    const circunferencia = 2 * Math.PI * radio

    let offset = 0

    return (
        <svg viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0" width={size} height={size}>
            {/* Fondo */}
            <circle cx={size / 2} cy={size / 2} r={radio} fill="none" stroke="var(--border)" strokeWidth={radio - innerRadius} />

            {data.map((slice) => {
                const pct = slice.valor / total
                const dash = pct * circunferencia
                const dashOffset = -offset
                offset += dash

                return (
                    <circle
                        key={slice.label}
                        cx={size / 2}
                        cy={size / 2}
                        r={radio}
                        fill="none"
                        stroke={slice.color}
                        strokeWidth={radio - innerRadius}
                        strokeDasharray={`${dash} ${circunferencia - dash}`}
                        strokeDashoffset={dashOffset}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                    />
                )
            })}
            {/* Centro — usa el color de superficie para adaptarse a dark mode */}
            <circle cx={size / 2} cy={size / 2} r={innerRadius} fill="var(--surface)" />
        </svg>
    )
})

export default MiniDonut

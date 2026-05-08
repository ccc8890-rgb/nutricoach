'use client'

import { useEffect, useRef } from 'react'

interface MiniSparklineProps {
    data: number[]
    width?: number
    height?: number
    color?: string
    className?: string
}

/**
 * MiniSparkline — tiny inline sparkline SVG sin dependencias de charting
 * Ideal para decorar stat cards con tendencia visual
 */
export function MiniSparkline({
    data,
    width = 80,
    height = 28,
    color = 'var(--accent)',
    className = '',
}: MiniSparklineProps) {
    const pathRef = useRef<SVGPathElement>(null)

    if (data.length < 2) return null

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width
        const y = height - ((v - min) / range) * (height - 4) - 2
        return `${x},${y}`
    })

    const d = points
        .map((p, i) => (i === 0 ? `M${p}` : `L${p}`))
        .join(' ')

    const areaD = `${d} L${width},${height + 2} L0,${height + 2} Z`

    const isUp = data[data.length - 1] >= data[0]

    return (
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className={className}
            style={{ overflow: 'visible' }}
        >
            {/* Gradiente de área */}
            <defs>
                <linearGradient id={`sparkline-fill-${color.replace(/\W/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
            </defs>
            {/* Área rellena */}
            <path
                d={areaD}
                fill={`url(#sparkline-fill-${color.replace(/\W/g, '')})`}
            />
            {/* Línea */}
            <path
                ref={pathRef}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-draw-line"
                style={{
                    strokeDasharray: 200,
                    strokeDashoffset: 0,
                }}
            />
            {/* Dot final */}
            <circle
                cx={points[points.length - 1].split(',')[0]}
                cy={points[points.length - 1].split(',')[1]}
                r={2.5}
                fill={color}
                opacity={0.8}
            />
        </svg>
    )
}

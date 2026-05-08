'use client'
import { memo } from 'react'

interface BarData {
    label: string
    valor: number
    color?: string
}

interface BarChartProps {
    data: BarData[]
    height?: number
    barRadius?: number
    showLabels?: boolean
    maxBarWidth?: number
    color?: string
}

const BarChart = memo(function BarChart({
    data,
    height = 100,
    barRadius = 3,
    showLabels = true,
    maxBarWidth = 40,
    color = '#0D9488',
}: BarChartProps) {
    if (data.length === 0) return null

    const maxVal = Math.max(...data.map(d => d.valor), 1)
    const W = 100
    const H = height
    const padding = 2
    const chartH = H - padding * 2

    return (
        <div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                {/* Líneas de fondo */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
                    const y = padding + chartH - pct * chartH
                    return (
                        <line
                            key={pct}
                            x1={padding}
                            y1={y}
                            x2={W - padding}
                            y2={y}
                            stroke="var(--border)"
                            strokeWidth={0.4}
                        />
                    )
                })}

                {data.map((d, i) => {
                    const barH = (d.valor / maxVal) * chartH
                    const barWidth = Math.min((W - padding * 2) / data.length * 0.6, maxBarWidth)
                    const x = padding + (i / data.length) * (W - padding * 2) + ((W - padding * 2) / data.length - barWidth) / 2
                    const y = H - padding - barH
                    const barColor = d.color || color

                    return (
                        <rect
                            key={i}
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(barH, 0.5)}
                            rx={barRadius}
                            fill={barColor}
                            opacity={0.85}
                        />
                    )
                })}
            </svg>

            {showLabels && (
                <div className="flex justify-between mt-1 text-[9px] px-0.5" style={{ color: 'var(--text-muted)' }}>
                    {data.map((d, i) => (
                        <span key={i} className="truncate text-center" style={{ width: `${100 / data.length}%` }}>
                            {d.label}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
})

// ── Stacked Horizontal Bar ──

interface StackedBarProps {
    items: { label: string; valor: number; color: string }[]
    total: number
    height?: number
}

const StackedBar = memo(function StackedBar({ items, total, height = 24 }: StackedBarProps) {
    if (total === 0) return null

    return (
        <div className="space-y-1.5">
            <div
                className="w-full rounded-full overflow-hidden flex"
                style={{ height, background: '#F1F5F9' }}
            >
                {items.map((item, i) => {
                    const pct = (item.valor / total) * 100
                    return (
                        <div
                            key={i}
                            style={{
                                width: `${pct}%`,
                                background: item.color,
                                minWidth: pct > 0 ? 4 : 0,
                            }}
                            title={`${item.label}: ${item.valor} (${Math.round(pct)}%)`}
                        />
                    )
                })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
                {items.map((item, i) => {
                    const pct = total > 0 ? Math.round((item.valor / total) * 100) : 0
                    return (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                            <span className="text-gray-500">{item.label}</span>
                            <span className="font-semibold text-gray-700">{item.valor}</span>
                            <span className="text-gray-400">({pct}%)</span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
})

export default BarChart
export { StackedBar }

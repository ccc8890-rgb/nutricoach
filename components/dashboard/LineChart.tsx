'use client'
import { memo } from 'react'

interface LineChartPoint {
    label: string
    valor: number
    valor2?: number
    valor3?: number
}

interface LineChartProps {
    data: LineChartPoint[]
    height?: number
    color?: string
    color2?: string
    color3?: string
    showDots?: boolean
    showArea?: boolean
    labels?: { label1: string; label2?: string; label3?: string }
}

const LineChart = memo(function LineChart({
    data,
    height = 120,
    color = '#0D9488',
    color2,
    color3,
    showDots = true,
    showArea = true,
    labels,
}: LineChartProps) {
    if (data.length === 0) return null

    const W = 100
    const H = height
    const padding = 2
    const chartW = W - padding * 2
    const chartH = H - padding * 2

    const todosValores = data.flatMap(d => {
        const vals = [d.valor]
        if (d.valor2 !== undefined) vals.push(d.valor2)
        if (d.valor3 !== undefined) vals.push(d.valor3)
        return vals
    })
    const maxVal = Math.max(...todosValores, 0.1)
    const minVal = 0 // Forzar mínimo a 0 para que el gráfico no se distorsione
    const rango = maxVal - minVal || 1

    function xPos(i: number): number {
        return padding + (i / Math.max(data.length - 1, 1)) * chartW
    }

    function yPos(val: number): number {
        return padding + chartH - ((val - minVal) / rango) * chartH
    }

    function buildPath(vals: number[]): string {
        return vals
            .map((v, i) => `${i === 0 ? 'M' : 'L'}${xPos(i).toFixed(1)},${yPos(v).toFixed(1)}`)
            .join(' ')
    }

    function buildAreaPath(vals: number[]): string {
        if (vals.length === 0) return ''
        const first = `${xPos(0).toFixed(1)},${yPos(0).toFixed(1)}`
        const last = `${xPos(vals.length - 1).toFixed(1)},${yPos(vals[vals.length - 1]).toFixed(1)}`
        const bottomRight = `${xPos(vals.length - 1).toFixed(1)},${H - padding}`
        const bottomLeft = `${padding},${H - padding}`
        return `${first} ${vals
            .slice(1)
            .map((v, i) => `L${xPos(i + 1).toFixed(1)},${yPos(v).toFixed(1)}`)
            .join(' ')} L${bottomRight} L${bottomLeft} Z`
    }

    const valores1 = data.map(d => d.valor)
    const valores2 = color2 ? data.map(d => d.valor2 ?? 0) : undefined
    const valores3 = color3 ? data.map(d => d.valor3 ?? 0) : undefined

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
                {/* Líneas de fondo horizontales */}
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
                            strokeWidth={0.3}
                        />
                    )
                })}

                {/* Área bajo la línea 1 */}
                {showArea && (
                    <path
                        d={buildAreaPath(valores1)}
                        fill={color}
                        opacity={0.08}
                    />
                )}

                {/* Área bajo la línea 2 */}
                {showArea && valores2 && (
                    <path
                        d={buildAreaPath(valores2)}
                        fill={color2}
                        opacity={0.08}
                    />
                )}

                {/* Área bajo la línea 3 */}
                {showArea && valores3 && (
                    <path
                        d={buildAreaPath(valores3)}
                        fill={color3}
                        opacity={0.08}
                    />
                )}

                {/* Línea 1 */}
                <path
                    d={buildPath(valores1)}
                    fill="none"
                    stroke={color}
                    strokeWidth={1.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Línea 2 */}
                {valores2 && (
                    <path
                        d={buildPath(valores2)}
                        fill="none"
                        stroke={color2}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="2 1.5"
                    />
                )}

                {/* Línea 3 */}
                {valores3 && (
                    <path
                        d={buildPath(valores3)}
                        fill="none"
                        stroke={color3}
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="1 2"
                    />
                )}

                {/* Puntos */}
                {showDots && data.map((d, i) => {
                    const y = yPos(d.valor)
                    const x = xPos(i)
                    return (
                        <g key={i}>
                            <circle cx={x} cy={y} r={1.5} fill="white" stroke={color} strokeWidth={0.8} />
                            {d.valor2 !== undefined && color2 && (
                                <circle cx={x} cy={yPos(d.valor2)} r={1.2} fill="white" stroke={color2} strokeWidth={0.8} />
                            )}
                            {d.valor3 !== undefined && color3 && (
                                <circle cx={x} cy={yPos(d.valor3)} r={1.2} fill="white" stroke={color3} strokeWidth={0.8} />
                            )}
                        </g>
                    )
                })}
            </svg>

            {/* Tooltip bottom labels */}
            {data.length <= 14 && (
                <div className="flex justify-between mt-1 text-[9px] px-0.5" style={{ color: 'var(--text-muted)' }}>
                    {data.filter((_, i) => data.length <= 7 || i % 2 === 0 || i === data.length - 1).map((d, i) => (
                        <span key={i} className="truncate">{d.label}</span>
                    ))}
                </div>
            )}

            {/* Leyenda si hay labels */}
            {labels && (
                <div className="flex gap-4 mt-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-0.5 rounded" style={{ background: color }} />
                        <span className="text-gray-500">{labels.label1}</span>
                    </div>
                    {labels.label2 && color2 && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 rounded" style={{ background: color2 }} />
                            <span className="text-gray-500">{labels.label2}</span>
                        </div>
                    )}
                    {labels.label3 && color3 && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-0.5 rounded" style={{ background: color3 }} />
                            <span className="text-gray-500">{labels.label3}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
})

export default LineChart

'use client'

interface Punto {
    fecha: string
    peso: number
}

interface GraficoPesoProps {
    datos: Punto[]
    pesoObjetivo?: number
}

function formatFecha(f: string): string {
    const d = new Date(f + 'T00:00:00')
    return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function GraficoPeso({ datos, pesoObjetivo }: GraficoPesoProps) {
    // Mostrar últimos 10, ordenados de más antiguo a más reciente
    const puntos = [...datos]
        .filter(d => d.peso != null && d.peso > 0)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(-10)

    if (puntos.length < 2) {
        return (
            <div className="text-center py-6">
                <p className="text-sm text-gray-400">
                    Registra al menos 2 pesajes para ver tu evolución
                </p>
            </div>
        )
    }

    const pesos = puntos.map(p => p.peso)
    const allVals = pesoObjetivo ? [...pesos, pesoObjetivo] : pesos
    const minVal = Math.min(...allVals) - 1.5
    const maxVal = Math.max(...allVals) + 1.5
    const rango = maxVal - minVal || 1

    const W = 100
    const H = 60
    const padLeft = 6
    const padRight = 2
    const padTop = 4
    const padBot = 4
    const chartW = W - padLeft - padRight
    const chartH = H - padTop - padBot

    function x(i: number) {
        return padLeft + (i / (puntos.length - 1)) * chartW
    }

    function y(val: number) {
        return padTop + chartH - ((val - minVal) / rango) * chartH
    }

    const linePath = puntos
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`)
        .join(' ')

    const areaPath = `${puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ')} L${x(puntos.length - 1).toFixed(1)},${H - padBot} L${padLeft},${H - padBot} Z`

    const tendencia = puntos.length >= 2
        ? puntos[puntos.length - 1].peso - puntos[0].peso
        : 0

    return (
        <div>
            {/* Cabecera con tendencia */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Evolución del peso</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tendencia < 0 ? 'bg-green-50 text-green-600' : tendencia > 0 ? 'bg-red-50 text-red-400' : 'bg-gray-50 text-gray-400'}`}>
                    {tendencia > 0 ? '+' : ''}{tendencia.toFixed(1)} kg
                </span>
            </div>

            {/* SVG chart */}
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
                {/* Grid lines */}
                {[0, 0.5, 1].map(pct => (
                    <line key={pct}
                        x1={padLeft} y1={padTop + chartH - pct * chartH}
                        x2={W - padRight} y2={padTop + chartH - pct * chartH}
                        stroke="#e5e7eb" strokeWidth={0.4}
                    />
                ))}

                {/* Área */}
                <path d={areaPath} fill="#16a34a" opacity={0.07} />

                {/* Línea objetivo */}
                {pesoObjetivo && (
                    <line
                        x1={padLeft} y1={y(pesoObjetivo)}
                        x2={W - padRight} y2={y(pesoObjetivo)}
                        stroke="#9ca3af" strokeWidth={0.6} strokeDasharray="2 1.5"
                    />
                )}

                {/* Línea principal */}
                <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />

                {/* Puntos */}
                {puntos.map((p, i) => (
                    <g key={i}>
                        <circle cx={x(i)} cy={y(p.peso)} r={2} fill="white" stroke="#16a34a" strokeWidth={1} />
                        <title>{formatFecha(p.fecha)}: {p.peso} kg</title>
                    </g>
                ))}

                {/* Eje Y — min y max */}
                <text x={padLeft - 1} y={padTop + 3} textAnchor="end" fontSize={3.5} fill="#9ca3af">{maxVal.toFixed(0)}</text>
                <text x={padLeft - 1} y={H - padBot} textAnchor="end" fontSize={3.5} fill="#9ca3af">{minVal.toFixed(0)}</text>
            </svg>

            {/* Labels X */}
            <div className="flex justify-between mt-0.5 px-1">
                {puntos.filter((_, i) => puntos.length <= 6 || i % Math.ceil(puntos.length / 5) === 0 || i === puntos.length - 1).map((p, i) => (
                    <span key={i} className="text-[10px] text-gray-400">{formatFecha(p.fecha)}</span>
                ))}
            </div>

            {/* Último peso */}
            <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-bold text-gray-900">{puntos[puntos.length - 1].peso}</span>
                <span className="text-sm text-gray-400">kg ahora</span>
                {pesoObjetivo && (
                    <span className="text-xs text-gray-400 ml-2">
                        · objetivo {pesoObjetivo} kg ({(puntos[puntos.length - 1].peso - pesoObjetivo).toFixed(1)} restantes)
                    </span>
                )}
            </div>
        </div>
    )
}

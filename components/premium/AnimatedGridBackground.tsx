'use client'

import { useEffect, useRef } from 'react'

/**
 * AnimatedGridBackground — fondo con patrón de cuadrícula animado
 * Efecto: líneas de grid que se iluminan sutilmente
 * Inspirado en Magic UI AnimatedGridPattern
 */
interface AnimatedGridBackgroundProps {
    className?: string
    lineColor?: string
    glowColor?: string
    cellSize?: number
}

export function AnimatedGridBackground({
    className = '',
    lineColor,
    glowColor,
    cellSize = 60,
}: AnimatedGridBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        let animationId: number
        let time = 0

        function resize() {
            if (!canvas) return
            canvas.width = canvas.offsetWidth * 2
            canvas.height = canvas.offsetHeight * 2
            canvas.style.width = `${canvas.offsetWidth}px`
            canvas.style.height = `${canvas.offsetHeight}px`
        }

        resize()
        window.addEventListener('resize', resize)

        function draw() {
            if (!canvas || !ctx) return
            time += 0.005

            const w = canvas.width
            const h = canvas.height
            const cellW = cellSize * 2
            const cellH = cellSize * 2

            ctx.clearRect(0, 0, w, h)

            const lineCol = lineColor || 'var(--border)'

            // Draw vertical lines
            for (let x = 0; x <= w; x += cellW) {
                ctx.beginPath()
                ctx.moveTo(x, 0)
                ctx.lineTo(x, h)
                ctx.strokeStyle = lineCol
                ctx.lineWidth = 0.5
                ctx.globalAlpha = 0.3
                ctx.stroke()

                // Glow dots at intersections
                for (let y = 0; y <= h; y += cellH) {
                    const pulse = Math.sin(time + x * 0.01 + y * 0.01) * 0.3 + 0.7
                    const glowCol = glowColor || 'var(--accent-glow)'
                    ctx.beginPath()
                    ctx.arc(x, y, 1.5, 0, Math.PI * 2)
                    ctx.fillStyle = glowCol
                    ctx.globalAlpha = pulse * 0.4
                    ctx.fill()
                }
            }

            // Draw horizontal lines
            for (let y = 0; y <= h; y += cellH) {
                ctx.beginPath()
                ctx.moveTo(0, y)
                ctx.lineTo(w, y)
                ctx.strokeStyle = lineCol
                ctx.lineWidth = 0.5
                ctx.globalAlpha = 0.3
                ctx.stroke()
            }

            animationId = requestAnimationFrame(draw)
        }

        draw()

        return () => {
            cancelAnimationFrame(animationId)
            window.removeEventListener('resize', resize)
        }
    }, [lineColor, glowColor, cellSize])

    return (
        <canvas
            ref={canvasRef}
            className={`absolute inset-0 pointer-events-none ${className}`}
            style={{ opacity: 0.5 }}
        />
    )
}

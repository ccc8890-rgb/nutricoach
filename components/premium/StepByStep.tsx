'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface StepProps {
    number: number
    title?: string
    content: string
    image_url?: string | null
}

interface StepByStepProps {
    pasos: StepProps[]
    className?: string
}

/**
 * StepByStep — Guía de cocina paso a paso estilo acordeón con timeline vertical
 * Cada paso se expande individualmente
 * Sin checkeables — solo navegación secuencial
 */
export function StepByStep({ pasos, className = '' }: StepByStepProps) {
    const [openStep, setOpenStep] = useState<number>(1) // primer paso abierto por defecto

    if (pasos.length === 0) return null

    return (
        <div className={className}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                    Preparación
                </h2>
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {pasos.length} {pasos.length === 1 ? 'paso' : 'pasos'}
                </span>
            </div>

            {/* Timeline vertical */}
            <div className="relative">
                {/* Línea vertical conectora */}
                <div
                    className="absolute left-[15px] top-3 bottom-3 w-0.5 rounded-full"
                    style={{ background: 'var(--border)' }}
                />

                <div className="space-y-2">
                    {pasos.map((paso) => {
                        const isOpen = openStep === paso.number

                        return (
                            <div key={paso.number} className="relative pl-10">
                                {/* Número del paso — dot en timeline */}
                                <button
                                    onClick={() => setOpenStep(isOpen ? 0 : paso.number)}
                                    className="absolute left-0 top-3 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 z-10"
                                    style={{
                                        background: isOpen ? 'var(--accent)' : 'var(--surface)',
                                        color: isOpen ? '#1C1C1E' : 'var(--text-secondary)',
                                        border: `2px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
                                        boxShadow: isOpen ? '0 0 8px var(--accent-glow)' : 'none',
                                    }}
                                >
                                    {paso.number}
                                </button>

                                {/* Card del paso */}
                                <div
                                    className="rounded-xl border overflow-hidden transition-all duration-300"
                                    style={{
                                        background: isOpen ? 'var(--surface)' : 'transparent',
                                        borderColor: isOpen ? 'var(--border-accent)' : 'transparent',
                                    }}
                                >
                                    {/* Header clickeable */}
                                    <button
                                        onClick={() => setOpenStep(isOpen ? 0 : paso.number)}
                                        className="w-full flex items-center justify-between px-4 py-3 text-left"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            {paso.title && (
                                                <span className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
                                                    {paso.title}
                                                </span>
                                            )}
                                            <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                                                Paso {paso.number}
                                            </span>
                                        </div>
                                        <ChevronDown
                                            size={16}
                                            className="transition-transform duration-200 flex-shrink-0"
                                            style={{
                                                transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                                                color: 'var(--text-muted)',
                                            }}
                                        />
                                    </button>

                                    {/* Contenido expandible */}
                                    {isOpen && (
                                        <div className="px-4 pb-4 animate-fade-in">
                                            {paso.image_url && (
                                                <img
                                                    src={paso.image_url}
                                                    alt={paso.title ?? `Paso ${paso.number}`}
                                                    className="w-full h-40 object-cover rounded-lg mb-3"
                                                />
                                            )}
                                            <p
                                                className="text-sm leading-relaxed whitespace-pre-line"
                                                style={{ color: 'var(--text-secondary)' }}
                                            >
                                                {paso.content}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

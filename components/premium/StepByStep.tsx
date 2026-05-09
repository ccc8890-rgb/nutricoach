'use client'

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

export function StepByStep({ pasos, className = '' }: StepByStepProps) {
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
                <div
                    className="absolute left-[15px] top-3 bottom-3 w-0.5 rounded-full"
                    style={{ background: 'var(--border)' }}
                />

                <div className="space-y-4">
                    {pasos.map((paso) => (
                        <div key={paso.number} className="relative pl-10">
                            {/* Dot numerado en timeline */}
                            <div
                                className="absolute left-0 top-2 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold z-10"
                                style={{
                                    background: 'var(--accent)',
                                    color: '#1C1C1E',
                                    border: '2px solid var(--accent)',
                                }}
                            >
                                {paso.number}
                            </div>

                            {/* Contenido del paso */}
                            <div
                                className="rounded-xl border px-4 py-3"
                                style={{
                                    background: 'var(--surface)',
                                    borderColor: 'var(--border)',
                                }}
                            >
                                {paso.title && (
                                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                                        {paso.title}
                                    </p>
                                )}
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
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

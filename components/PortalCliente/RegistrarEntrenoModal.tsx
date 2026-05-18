'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const TIPOS = [
    { value: 'running', label: '🏃 Running' },
    { value: 'gym', label: '🏋️ Gym' },
    { value: 'hyrox', label: '⚡ Hyrox' },
    { value: 'crossfit', label: '🔥 CrossFit' },
    { value: 'ciclismo', label: '🚴 Ciclismo' },
    { value: 'natacion', label: '🏊 Natación' },
    { value: 'trail', label: '⛰️ Trail' },
    { value: 'yoga', label: '🧘 Yoga' },
    { value: 'otro', label: '🎯 Otro' },
]

const RPE_LABELS: Record<number, string> = {
    1: 'Muy suave',
    2: 'Suave',
    3: 'Moderado',
    4: 'Algo difícil',
    5: 'Difícil',
    6: 'Muy difícil',
    7: 'Muy difícil',
    8: 'Extremo',
    9: 'Máximo',
    10: 'Esfuerzo máximo',
}

interface RegistrarEntrenoModalProps {
    codigo: string
    onClose: () => void
    onGuardado: () => void
    sesionNombre?: string
    tipoPreset?: string
}

export default function RegistrarEntrenoModal({ codigo, onClose, onGuardado, sesionNombre, tipoPreset }: RegistrarEntrenoModalProps) {
    const [tipo, setTipo] = useState(tipoPreset ?? 'gym')
    const [duracion, setDuracion] = useState('')
    const [rpe, setRpe] = useState(7)
    const [notas, setNotas] = useState(sesionNombre ? `Sesión: ${sesionNombre}` : '')
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const tls = duracion ? Math.round(Number(duracion) * Math.pow(rpe / 10, 2) * 10) / 10 : 0

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!duracion || Number(duracion) <= 0) {
            setError('Indica la duración del entreno')
            return
        }

        setGuardando(true)
        setError(null)

        try {
            const res = await fetch(`/api/cliente/${codigo}/registrar-entreno`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo_actividad: tipo,
                    duracion_min: Number(duracion),
                    rpe,
                    notas: notas.trim() || null,
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                setError(err.error ?? 'Error al guardar')
                return
            }

            onGuardado()
            onClose()
        } catch {
            setError('Error de conexión')
        } finally {
            setGuardando(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="w-full max-w-md rounded-2xl shadow-xl overflow-hidden"
                style={{ background: 'var(--surface)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b"
                    style={{ borderColor: 'var(--border)' }}>
                    <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>
                        {sesionNombre ? `✓ Marcar sesión como hecha` : 'Registrar entreno'}
                    </h2>
                    <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-5">
                    {/* Tipo de actividad */}
                    <div>
                        <label className="text-xs font-medium mb-2 block" style={{ color: 'var(--text-secondary)' }}>
                            Tipo de actividad
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {TIPOS.map(t => (
                                <button
                                    key={t.value}
                                    type="button"
                                    onClick={() => setTipo(t.value)}
                                    className="py-2 px-1 rounded-xl text-xs font-medium text-center transition-all"
                                    style={{
                                        background: tipo === t.value ? 'var(--primary)' : 'var(--bg)',
                                        color: tipo === t.value ? 'white' : 'var(--text)',
                                        border: `1px solid ${tipo === t.value ? 'var(--primary)' : 'var(--border)'}`,
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duración */}
                    <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Duración (minutos)
                        </label>
                        <input
                            type="number"
                            className="input w-full"
                            placeholder="Ej: 60"
                            min="1"
                            max="600"
                            value={duracion}
                            onChange={e => setDuracion(e.target.value)}
                        />
                    </div>

                    {/* RPE */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                RPE (esfuerzo percibido)
                            </label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{rpe}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>/10</span>
                            </div>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="10"
                            step="1"
                            value={rpe}
                            onChange={e => setRpe(Number(e.target.value))}
                            className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            <span>Suave</span>
                            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                {RPE_LABELS[rpe]}
                            </span>
                            <span>Máximo</span>
                        </div>
                    </div>

                    {/* TLS calculado */}
                    {tls > 0 && (
                        <div className="rounded-xl p-3 text-center"
                            style={{ background: 'var(--primary-bg, #EFF6FF)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Carga de esta sesión</p>
                            <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{tls} pts</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {duracion} min × (RPE {rpe}/10)²
                            </p>
                        </div>
                    )}

                    {/* Notas */}
                    <div>
                        <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                            Notas (opcional)
                        </label>
                        <textarea
                            className="input w-full resize-none"
                            rows={2}
                            placeholder="Cómo te has sentido, detalles del entreno..."
                            value={notas}
                            onChange={e => setNotas(e.target.value)}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-center" style={{ color: 'var(--error)' }}>{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={guardando}
                        className="btn-primary w-full flex items-center justify-center gap-2"
                    >
                        {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
                        {guardando ? 'Guardando...' : 'Guardar entreno'}
                    </button>
                </form>
            </div>
        </div>
    )
}

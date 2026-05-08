'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Loader2, Send, Clock, Flame, ClipboardCheck } from 'lucide-react'

interface CheckInFormProps {
    codigo: string
    onCheckinCreado: () => void
    ultimoCheckin?: {
        id: string
        fecha: string
        peso?: number
        adherencia?: number
        energia?: number
        sueno?: number
    } | null
}

const EMOTICONOS = ['😞', '😐', '🙂', '😊', '🔥']

/* ── Helper: racha de check-ins ── */
function calcularRacha(checkins: { fecha: string }[]): number {
    if (!checkins || checkins.length === 0) return 0
    const sorted = [...checkins]
        .map(c => new Date(c.fecha))
        .sort((a, b) => b.getTime() - a.getTime())

    let racha = 1
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const diffHoy = Math.floor((hoy.getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24))
    if (diffHoy > 2) return 0

    for (let i = 1; i < sorted.length; i++) {
        const diff = Math.floor((sorted[i - 1].getTime() - sorted[i].getTime()) / (1000 * 60 * 60 * 24))
        if (diff === 1) racha++
        else break
    }
    return racha
}

export default function CheckInForm({ codigo, onCheckinCreado, ultimoCheckin }: CheckInFormProps) {
    const [peso, setPeso] = useState('')
    const [adherencia, setAdherencia] = useState(5)
    const [energia, setEnergia] = useState(5)
    const [sueno, setSueno] = useState(5)
    const [notas, setNotas] = useState('')
    const [guardando, setGuardando] = useState(false)
    const { addToast } = useToast()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!peso) {
            addToast({ type: 'warning', title: 'Peso requerido', message: 'Introduce tu peso para hacer check-in' })
            return
        }
        setGuardando(true)
        try {
            const res = await fetch(`/api/cliente/${codigo}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    peso: parseFloat(peso),
                    adherencia,
                    energia,
                    sueno,
                    notas: notas || null,
                }),
            })
            if (!res.ok) throw new Error('Error al guardar')
            addToast({ type: 'success', title: '¡Check-in completado!', message: 'Tu progreso ha sido registrado' })
            setPeso('')
            setAdherencia(5)
            setEnergia(5)
            setSueno(5)
            setNotas('')
            onCheckinCreado()
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar el check-in' })
        } finally {
            setGuardando(false)
        }
    }

    function SliderGroup({
        label,
        value,
        onChange,
        leftLabel,
        rightLabel,
    }: {
        label: string
        value: number
        onChange: (v: number) => void
        leftLabel: string
        rightLabel: string
    }) {
        return (
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <label className="!mb-0 text-sm">{label}</label>
                    <span className="text-lg">{EMOTICONOS[Math.min(value - 1, 4)]}</span>
                </div>
                <input
                    type="range"
                    min="1"
                    max="10"
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="w-full accent-teal-500"
                    style={{ accentColor: '#0D9488' }}
                />
                <div className="flex justify-between text-xs text-gray-400">
                    <span>{leftLabel}</span>
                    <span>{rightLabel}</span>
                </div>
            </div>
        )
    }

    // Determinar si hoy ya hizo check-in
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const yaHizoCheckinHoy = ultimoCheckin && new Date(ultimoCheckin.fecha) >= hoy
    const diasSinCheckin = ultimoCheckin
        ? Math.floor((hoy.getTime() - new Date(ultimoCheckin.fecha).getTime()) / (1000 * 60 * 60 * 24))
        : null

    return (
        <div className="space-y-4">
            {/* Último check-in (si existe) */}
            {ultimoCheckin && (
                <div className="card !p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <ClipboardCheck size={16} style={{ color: '#0D9488' }} />
                        <h3 className="font-semibold text-gray-900 text-sm">Último check-in</h3>
                        <span className="text-xs text-gray-400 ml-auto">
                            {new Date(ultimoCheckin.fecha).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'short',
                            })}
                        </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-gray-500">Peso</p>
                            <p className="text-sm font-bold text-gray-800">{ultimoCheckin.peso?.toFixed(1)} kg</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-gray-500">Adherencia</p>
                            <p className="text-sm font-bold text-gray-800">{ultimoCheckin.adherencia}/10</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-gray-500">Energía</p>
                            <p className="text-sm font-bold text-gray-800">{ultimoCheckin.energia}/10</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-gray-500">Sueño</p>
                            <p className="text-sm font-bold text-gray-800">{ultimoCheckin.sueno}/10</p>
                        </div>
                    </div>
                    {diasSinCheckin !== null && !yaHizoCheckinHoy && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <Clock size={12} className={diasSinCheckin > 2 ? 'text-red-500' : ''} style={{ color: diasSinCheckin > 2 ? undefined : '#A1A1A6' }} />
                            <span className={diasSinCheckin > 2 ? 'text-red-500' : ''} style={{ color: diasSinCheckin > 2 ? undefined : '#A1A1A6' }}>
                                {diasSinCheckin === 0 ? 'Hoy aún no registras' :
                                    diasSinCheckin === 1 ? 'Ayer fue tu último check-in' :
                                        `Hace ${diasSinCheckin} días sin check-in`}
                            </span>
                        </div>
                    )}
                    {yaHizoCheckinHoy && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                            <Flame size={12} />
                            <span>Check-in completado hoy</span>
                        </div>
                    )}
                </div>
            )}

            {/* Formulario de check-in */}
            <form onSubmit={handleSubmit} className="card space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-gray-900 text-lg">📋 Check-in semanal</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Cuéntame cómo fue tu semana</p>
                    </div>
                    {yaHizoCheckinHoy && (
                        <span className="badge badge-success text-xs">Completado hoy</span>
                    )}
                </div>

                {/* Peso */}
                <div>
                    <label className="text-sm font-medium text-gray-700">Peso actual</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="number"
                            step="0.1"
                            className="input"
                            placeholder="Ej: 74.5"
                            value={peso}
                            onChange={e => setPeso(e.target.value)}
                        />
                        <span className="text-gray-500 font-medium">kg</span>
                    </div>
                </div>

                {/* Sliders */}
                <SliderGroup
                    label="🥗 Adherencia a la dieta"
                    value={adherencia}
                    onChange={setAdherencia}
                    leftLabel="Mal"
                    rightLabel="Perfecta"
                />

                <SliderGroup
                    label="⚡ Nivel de energía"
                    value={energia}
                    onChange={setEnergia}
                    leftLabel="Baja"
                    rightLabel="Alta"
                />

                <SliderGroup
                    label="😴 Calidad del sueño"
                    value={sueno}
                    onChange={setSueno}
                    leftLabel="Mala"
                    rightLabel="Excelente"
                />

                {/* Notas */}
                <div>
                    <label className="text-sm font-medium text-gray-700">Notas (opcional)</label>
                    <textarea
                        className="input mt-1"
                        placeholder="¿Cómo te sientes? ¿Alguna molestia? ¿Dudas?..."
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                        rows={3}
                    />
                </div>

                <button type="submit" className="btn btn-primary w-full justify-center" disabled={guardando || !!yaHizoCheckinHoy}>
                    {guardando ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Send size={18} />
                    )}
                    {guardando ? 'Guardando...' : yaHizoCheckinHoy ? 'Check-in de hoy ya completado' : 'Enviar check-in'}
                </button>
            </form>
        </div>
    )
}

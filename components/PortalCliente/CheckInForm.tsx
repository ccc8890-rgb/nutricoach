'use client'

import { useState, useRef } from 'react'
import { useToast } from '@/components/ui/Toast'
import { Loader2, Send, Clock, Flame, ClipboardCheck, Camera, X, ChevronRight } from 'lucide-react'

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

interface SliderGroupProps {
    label: string
    value: number
    onChange: (v: number) => void
    leftLabel: string
    rightLabel: string
}

function SliderGroup({ label, value, onChange, leftLabel, rightLabel }: SliderGroupProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="!mb-0 text-sm">{label}</label>
                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>{value}/10</span>
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

export default function CheckInForm({ codigo, onCheckinCreado, ultimoCheckin }: CheckInFormProps) {
    const [peso, setPeso] = useState('')
    const [adherencia, setAdherencia] = useState(5)
    const [energia, setEnergia] = useState(5)
    const [sueno, setSueno] = useState(5)
    const [notas, setNotas] = useState('')
    const [foto, setFoto] = useState<File | null>(null)
    const [fotoPreview, setFotoPreview] = useState<string | null>(null)
    const [guardando, setGuardando] = useState(false)
    const [mostrarMedidas, setMostrarMedidas] = useState(false)
    const [cintura, setCintura] = useState('')
    const [cadera, setCadera] = useState('')
    const [pecho, setPecho] = useState('')
    const [brazo, setBrazo] = useState('')
    const [muslo, setMuslo] = useState('')
    const [mostrarDatosDispositivo, setMostrarDatosDispositivo] = useState(false)
    const [pasosManual, setPasosManual] = useState('')
    const [kcalQuemadasManual, setKcalQuemadasManual] = useState('')
    const [hrvManual, setHrvManual] = useState('')
    const fotoInputRef = useRef<HTMLInputElement>(null)
    const { addToast } = useToast()

    function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null
        setFoto(file)
        if (file) {
            const url = URL.createObjectURL(file)
            setFotoPreview(url)
        } else {
            setFotoPreview(null)
        }
    }

    function quitarFoto() {
        setFoto(null)
        setFotoPreview(null)
        if (fotoInputRef.current) fotoInputRef.current.value = ''
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!peso) {
            addToast({ type: 'warning', title: 'Peso requerido', message: 'Introduce tu peso para hacer check-in' })
            return
        }
        setGuardando(true)
        try {
            // 1. Subir foto si hay una seleccionada
            let foto_url: string | null = null
            if (foto) {
                const fd = new FormData()
                fd.append('file', foto)
                const uploadRes = await fetch(`/api/cliente/${codigo}/subir-foto-progreso`, {
                    method: 'POST',
                    body: fd,
                })
                if (uploadRes.ok) {
                    const { url } = await uploadRes.json()
                    foto_url = url
                }
            }

            // 2. Guardar check-in
            const res = await fetch(`/api/cliente/${codigo}/checkin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    peso: parseFloat(peso),
                    adherencia,
                    energia,
                    sueno,
                    notas: notas || null,
                    foto_url,
                    cintura_cm: cintura ? parseFloat(cintura) : null,
                    cadera_cm: cadera ? parseFloat(cadera) : null,
                    pecho_cm: pecho ? parseFloat(pecho) : null,
                    brazo_cm: brazo ? parseFloat(brazo) : null,
                    muslo_cm: muslo ? parseFloat(muslo) : null,
                    ...(pasosManual ? { pasos_manual: parseInt(pasosManual) } : {}),
                    ...(kcalQuemadasManual ? { calorias_activas_manual: parseInt(kcalQuemadasManual) } : {}),
                    ...(hrvManual ? { hrv_manual: parseFloat(hrvManual) } : {}),
                }),
            })
            if (!res.ok) throw new Error('Error al guardar')
            addToast({ type: 'success', title: '¡Check-in completado!', message: 'Tu progreso ha sido registrado' })
            setPeso('')
            setAdherencia(5)
            setEnergia(5)
            setSueno(5)
            setNotas('')
            quitarFoto()
            onCheckinCreado()
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar el check-in' })
        } finally {
            setGuardando(false)
        }
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
                        <h3 className="font-semibold text-[var(--text)] text-sm">Último check-in</h3>
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
                            <p className="text-xs text-[var(--text-muted)]">Peso</p>
                            <p className="text-sm font-bold text-[var(--text)]">{ultimoCheckin.peso?.toFixed(1)} kg</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-[var(--text-muted)]">Adherencia</p>
                            <p className="text-sm font-bold text-[var(--text)]">{ultimoCheckin.adherencia}/10</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-[var(--text-muted)]">Energía</p>
                            <p className="text-sm font-bold text-[var(--text)]">{ultimoCheckin.energia}/10</p>
                        </div>
                        <div className="text-center p-2 rounded-lg" style={{ background: '#F8FAFC' }}>
                            <p className="text-xs text-[var(--text-muted)]">Sueño</p>
                            <p className="text-sm font-bold text-[var(--text)]">{ultimoCheckin.sueno}/10</p>
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
                        <h2 className="font-semibold text-[var(--text)] text-lg">Check-in semanal</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">Cuéntame cómo fue tu semana</p>
                    </div>
                    {yaHizoCheckinHoy && (
                        <span className="badge badge-success text-xs">Completado hoy</span>
                    )}
                </div>

                {/* Peso */}
                <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Peso actual</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="number"
                            step="0.1"
                            className="input"
                            placeholder="Ej: 74.5"
                            value={peso}
                            onChange={e => setPeso(e.target.value)}
                        />
                        <span className="text-[var(--text-muted)] font-medium">kg</span>
                    </div>
                </div>

                {/* Sliders */}
                <SliderGroup
                    label="Adherencia a la dieta"
                    value={adherencia}
                    onChange={setAdherencia}
                    leftLabel="Mal"
                    rightLabel="Perfecta"
                />

                <SliderGroup
                    label="Nivel de energía"
                    value={energia}
                    onChange={setEnergia}
                    leftLabel="Baja"
                    rightLabel="Alta"
                />

                <SliderGroup
                    label="Calidad del sueño"
                    value={sueno}
                    onChange={setSueno}
                    leftLabel="Mala"
                    rightLabel="Excelente"
                />

                {/* Notas */}
                <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Notas (opcional)</label>
                    <textarea
                        className="input mt-1"
                        placeholder="¿Cómo te sientes? ¿Alguna molestia? ¿Dudas?..."
                        value={notas}
                        onChange={e => setNotas(e.target.value)}
                        rows={3}
                    />
                </div>

                {/* Foto de progreso */}
                <div>
                    <label className="text-sm font-medium text-[var(--text-secondary)]">Foto de progreso (opcional)</label>
                    <p className="text-xs text-gray-400 mb-2">Solo la ve tu coach</p>
                    {fotoPreview ? (
                        <div className="relative inline-block">
                            <img
                                src={fotoPreview}
                                alt="Vista previa"
                                className="h-32 w-32 object-cover rounded-xl border"
                                style={{ borderColor: 'var(--border)' }}
                            />
                            <button
                                type="button"
                                onClick={quitarFoto}
                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fotoInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#0D9488'; (e.currentTarget as HTMLButtonElement).style.color = '#0D9488' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)' }}
                        >
                            <Camera size={16} />
                            Añadir foto
                        </button>
                    )}
                    <input
                        ref={fotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handleFotoChange}
                    />
                </div>

                {/* Medidas corporales (opcional) — colapsable */}
                <div>
                    <button
                        type="button"
                        onClick={() => setMostrarMedidas(!mostrarMedidas)}
                        className="flex items-center gap-2 w-full text-sm font-medium text-[var(--text-secondary)] py-2"
                    >
                        <ChevronRight size={14} style={{ transform: mostrarMedidas ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        Medidas corporales (opcional)
                    </button>
                    {mostrarMedidas && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                                <label className="text-xs text-[var(--text-muted)]">Cintura (cm)</label>
                                <input type="number" step="0.1" className="input mt-1" placeholder="Ej: 78" value={cintura} onChange={e => setCintura(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)]">Cadera (cm)</label>
                                <input type="number" step="0.1" className="input mt-1" placeholder="Ej: 94" value={cadera} onChange={e => setCadera(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)]">Pecho (cm)</label>
                                <input type="number" step="0.1" className="input mt-1" placeholder="Ej: 100" value={pecho} onChange={e => setPecho(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)]">Brazo (cm)</label>
                                <input type="number" step="0.1" className="input mt-1" placeholder="Ej: 35" value={brazo} onChange={e => setBrazo(e.target.value)} />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-[var(--text-muted)]">Muslo (cm)</label>
                                <input type="number" step="0.1" className="input mt-1" placeholder="Ej: 55" value={muslo} onChange={e => setMuslo(e.target.value)} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Datos opcionales de dispositivo */}
                <div>
                    <button
                        type="button"
                        onClick={() => setMostrarDatosDispositivo(v => !v)}
                        className="text-sm text-[var(--text-muted)] underline"
                    >
                        {mostrarDatosDispositivo ? '▲ Ocultar datos de dispositivo' : '▼ Añadir datos de dispositivo (opcional)'}
                    </button>
                    {mostrarDatosDispositivo && (
                        <div className="mt-3 space-y-3 border border-[var(--border)] rounded-xl p-3">
                            <p className="text-xs text-[var(--text-muted)]">
                                Si no tienes vinculado tu dispositivo, puedes introducir los datos manualmente.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-xs text-[var(--text-muted)]">Pasos</label>
                                    <input type="number" className="input mt-1 text-sm" placeholder="8500" autoComplete="off"
                                        value={pasosManual} onChange={e => setPasosManual(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)]">Kcal quemadas</label>
                                    <input type="number" className="input mt-1 text-sm" placeholder="450" autoComplete="off"
                                        value={kcalQuemadasManual} onChange={e => setKcalQuemadasManual(e.target.value)} />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)]">HRV (ms)</label>
                                    <input type="number" className="input mt-1 text-sm" placeholder="65" autoComplete="off"
                                        value={hrvManual} onChange={e => setHrvManual(e.target.value)} />
                                </div>
                            </div>
                        </div>
                    )}
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

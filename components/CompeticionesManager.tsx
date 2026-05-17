'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Calendar, Trophy, Loader2, AlertTriangle } from 'lucide-react'
import { DISCIPLINA_LABELS, FASE_LABELS, FASE_COLORES, getMacrosPorFase } from '@/lib/alto-rendimiento/macros-por-fase'
import type { FaseDeportiva, Disciplina } from '@/lib/alto-rendimiento/macros-por-fase'

interface Competicion {
    id: string
    nombre: string
    disciplina: string
    fecha_competicion: string
    objetivo: string
    tiempo_objetivo_min: number | null
    notas: string | null
}

interface FaseActiva {
    competicion_id: string
    competicion_nombre: string
    disciplina: string
    fecha_competicion: string
    dias_restantes: number
    fase_actual: FaseDeportiva
    alerta_tapering_activa: boolean
}

interface Props {
    clienteId: string
    pesoKg?: number
}

const DISCIPLINAS = Object.entries(DISCIPLINA_LABELS) as [Disciplina, string][]
const OBJETIVOS = [
    { value: 'completar', label: 'Completar' },
    { value: 'tiempo_objetivo', label: 'Tiempo objetivo' },
    { value: 'podio_categoria', label: 'Podio en categoría' },
]

const FORM_VACIO = {
    nombre: '',
    disciplina: 'running_hm' as Disciplina,
    fecha_competicion: '',
    objetivo: 'completar',
    tiempo_objetivo_min: '',
    notas: '',
}

export default function CompeticionesManager({ clienteId, pesoKg }: Props) {
    const [competiciones, setCompeticiones] = useState<Competicion[]>([])
    const [faseActiva, setFaseActiva] = useState<FaseActiva | null>(null)
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/clientes/${clienteId}/fase-deportiva`)
            if (!res.ok) return
            const data = await res.json()
            setCompeticiones(data.competiciones ?? [])
            setFaseActiva(data.fase_activa ?? null)
        } catch {
            // silencioso — no es crítico
        } finally {
            setLoading(false)
        }
    }, [clienteId])

    useEffect(() => { load() }, [load])

    async function handleGuardar(e: React.FormEvent) {
        e.preventDefault()
        if (!form.nombre || !form.fecha_competicion) {
            setError('Nombre y fecha son obligatorios')
            return
        }
        setGuardando(true)
        setError(null)
        try {
            const res = await fetch(`/api/clientes/${clienteId}/fase-deportiva`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    tiempo_objetivo_min: form.tiempo_objetivo_min ? Number(form.tiempo_objetivo_min) : null,
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                setError(err.error ?? 'Error al guardar')
                return
            }
            setForm(FORM_VACIO)
            setShowForm(false)
            load()
        } catch {
            setError('Error de conexión')
        } finally {
            setGuardando(false)
        }
    }

    async function handleEliminar(id: string) {
        if (!confirm('¿Eliminar esta competición?')) return
        await fetch(`/api/clientes/${clienteId}/fase-deportiva?competicion_id=${id}`, { method: 'DELETE' })
        load()
    }

    if (loading) {
        return <div className="card p-6 animate-pulse h-32" style={{ background: 'var(--surface)' }} />
    }

    return (
        <div className="space-y-4">
            {/* Fase deportiva activa */}
            {faseActiva && (
                <FaseDeportivaCard fase={faseActiva} pesoKg={pesoKg} />
            )}

            {/* Lista de competiciones */}
            <div className="card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                        <Trophy size={15} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            Competiciones
                        </span>
                        {competiciones.length > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                                {competiciones.length}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => setShowForm(s => !s)}
                        className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg"
                        style={{ background: 'var(--primary)', color: 'white' }}
                    >
                        <Plus size={13} />
                        Añadir
                    </button>
                </div>

                {/* Formulario */}
                {showForm && (
                    <form onSubmit={handleGuardar} className="p-4 border-b space-y-3"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)' }}>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Nombre de la prueba
                                </label>
                                <input className="input w-full" placeholder="Ej: Hyrox Madrid 2026"
                                    value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Disciplina
                                </label>
                                <select className="input w-full" value={form.disciplina}
                                    onChange={e => setForm(f => ({ ...f, disciplina: e.target.value as Disciplina }))}>
                                    {DISCIPLINAS.map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Fecha
                                </label>
                                <input type="date" className="input w-full"
                                    value={form.fecha_competicion}
                                    onChange={e => setForm(f => ({ ...f, fecha_competicion: e.target.value }))} />
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Objetivo
                                </label>
                                <select className="input w-full" value={form.objetivo}
                                    onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))}>
                                    {OBJETIVOS.map(o => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </div>
                            {form.objetivo === 'tiempo_objetivo' && (
                                <div>
                                    <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                        Tiempo objetivo (min)
                                    </label>
                                    <input type="number" className="input w-full" placeholder="Ej: 90"
                                        value={form.tiempo_objetivo_min}
                                        onChange={e => setForm(f => ({ ...f, tiempo_objetivo_min: e.target.value }))} />
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Notas (opcional)
                                </label>
                                <input className="input w-full" placeholder="Perfil del recorrido, condiciones..."
                                    value={form.notas}
                                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                            </div>
                        </div>
                        {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => { setShowForm(false); setError(null) }}
                                className="btn-secondary text-xs px-3 py-1.5">Cancelar</button>
                            <button type="submit" disabled={guardando}
                                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1">
                                {guardando && <Loader2 size={12} className="animate-spin" />}
                                Guardar
                            </button>
                        </div>
                    </form>
                )}

                {/* Lista */}
                {competiciones.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                        <Calendar size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Sin competiciones registradas
                        </p>
                    </div>
                ) : (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {competiciones.map(c => {
                            const dias = Math.ceil((new Date(c.fecha_competicion).getTime() - Date.now()) / 86400000)
                            return (
                                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                                            {c.nombre}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                            {DISCIPLINA_LABELS[c.disciplina as Disciplina] ?? c.disciplina}
                                            {' · '}
                                            {new Date(c.fecha_competicion).toLocaleDateString('es-ES', {
                                                day: 'numeric', month: 'short', year: 'numeric'
                                            })}
                                            {dias > 0 && (
                                                <span style={{ color: 'var(--text-muted)' }}> · {dias}d</span>
                                            )}
                                        </p>
                                    </div>
                                    <button onClick={() => handleEliminar(c.id)}
                                        className="p-1.5 rounded-lg flex-shrink-0"
                                        style={{ color: 'var(--text-muted)' }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── FaseDeportivaCard (inline) ──────────────────────────────────
function FaseDeportivaCard({ fase, pesoKg }: { fase: FaseActiva; pesoKg?: number }) {
    const cfg = FASE_COLORES[fase.fase_actual]
    const macros = pesoKg ? getMacrosPorFase(fase.disciplina, fase.fase_actual) : null

    return (
        <div className="card overflow-hidden">
            {/* Alerta tapering */}
            {fase.alerta_tapering_activa && (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                    style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
                    <AlertTriangle size={15} />
                    <span>⚠️ Semana de TAPERING — mantener o aumentar CHO. No reducir.</span>
                </div>
            )}

            <div className="px-4 py-3" style={{ background: cfg.bg }}>
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs font-medium mb-0.5" style={{ color: cfg.text }}>
                            Fase actual
                        </p>
                        <p className="text-xl font-bold" style={{ color: cfg.text }}>
                            {FASE_LABELS[fase.fase_actual]}
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: cfg.text, opacity: 0.8 }}>
                            {fase.competicion_nombre}
                            {' · '}
                            {fase.dias_restantes > 0
                                ? `${fase.dias_restantes} días`
                                : fase.dias_restantes === 0
                                    ? '¡Hoy!'
                                    : `${Math.abs(fase.dias_restantes)}d post-carrera`}
                        </p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: 'rgba(0,0,0,0.08)', color: cfg.text }}>
                        {DISCIPLINA_LABELS[fase.disciplina as Disciplina] ?? fase.disciplina}
                    </span>
                </div>

                {/* Macros recomendados */}
                {macros && pesoKg && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                        {[
                            { label: 'CHO', value: `${(macros.cho_gkg * pesoKg).toFixed(0)}g`, sub: `${macros.cho_gkg}g/kg` },
                            { label: 'Prot', value: `${(macros.prot_gkg * pesoKg).toFixed(0)}g`, sub: `${macros.prot_gkg}g/kg` },
                            { label: 'Grasa', value: `${(macros.grasa_gkg * pesoKg).toFixed(0)}g`, sub: `${macros.grasa_gkg}g/kg` },
                        ].map(m => (
                            <div key={m.label} className="rounded-xl p-2 text-center"
                                style={{ background: 'rgba(255,255,255,0.5)' }}>
                                <p className="text-xs font-medium" style={{ color: cfg.text, opacity: 0.7 }}>{m.label}</p>
                                <p className="text-base font-bold" style={{ color: cfg.text }}>{m.value}</p>
                                <p className="text-[10px]" style={{ color: cfg.text, opacity: 0.6 }}>{m.sub}</p>
                            </div>
                        ))}
                    </div>
                )}
                {!pesoKg && macros && (
                    <p className="text-xs mt-2" style={{ color: cfg.text, opacity: 0.7 }}>
                        CHO: {macros.cho_gkg}g/kg · Prot: {macros.prot_gkg}g/kg · Grasa: {macros.grasa_gkg}g/kg
                        <br />
                        <span style={{ opacity: 0.6 }}>Añade el peso del cliente para ver valores absolutos</span>
                    </p>
                )}
            </div>
        </div>
    )
}

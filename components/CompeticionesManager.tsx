'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Calendar, Trophy, Loader2, AlertTriangle } from 'lucide-react'
import { DISCIPLINA_LABELS, FASE_LABELS, FASE_COLORES } from '@/lib/alto-rendimiento/macros-por-fase'
import type { FaseDeportiva, Disciplina } from '@/lib/alto-rendimiento/macros-por-fase'

interface Competicion {
    id: string
    nombre: string
    disciplina: string
    fecha_competicion: string
    objetivo: string
    tiempo_objetivo_min: number | null
    notas: string | null
    prioridad?: 'A' | 'B' | 'C'
    estado?: 'confirmada' | 'posible'
}

interface TramoAnual { desde: string; hasta: string; fase: string; semanas: number; objetivo: string | null }

const FASES_ANUALES: Record<string, string> = {
    base: 'Base', fuerza: 'Fuerza', resistencia: 'Resistencia', afinado: 'Afinado', carrera: 'Semana de la prueba', recuperacion: 'Recuperación', mantenimiento: 'Mantenimiento',
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

interface ObjetivoHoy {
    kcal: number; p: number; c: number; g: number
    label: string | null; consejo: string | null; peso_kg: number | null
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
    prioridad: 'A',
    estado: 'confirmada',
}

export default function CompeticionesManager({ clienteId, pesoKg }: Props) {
    const [competiciones, setCompeticiones] = useState<Competicion[]>([])
    const [faseActiva, setFaseActiva] = useState<FaseActiva | null>(null)
    const [objetivoHoy, setObjetivoHoy] = useState<ObjetivoHoy | null>(null)
    const [planAnual, setPlanAnual] = useState<TramoAnual[]>([])
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
            setObjetivoHoy(data.objetivo_hoy ?? null)
            setPlanAnual(data.plan_anual ?? [])
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

    async function cambiar(id: string, cambios: { prioridad?: string; estado?: string }) {
        await fetch(`/api/clientes/${clienteId}/fase-deportiva`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ competicion_id: id, ...cambios }) })
        load()
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
        <div className="coach-competition-manager space-y-4">
            {/* Fase deportiva activa */}
            {faseActiva && (
                <FaseDeportivaCard fase={faseActiva} objetivo={objetivoHoy} pesoKg={pesoKg} />
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
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Prioridad
                                </label>
                                <select className="input w-full" value={form.prioridad}
                                    onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                                    <option value="A">A · objetivo principal</option>
                                    <option value="B">B · secundaria (mini-pico)</option>
                                    <option value="C">C · de paso (no cambia el plan)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium block mb-1" style={{ color: 'var(--text-secondary)' }}>
                                    Estado
                                </label>
                                <select className="input w-full" value={form.estado}
                                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                                    <option value="confirmada">Confirmada (inscrito)</option>
                                    <option value="posible">Posible (planificar por si acaso)</option>
                                </select>
                            </div>
                            {form.estado === 'posible' && (
                                <p className="col-span-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Una prueba posible orienta el entrenamiento del año, pero no cambia la dieta (sin tapering ni carga de hidratos) hasta que la confirmes.
                                </p>
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
                                            <span style={{ color: 'var(--text-muted)' }}> · prioridad {c.prioridad ?? 'A'} · {c.estado === 'posible' ? 'posible' : 'confirmada'}</span>
                                        </p>
                                    </div>
                                    {c.estado === 'posible' && (
                                        <button onClick={() => cambiar(c.id, { estado: 'confirmada' })}
                                            className="text-xs font-medium px-2 py-1 rounded-lg flex-shrink-0"
                                            style={{ background: 'var(--primary-bg)', color: 'var(--primary)' }}>
                                            Confirmar
                                        </button>
                                    )}
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

            {/* Plan del año: fase de cada tramo según los objetivos A/B */}
            {planAnual.length > 0 && competiciones.some(c => (c.prioridad ?? 'A') !== 'C') && (
                <div className="card overflow-hidden">
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Plan del año</span>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Fases aproximadas hacia tus objetivos A y B. Se recalcula si cambias fechas o prioridades.</p>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                        {planAnual.slice(0, 14).map(t => (
                            <div key={t.desde} className="flex items-center gap-3 px-4 py-2 text-sm">
                                <span className="w-40 flex-shrink-0 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                                    {new Date(t.desde).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {new Date(t.hasta).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                </span>
                                <span className="font-medium" style={{ color: 'var(--text)' }}>{FASES_ANUALES[t.fase] ?? t.fase}</span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.semanas} sem{t.objetivo ? ` · ${t.objetivo}` : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── FaseDeportivaCard (inline) ──────────────────────────────────
function FaseDeportivaCard({ fase, objetivo, pesoKg }: { fase: FaseActiva; objetivo: ObjetivoHoy | null; pesoKg?: number }) {
    const cfg = FASE_COLORES[fase.fase_actual]
    // Objetivo de HOY calculado por el mismo motor que el planificador de dieta
    const peso = objetivo?.peso_kg ?? pesoKg ?? null
    const porKg = (g: number) => (peso ? `${(g / peso).toFixed(1)}g/kg` : '')

    return (
        <div className="card overflow-hidden">
            {/* Alerta tapering */}
            {(fase.fase_actual === 'tapering' || fase.fase_actual === 'carrera_inminente') && (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium"
                    style={{ background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #FDE68A' }}>
                    <AlertTriangle size={15} />
                    <span>⚠️ TAPERING — menos volumen de entreno, pero mantén los hidratos por kilo de peso; la carga fuerte se hace solo en las últimas 36-48 h.</span>
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

                {/* Objetivo de hoy (mismo motor que el planificador) */}
                {objetivo ? (
                    <>
                        <div className="mt-3 grid grid-cols-4 gap-2">
                            {[
                                { label: 'kcal', value: `${objetivo.kcal}`, sub: '' },
                                { label: 'CHO', value: `${objetivo.c}g`, sub: porKg(objetivo.c) },
                                { label: 'Prot', value: `${objetivo.p}g`, sub: porKg(objetivo.p) },
                                { label: 'Grasa', value: `${objetivo.g}g`, sub: porKg(objetivo.g) },
                            ].map(m => (
                                <div key={m.label} className="rounded-xl p-2 text-center"
                                    style={{ background: 'rgba(255,255,255,0.5)' }}>
                                    <p className="text-xs font-medium" style={{ color: cfg.text, opacity: 0.7 }}>{m.label}</p>
                                    <p className="text-base font-bold" style={{ color: cfg.text }}>{m.value}</p>
                                    <p className="text-[10px]" style={{ color: cfg.text, opacity: 0.6 }}>{m.sub}</p>
                                </div>
                            ))}
                        </div>
                        {(objetivo.label || objetivo.consejo) && (
                            <p className="text-xs mt-2" style={{ color: cfg.text, opacity: 0.8 }}>
                                <b>Hoy{objetivo.label ? ` · ${objetivo.label}` : ''}.</b> {objetivo.consejo}
                            </p>
                        )}
                    </>
                ) : (
                    <p className="text-xs mt-2" style={{ color: cfg.text, opacity: 0.7 }}>
                        Sin plan de dieta activo: no hay objetivo de hoy que mostrar.
                    </p>
                )}
            </div>
        </div>
    )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDebounce } from '@/lib/useDebounce'
import { Plus, LayoutTemplate, Search, Loader2, Pencil, Trash2, FlaskConical, Zap, Timer } from 'lucide-react'
import type { PlantillaDieta, PlantillaDietaTipo } from '@/types'
import { PLANTILLA_DIETA_TIPO_LABELS } from '@/types'

const TIPO_ICON: Record<PlantillaDietaTipo, typeof Zap> = {
    normal: LayoutTemplate,
    carga: Zap,
    suplementos: Timer,
}

const TIPO_COLOR: Record<PlantillaDietaTipo, string> = {
    normal: '#1C1C1E',
    carga: '#A1A1A6',
    suplementos: '#3B82F6',
}

const TIPO_BG: Record<PlantillaDietaTipo, string> = {
    normal: '#F2F2F7',
    carga: 'rgba(161,161,166,0.08)',
    suplementos: '#EFF6FF',
}
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'

interface PlantillaForm {
    nombre: string
    descripcion: string
    kcal_objetivo: string
    proteinas_objetivo: string
    carbohidratos_objetivo: string
    grasas_objetivo: string
}

const FORM_VACIO: PlantillaForm = {
    nombre: '',
    descripcion: '',
    kcal_objetivo: '',
    proteinas_objetivo: '',
    carbohidratos_objetivo: '',
    grasas_objetivo: '',
}

export default function PlantillasPage() {
    const { addToast } = useToast()
    const [plantillas, setPlantillas] = useState<PlantillaDieta[]>([])
    const [loading, setLoading] = useState(true)
    const [busqueda, setBusqueda] = useState('')
    const busquedaDebounced = useDebounce(busqueda, 250)
    const [showEditor, setShowEditor] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [form, setForm] = useState<PlantillaForm>(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)
    const [modalDelete, setModalDelete] = useState<{ abierto: boolean; id: string; nombre: string }>({
        abierto: false, id: '', nombre: ''
    })

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/plantillas')
            if (res.status === 401) {
                setPlantillas([])
                setLoading(false)
                return
            }
            if (!res.ok) throw new Error('Error al cargar')
            const data = await res.json()
            setPlantillas(data)
        } catch (error) {
            console.error('Error loading plantillas:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    function abrirNueva() {
        setForm(FORM_VACIO)
        setEditandoId(null)
        setShowEditor(true)
    }

    async function abrirEditar(p: PlantillaDieta) {
        setForm({
            nombre: p.nombre,
            descripcion: p.descripcion || '',
            kcal_objetivo: String(p.kcal_objetivo || ''),
            proteinas_objetivo: String(p.proteinas_objetivo || ''),
            carbohidratos_objetivo: String(p.carbohidratos_objetivo || ''),
            grasas_objetivo: String(p.grasas_objetivo || ''),
        })
        setEditandoId(p.id)
        setShowEditor(true)
    }

    async function handleGuardar() {
        if (!form.nombre.trim()) {
            addToast({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' })
            return
        }
        if (form.kcal_objetivo === '' || form.proteinas_objetivo === '' || form.carbohidratos_objetivo === '' || form.grasas_objetivo === '') {
            addToast({ type: 'error', title: 'Error', message: 'Todos los macros son obligatorios' })
            return
        }

        setGuardando(true)
        try {
            const url = editandoId ? `/api/plantillas/${editandoId}` : '/api/plantillas'
            const method = editandoId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: form.nombre.trim(),
                    descripcion: form.descripcion.trim() || null,
                    kcal_objetivo: Number(form.kcal_objetivo),
                    proteinas_objetivo: Number(form.proteinas_objetivo),
                    carbohidratos_objetivo: Number(form.carbohidratos_objetivo),
                    grasas_objetivo: Number(form.grasas_objetivo),
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al guardar')
            }

            addToast({
                type: 'success',
                title: editandoId ? 'Plantilla actualizada' : 'Plantilla creada',
                message: `"${form.nombre.trim()}" ${editandoId ? 'actualizada' : 'creada'} correctamente`,
            })
            setShowEditor(false)
            load()
        } catch (error) {
            console.error('Error guardando plantilla:', error)
            addToast({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al guardar' })
        } finally {
            setGuardando(false)
        }
    }

    async function handleEliminar(id: string) {
        try {
            const res = await fetch(`/api/plantillas/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Error al eliminar')

            addToast({ type: 'success', title: 'Plantilla eliminada', message: 'La plantilla se ha eliminado correctamente' })
            setModalDelete({ abierto: false, id: '', nombre: '' })
            load()
        } catch (error) {
            console.error('Error deleting plantilla:', error)
            addToast({ type: 'error', title: 'Error', message: 'No se pudo eliminar la plantilla' })
        }
    }

    const filtradas = plantillas.filter(p =>
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.descripcion || '').toLowerCase().includes(busqueda.toLowerCase())
    )

    const loadingForm = (
        <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
        </div>
    )

    // MODO EDITOR
    if (showEditor) {
        return (
            <div className="p-8 max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                            {editandoId ? 'Editar plantilla' : 'Nueva plantilla'}
                        </h1>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            Define los macros objetivo de la plantilla
                        </p>
                    </div>
                    <button onClick={() => setShowEditor(false)} className="btn btn-ghost btn-sm">
                        Volver
                    </button>
                </div>

                <div className="card space-y-5 p-6">
                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Nombre de la plantilla</label>
                        <input
                            type="text"
                            value={form.nombre}
                            onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
                            placeholder="Ej: Pérdida suave (1.600 kcal)"
                            className="input"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text)' }}>Descripción (opcional)</label>
                        <textarea
                            value={form.descripcion}
                            onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                            placeholder="Describe el perfil de cliente ideal para esta plantilla..."
                            rows={3}
                            className="input resize-none"
                        />
                    </div>

                    <div className="border-t pt-5" style={{ borderColor: 'var(--border)' }}>
                        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Macros objetivo</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Calorías (kcal)</label>
                                <input
                                    type="number"
                                    value={form.kcal_objetivo}
                                    onChange={e => setForm(prev => ({ ...prev, kcal_objetivo: e.target.value }))}
                                    placeholder="1600"
                                    className="input"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Proteína (g)</label>
                                <input
                                    type="number"
                                    value={form.proteinas_objetivo}
                                    onChange={e => setForm(prev => ({ ...prev, proteinas_objetivo: e.target.value }))}
                                    placeholder="105"
                                    className="input"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Carbohidratos (g)</label>
                                <input
                                    type="number"
                                    value={form.carbohidratos_objetivo}
                                    onChange={e => setForm(prev => ({ ...prev, carbohidratos_objetivo: e.target.value }))}
                                    placeholder="171"
                                    className="input"
                                    min={0}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Grasas (g)</label>
                                <input
                                    type="number"
                                    value={form.grasas_objetivo}
                                    onChange={e => setForm(prev => ({ ...prev, grasas_objetivo: e.target.value }))}
                                    placeholder="55"
                                    className="input"
                                    min={0}
                                />
                            </div>
                        </div>

                        {/* Preview distribución porcentual */}
                        {Number(form.kcal_objetivo) > 0 && (
                            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg)' }}>
                                <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-secondary)' }}>Distribución</p>
                                <div className="flex gap-3 text-sm">
                                    <span className="macro-pill macro-pill-protein">
                                        {form.proteinas_objetivo ? ((Number(form.proteinas_objetivo) * 4 / Number(form.kcal_objetivo)) * 100).toFixed(0) : 0}% Proteína
                                    </span>
                                    <span className="macro-pill macro-pill-carbs">
                                        {form.carbohidratos_objetivo ? ((Number(form.carbohidratos_objetivo) * 4 / Number(form.kcal_objetivo)) * 100).toFixed(0) : 0}% Carbos
                                    </span>
                                    <span className="macro-pill macro-pill-fat">
                                        {form.grasas_objetivo ? ((Number(form.grasas_objetivo) * 9 / Number(form.kcal_objetivo)) * 100).toFixed(0) : 0}% Grasas
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                        <button onClick={() => setShowEditor(false)} className="btn btn-ghost">
                            Cancelar
                        </button>
                        <button onClick={handleGuardar} disabled={guardando} className="btn btn-primary">
                            {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
                            {editandoId ? 'Actualizar plantilla' : 'Crear plantilla'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // MODO LISTADO
    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Modal de confirmación eliminar */}
            <Modal
                abierto={modalDelete.abierto}
                onCerrar={() => setModalDelete({ abierto: false, id: '', nombre: '' })}
                titulo="Eliminar plantilla"
                descripcion={`¿Estás seguro de eliminar "${modalDelete.nombre}"? Esta acción no se puede deshacer.`}
                accion={{
                    label: 'Eliminar',
                    onClick: () => handleEliminar(modalDelete.id),
                    variant: 'danger',
                }}
                accionSecundaria={{ label: 'Cancelar', onClick: () => setModalDelete({ abierto: false, id: '', nombre: '' }) }}
            />

            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Plantillas de dieta</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                        {plantillas.length} plantilla{plantillas.length !== 1 ? 's' : ''} — usadas por la IA para generar dietas personalizadas
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/api/plantillas/seed"
                        target="_blank"
                        className="btn btn-ghost btn-sm"
                        title="Sembrar plantillas por defecto"
                    >
                        <FlaskConical size={14} /> Seed
                    </a>
                    <button onClick={abrirNueva} className="btn btn-primary">
                        <Plus size={16} /> Nueva plantilla
                    </button>
                </div>
            </header>

            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                    className="input search-input"
                    placeholder="Buscar plantilla…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
            </div>

            {loading ? loadingForm : filtradas.length === 0 ? (
                <div className="card text-center py-16">
                    <LayoutTemplate size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {busqueda ? 'No hay plantillas con ese filtro' : 'No hay plantillas de dieta'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {busqueda
                            ? 'Prueba con otro término de búsqueda'
                            : 'Crea tu primera plantilla o usa el botón "Seed" para cargar las 7 plantillas por defecto'
                        }
                    </p>
                    {!busqueda && (
                        <button onClick={abrirNueva} className="btn btn-primary mt-4">
                            <Plus size={16} /> Crear plantilla
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtradas.map(p => {
                        const tipo = (p.tipo || 'normal') as PlantillaDietaTipo
                        const TipoIcon = TIPO_ICON[tipo]
                        return (
                            <div key={p.id} className="card flex items-center gap-4">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                    style={{ background: TIPO_BG[tipo] }}>
                                    <TipoIcon size={20} style={{ color: TIPO_COLOR[tipo] }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{p.nombre}</p>
                                        {tipo !== 'normal' && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                                style={{
                                                    background: TIPO_BG[tipo],
                                                    color: TIPO_COLOR[tipo],
                                                    border: `1px solid ${TIPO_COLOR[tipo]}33`,
                                                }}>
                                                {PLANTILLA_DIETA_TIPO_LABELS[tipo]}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
                                        {p.descripcion || 'Sin descripción'}
                                    </p>
                                </div>
                                <div className="hidden md:flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <span className="badge badge-orange">{p.kcal_objetivo} kcal</span>
                                        <span className="badge badge-red">{p.proteinas_objetivo}g P</span>
                                        <span className="badge badge-graphite">{p.carbohidratos_objetivo}g C</span>
                                        <span className="badge badge-purple">{p.grasas_objetivo}g G</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => abrirEditar(p)}
                                        className="btn btn-ghost btn-sm"
                                        title="Editar plantilla"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={() => setModalDelete({ abierto: true, id: p.id, nombre: p.nombre })}
                                        className="btn btn-ghost btn-sm"
                                        style={{ color: '#EF4444' }}
                                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--error-bg)' }}
                                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                                        title="Eliminar plantilla"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

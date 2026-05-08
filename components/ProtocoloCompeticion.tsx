'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { Plus, Pencil, Trash2, ClipboardList, Timer, Zap, Droplets, Dumbbell, CalendarDays, Weight, RotateCcw, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { ProtocoloCompeticion, ProtocoloCompeticionForm } from '@/types'

interface Props {
    clienteId: string
}

const FORM_VACIO: ProtocoloCompeticionForm = {
    nombre: '',
    deporte: '',
    fecha_competicion: '',
    peso_inicial: '',
    peso_objetivo: '',
    carga_dias_previos: '3',
    carga_carbs_kg: '8',
    carga_proteinas_kg: '1.6',
    carga_grasas_kg: '0.6',
    carga_inicio: '',
    geles_marca: '',
    geles_carbs_por_gel: '25',
    geles_cada_minutos: '30',
    electrolitos_marca: '',
    electrolitos_cada_minutos: '60',
    cafeina_mg: '',
    hidratacion_ml_cada_15min: '150',
    notas_previa: '',
    notas_durante: '',
    notas_post: '',
}

export default function ProtocoloCompeticion({ clienteId }: Props) {
    const { addToast } = useToast()
    const [protocolos, setProtocolos] = useState<ProtocoloCompeticion[]>([])
    const [loading, setLoading] = useState(true)
    const [showEditor, setShowEditor] = useState(false)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [form, setForm] = useState<ProtocoloCompeticionForm>(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [modalDelete, setModalDelete] = useState<{ abierto: boolean; id: string; nombre: string }>({
        abierto: false, id: '', nombre: ''
    })

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/clientes/${clienteId}/protocolo-competicion`)
            if (!res.ok) throw new Error('Error al cargar')
            const data = await res.json()
            setProtocolos(data)
        } catch (error) {
            console.error('Error loading protocolos:', error)
        } finally {
            setLoading(false)
        }
    }, [clienteId])

    useEffect(() => { load() }, [load])

    function abrirNuevo() {
        setForm(FORM_VACIO)
        setEditandoId(null)
        setShowEditor(true)
    }

    function abrirEditar(p: ProtocoloCompeticion) {
        setForm({
            nombre: p.nombre,
            deporte: p.deporte || '',
            fecha_competicion: p.fecha_competicion || '',
            peso_inicial: String(p.peso_inicial || ''),
            peso_objetivo: String(p.peso_objetivo || ''),
            carga_dias_previos: String(p.carga_dias_previos),
            carga_carbs_kg: String(p.carga_carbs_kg),
            carga_proteinas_kg: String(p.carga_proteinas_kg),
            carga_grasas_kg: String(p.carga_grasas_kg),
            carga_inicio: p.carga_inicio || '',
            geles_marca: p.geles_marca || '',
            geles_carbs_por_gel: String(p.geles_carbs_por_gel),
            geles_cada_minutos: String(p.geles_cada_minutos),
            electrolitos_marca: p.electrolitos_marca || '',
            electrolitos_cada_minutos: String(p.electrolitos_cada_minutos),
            cafeina_mg: String(p.cafeina_mg || ''),
            hidratacion_ml_cada_15min: String(p.hidratacion_ml_cada_15min),
            notas_previa: p.notas_previa || '',
            notas_durante: p.notas_durante || '',
            notas_post: p.notas_post || '',
        })
        setEditandoId(p.id)
        setShowEditor(true)
    }

    async function handleGuardar() {
        if (!form.nombre.trim()) {
            addToast({ type: 'error', title: 'Error', message: 'El nombre es obligatorio' })
            return
        }

        setGuardando(true)
        try {
            const url = editandoId
                ? `/api/clientes/${clienteId}/protocolo-competicion?id=${editandoId}`
                : `/api/clientes/${clienteId}/protocolo-competicion`
            const method = editandoId ? 'PUT' : 'POST'

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    nombre: form.nombre.trim(),
                }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Error al guardar')
            }

            addToast({
                type: 'success',
                title: editandoId ? 'Protocolo actualizado' : 'Protocolo creado',
                message: `"${form.nombre.trim()}" ${editandoId ? 'actualizado' : 'creado'} correctamente`,
            })
            setShowEditor(false)
            load()
        } catch (error) {
            console.error('Error guardando protocolo:', error)
            addToast({ type: 'error', title: 'Error', message: error instanceof Error ? error.message : 'Error al guardar' })
        } finally {
            setGuardando(false)
        }
    }

    async function handleEliminar(id: string) {
        try {
            const res = await fetch(`/api/clientes/${clienteId}/protocolo-competicion?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Error al eliminar')

            addToast({ type: 'success', title: 'Protocolo eliminado', message: 'Protocolo eliminado correctamente' })
            setModalDelete({ abierto: false, id: '', nombre: '' })
            load()
        } catch (error) {
            console.error('Error deleting protocolo:', error)
            addToast({ type: 'error', title: 'Error', message: 'No se pudo eliminar el protocolo' })
        }
    }

    // ── Calculadora dinámica ──
    function calcularCargaDiaria(p: ProtocoloCompeticion) {
        const peso = p.peso_inicial || 70
        return {
            carbs: Math.round(peso * p.carga_carbs_kg),
            proteinas: Math.round(peso * p.carga_proteinas_kg),
            grasas: Math.round(peso * p.carga_grasas_kg),
            kcal: Math.round(
                peso * p.carga_carbs_kg * 4 +
                peso * p.carga_proteinas_kg * 4 +
                peso * p.carga_grasas_kg * 9
            ),
        }
    }

    function calcularSuplementos(p: ProtocoloCompeticion, duracionHoras: number) {
        const totalMinutos = duracionHoras * 60
        const gelInterval = Math.max(1, p.geles_cada_minutos)
        const electrolitoInterval = Math.max(1, p.electrolitos_cada_minutos)
        const numGeles = Math.floor(totalMinutos / gelInterval)
        const numElectrolitos = Math.floor(totalMinutos / electrolitoInterval)
        const totalCarbsGeles = numGeles * p.geles_carbs_por_gel
        const totalHidratacion = Math.floor(totalMinutos / 15) * p.hidratacion_ml_cada_15min

        return {
            numGeles,
            numElectrolitos,
            totalCarbsGeles,
            totalHidratacion,
            totalKcal: totalCarbsGeles * 4,
        }
    }

    const loadingSpinner = (
        <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
    )

    // EDITOR
    if (showEditor) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {editandoId ? 'Editar protocolo' : 'Nuevo protocolo de competición'}
                        </h2>
                        <p className="text-sm text-gray-500">Define la fase de carga y la estrategia de suplementación</p>
                    </div>
                    <button onClick={() => setShowEditor(false)} className="btn btn-ghost btn-sm">Volver</button>
                </div>

                <div className="card p-6 space-y-6">
                    {/* Info general */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <ClipboardList size={16} className="text-teal-600" /> Información general
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del protocolo *</label>
                                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                                    placeholder="Ej: Media maratón Valencia" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Deporte</label>
                                <input className="input" value={form.deporte} onChange={e => setForm(f => ({ ...f, deporte: e.target.value }))}
                                    placeholder="Ej: Running, Triatlón, Ciclismo" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de competición</label>
                                <input type="date" className="input" value={form.fecha_competicion} onChange={e => setForm(f => ({ ...f, fecha_competicion: e.target.value }))} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso actual (kg)</label>
                                    <input type="number" className="input" value={form.peso_inicial} onChange={e => setForm(f => ({ ...f, peso_inicial: e.target.value }))}
                                        placeholder="70" step="0.1" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Peso objetivo (kg)</label>
                                    <input type="number" className="input" value={form.peso_objetivo} onChange={e => setForm(f => ({ ...f, peso_objetivo: e.target.value }))}
                                        placeholder="68" step="0.1" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Fase de carga */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Zap size={16} style={{ color: '#A1A1A6' }} /> Fase de carga de carbohidratos
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Basado en protocolo clásico de supercompensación de glucógeno (3 días previos, 8-12g/kg carbohidratos)
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Días previos</label>
                                <input type="number" className="input" value={form.carga_dias_previos}
                                    onChange={e => setForm(f => ({ ...f, carga_dias_previos: e.target.value }))} min={1} max={7} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Carbos (g/kg)</label>
                                <input type="number" className="input" value={form.carga_carbs_kg}
                                    onChange={e => setForm(f => ({ ...f, carga_carbs_kg: e.target.value }))} min={1} max={15} step="0.5" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Proteína (g/kg)</label>
                                <input type="number" className="input" value={form.carga_proteinas_kg}
                                    onChange={e => setForm(f => ({ ...f, carga_proteinas_kg: e.target.value }))} min={0.5} max={3} step="0.1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Grasas (g/kg)</label>
                                <input type="number" className="input" value={form.carga_grasas_kg}
                                    onChange={e => setForm(f => ({ ...f, carga_grasas_kg: e.target.value }))} min={0.1} max={2} step="0.1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Inicio carga</label>
                                <input type="date" className="input" value={form.carga_inicio}
                                    onChange={e => setForm(f => ({ ...f, carga_inicio: e.target.value }))} />
                            </div>
                        </div>

                        {/* Preview carga */}
                        {form.peso_inicial && Number(form.peso_inicial) > 0 && (
                            <div className="mt-4 p-4 rounded-lg bg-[#F2F2F4] border border-[#D1D1D6]">
                                <p className="text-sm font-semibold text-[#48484A] mb-2">📊 Cálculo diario estimado</p>
                                <div className="grid grid-cols-4 gap-3 text-sm">
                                    <div>
                                        <span className="text-[#8E8E93]">Carbos:</span>
                                        <span className="font-bold text-[#363639] ml-1">
                                            {Math.round(Number(form.peso_inicial) * Number(form.carga_carbs_kg))}g
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[#8E8E93]">Proteína:</span>
                                        <span className="font-bold text-[#363639] ml-1">
                                            {Math.round(Number(form.peso_inicial) * Number(form.carga_proteinas_kg))}g
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[#8E8E93]">Grasas:</span>
                                        <span className="font-bold text-[#363639] ml-1">
                                            {Math.round(Number(form.peso_inicial) * Number(form.carga_grasas_kg))}g
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[#8E8E93]">Kcal:</span>
                                        <span className="font-bold text-[#363639] ml-1">
                                            {Math.round(
                                                Number(form.peso_inicial) * Number(form.carga_carbs_kg) * 4 +
                                                Number(form.peso_inicial) * Number(form.carga_proteinas_kg) * 4 +
                                                Number(form.peso_inicial) * Number(form.carga_grasas_kg) * 9
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="border-gray-200" />

                    {/* Suplementación */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                            <Timer size={16} className="text-blue-500" /> Suplementación durante la carrera
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Marca de geles</label>
                                <input className="input" value={form.geles_marca} onChange={e => setForm(f => ({ ...f, geles_marca: e.target.value }))}
                                    placeholder="Ej: GU, Maurten, SiS" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Carbos por gel (g)</label>
                                <input type="number" className="input" value={form.geles_carbs_por_gel}
                                    onChange={e => setForm(f => ({ ...f, geles_carbs_por_gel: e.target.value }))} min={15} max={50} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Cada X minutos</label>
                                <input type="number" className="input" value={form.geles_cada_minutos}
                                    onChange={e => setForm(f => ({ ...f, geles_cada_minutos: e.target.value }))} min={15} max={60} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Cafeína (mg)</label>
                                <input type="number" className="input" value={form.cafeina_mg}
                                    onChange={e => setForm(f => ({ ...f, cafeina_mg: e.target.value }))} min={0} max={400} placeholder="Opcional" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Electrolitos marca</label>
                                <input className="input" value={form.electrolitos_marca} onChange={e => setForm(f => ({ ...f, electrolitos_marca: e.target.value }))}
                                    placeholder="Ej: Nuun, Gatorade" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Electrolitos cada (min)</label>
                                <input type="number" className="input" value={form.electrolitos_cada_minutos}
                                    onChange={e => setForm(f => ({ ...f, electrolitos_cada_minutos: e.target.value }))} min={15} max={120} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Hidratación (ml/15min)</label>
                                <input type="number" className="input" value={form.hidratacion_ml_cada_15min}
                                    onChange={e => setForm(f => ({ ...f, hidratacion_ml_cada_15min: e.target.value }))} min={50} max={500} />
                            </div>
                        </div>
                    </div>

                    <hr className="border-gray-200" />

                    {/* Notas */}
                    <div>
                        <h3 className="font-semibold text-gray-800 mb-3">Notas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Previa (días antes)</label>
                                <textarea className="input resize-none" rows={3} value={form.notas_previa}
                                    onChange={e => setForm(f => ({ ...f, notas_previa: e.target.value }))}
                                    placeholder="Recomendaciones para días previos..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Durante la competición</label>
                                <textarea className="input resize-none" rows={3} value={form.notas_durante}
                                    onChange={e => setForm(f => ({ ...f, notas_durante: e.target.value }))}
                                    placeholder="Instrucciones durante la carrera..." />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Post-competición</label>
                                <textarea className="input resize-none" rows={3} value={form.notas_post}
                                    onChange={e => setForm(f => ({ ...f, notas_post: e.target.value }))}
                                    placeholder="Recuperación y realimentación..." />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                        <button onClick={() => setShowEditor(false)} className="btn btn-ghost">Cancelar</button>
                        <button onClick={handleGuardar} disabled={guardando} className="btn btn-primary">
                            {guardando ? <Loader2 size={16} className="animate-spin" /> : null}
                            {editandoId ? 'Actualizar protocolo' : 'Crear protocolo'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // LISTADO
    return (
        <div className="space-y-4">
            {/* Modal eliminar */}
            <Modal
                abierto={modalDelete.abierto}
                onCerrar={() => setModalDelete({ abierto: false, id: '', nombre: '' })}
                titulo="Eliminar protocolo"
                descripcion={`¿Estás seguro de eliminar "${modalDelete.nombre}"?`}
                accion={{ label: 'Eliminar', onClick: () => handleEliminar(modalDelete.id), variant: 'danger' }}
                accionSecundaria={{ label: 'Cancelar', onClick: () => setModalDelete({ abierto: false, id: '', nombre: '' }) }}
            />

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Protocolos de competición</h2>
                    <p className="text-sm text-gray-500">
                        {protocolos.length} protocolo{protocolos.length !== 1 ? 's' : ''} — Fases de carga y suplementación para competiciones
                    </p>
                </div>
                <button onClick={abrirNuevo} className="btn btn-primary">
                    <Plus size={16} /> Nuevo protocolo
                </button>
            </div>

            {loading ? loadingSpinner : protocolos.length === 0 ? (
                <div className="card text-center py-16">
                    <Dumbbell size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Sin protocolos de competición</p>
                    <p className="text-sm text-gray-400 mt-1">Crea un protocolo para planificar la carga de carbohidratos y suplementación</p>
                    <button onClick={abrirNuevo} className="btn btn-primary mt-4">
                        <Plus size={16} /> Crear protocolo
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {protocolos.map(p => {
                        const carga = calcularCargaDiaria(p)
                        const expandido = expandedId === p.id
                        return (
                            <div key={p.id} className="card overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => setExpandedId(expandido ? null : p.id)}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-100 flex-shrink-0">
                                            <Zap size={20} className="text-orange-600" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-900">{p.nombre}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                {p.deporte && <span>{p.deporte}</span>}
                                                {p.fecha_competicion && (
                                                    <>
                                                        <span>·</span>
                                                        <span>{new Date(p.fecha_competicion).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                    </>
                                                )}
                                                <span>·</span>
                                                <span className="font-medium text-[#8E8E93]">{carga.kcal} kcal/día en carga</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); abrirEditar(p) }}
                                            className="btn btn-ghost btn-sm" title="Editar">
                                            <Pencil size={14} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); setModalDelete({ abierto: true, id: p.id, nombre: p.nombre }) }}
                                            className="btn btn-ghost btn-sm !text-red-500 hover:!bg-red-50" title="Eliminar">
                                            <Trash2 size={14} />
                                        </button>
                                        <button className="btn btn-ghost btn-sm text-gray-400">
                                            {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expandido: detalle */}
                                {expandido && (
                                    <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
                                        {/* Carga de carbohidratos */}
                                        <div className="bg-[#F2F2F4] rounded-lg p-4 border border-[#D1D1D6]">
                                            <h4 className="font-semibold text-[#48484A] text-sm flex items-center gap-2 mb-3">
                                                <Zap size={14} /> Fase de carga ({p.carga_dias_previos} días previos)
                                            </h4>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                                <div className="bg-white rounded p-2">
                                                    <p className="text-xs text-[#8E8E93]">Carbohidratos</p>
                                                    <p className="text-lg font-bold text-[#363639]">{carga.carbs}g</p>
                                                    <p className="text-xs text-[#A1A1A6]">{p.carga_carbs_kg}g/kg/día</p>
                                                </div>
                                                <div className="bg-white rounded p-2">
                                                    <p className="text-xs text-[#8E8E93]">Proteína</p>
                                                    <p className="text-lg font-bold text-[#363639]">{carga.proteinas}g</p>
                                                    <p className="text-xs text-[#A1A1A6]">{p.carga_proteinas_kg}g/kg/día</p>
                                                </div>
                                                <div className="bg-white rounded p-2">
                                                    <p className="text-xs text-[#8E8E93]">Grasas</p>
                                                    <p className="text-lg font-bold text-[#363639]">{carga.grasas}g</p>
                                                    <p className="text-xs text-[#A1A1A6]">{p.carga_grasas_kg}g/kg/día</p>
                                                </div>
                                                <div className="bg-white rounded p-2">
                                                    <p className="text-xs text-[#8E8E93]">Calorías</p>
                                                    <p className="text-lg font-bold text-[#363639]">{carga.kcal}</p>
                                                    <p className="text-xs text-[#A1A1A6]">kcal/día</p>
                                                </div>
                                            </div>
                                            {p.carga_inicio && (
                                                <p className="text-xs text-[#636366] mt-2">
                                                    <CalendarDays size={12} className="inline mr-1" />
                                                    Inicio de carga: {new Date(p.carga_inicio).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                                </p>
                                            )}
                                        </div>

                                        {/* Calculadora rápida: suponer duración */}
                                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                            <h4 className="font-semibold text-blue-800 text-sm flex items-center gap-2 mb-3">
                                                <Timer size={14} /> Calculadora de suplementos
                                            </h4>
                                            <p className="text-xs text-blue-600 mb-3">
                                                Selecciona la duración estimada para ver el plan de suplementación:
                                            </p>
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {[1, 1.5, 2, 2.5, 3, 4, 5, 6].map(h => {
                                                    const s = calcularSuplementos(p, h)
                                                    return (
                                                        <div key={h} className="bg-white rounded-lg p-3 border border-blue-100 flex-1 min-w-[140px]">
                                                            <p className="text-sm font-bold text-blue-900 mb-1">{h}h{h % 1 !== 0 ? '' : '00'}</p>
                                                            <div className="text-xs text-gray-600 space-y-0.5">
                                                                <p>🧪 {s.numGeles} geles ({s.totalCarbsGeles}g carbos)</p>
                                                                <p>💧 {s.numElectrolitos} electrolitos</p>
                                                                <p>🚰 {s.totalHidratacion >= 1000 ? `${(s.totalHidratacion / 1000).toFixed(1)}L` : `${s.totalHidratacion}ml`} agua</p>
                                                                <p className="text-blue-600 font-medium">{s.totalKcal} kcal de geles</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                                {p.geles_marca && (
                                                    <div className="bg-white rounded p-2 border">
                                                        <span className="text-gray-400">Geles:</span>
                                                        <span className="font-medium ml-1">{p.geles_marca}</span>
                                                        <span className="text-gray-400"> (cada {p.geles_cada_minutos}min)</span>
                                                    </div>
                                                )}
                                                {p.electrolitos_marca && (
                                                    <div className="bg-white rounded p-2 border">
                                                        <span className="text-gray-400">Electrolitos:</span>
                                                        <span className="font-medium ml-1">{p.electrolitos_marca}</span>
                                                        <span className="text-gray-400"> (cada {p.electrolitos_cada_minutos}min)</span>
                                                    </div>
                                                )}
                                                {p.cafeina_mg && (
                                                    <div className="bg-white rounded p-2 border">
                                                        <span className="text-gray-400">Cafeína:</span>
                                                        <span className="font-medium ml-1">{p.cafeina_mg}mg</span>
                                                    </div>
                                                )}
                                                <div className="bg-white rounded p-2 border">
                                                    <span className="text-gray-400">Hidratación:</span>
                                                    <span className="font-medium ml-1">{p.hidratacion_ml_cada_15min}ml/15min</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Notas */}
                                        {(p.notas_previa || p.notas_durante || p.notas_post) && (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                                {p.notas_previa && (
                                                    <div className="bg-gray-50 rounded p-3 border">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">📋 Previa</p>
                                                        <p className="text-gray-700">{p.notas_previa}</p>
                                                    </div>
                                                )}
                                                {p.notas_durante && (
                                                    <div className="bg-gray-50 rounded p-3 border">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">🏃 Durante</p>
                                                        <p className="text-gray-700">{p.notas_durante}</p>
                                                    </div>
                                                )}
                                                {p.notas_post && (
                                                    <div className="bg-gray-50 rounded p-3 border">
                                                        <p className="text-xs font-semibold text-gray-500 mb-1">🛌 Post</p>
                                                        <p className="text-gray-700">{p.notas_post}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

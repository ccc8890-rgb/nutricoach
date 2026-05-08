'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, ClipboardList, Search, Copy, Check, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react'
import CuestionarioCreador from '@/components/CuestionarioCreador'
import Modal from '@/components/ui/Modal'
import type { Cuestionario, Pregunta } from '@/types'
import { useToast } from '@/components/ui/Toast'

export default function CuestionariosPage() {
    const { addToast } = useToast()
    const [cuestionarios, setCuestionarios] = useState<Cuestionario[]>([])
    const [busqueda, setBusqueda] = useState('')
    const [loading, setLoading] = useState(true)
    const [showCreador, setShowCreador] = useState(false)
    const [copiado, setCopiado] = useState<string | null>(null)

    const [titulo, setTitulo] = useState('')
    const [descripcion, setDescripcion] = useState('')
    const [guardando, setGuardando] = useState(false)

    async function load() {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const { data } = await supabase
            .from('cuestionarios')
            .select('*')
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false })
        setCuestionarios(data ?? [])
        setLoading(false)
    }

    useEffect(() => { load() }, [])

    async function toggleActivo(c: Cuestionario) {
        await supabase
            .from('cuestionarios')
            .update({ activo: !c.activo })
            .eq('id', c.id)
        load()
    }

    function copiarLink(codigo: string) {
        const url = `${window.location.origin}/cuestionario/${codigo}`
        navigator.clipboard.writeText(url)
        setCopiado(codigo)
        setTimeout(() => setCopiado(null), 2000)
    }

    async function handleGuardarCuestionario(preguntas: Pregunta[]) {
        if (!titulo.trim() || preguntas.length === 0) return
        setGuardando(true)
        try {
            const res = await fetch('/api/cuestionarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ titulo: titulo.trim(), descripcion: descripcion.trim() || null, preguntas }),
            })
            if (!res.ok) throw new Error('Error al crear cuestionario')
            setShowCreador(false)
            setTitulo('')
            setDescripcion('')
            load()
        } catch (error) {
            console.error('Error al guardar cuestionario:', error)
            addToast({ type: 'error', title: 'Error', message: 'Error al guardar el cuestionario. Inténtalo de nuevo.' })
        } finally {
            setGuardando(false)
        }
    }

    const filtrados = cuestionarios.filter(c =>
        c.titulo.toLowerCase().includes(busqueda.toLowerCase())
    )

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Cuestionarios</h1>
                    <p className="text-sm text-gray-500 mt-1">{cuestionarios.length} cuestionarios creados</p>
                </div>
                <button onClick={() => setShowCreador(true)} className="btn btn-primary">
                    <Plus size={16} /> Nuevo cuestionario
                </button>
            </header>

            <div className="relative mb-6">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    className="input search-input"
                    placeholder="Buscar cuestionario…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="grid gap-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card flex items-center gap-4 animate-pulse">
                            <div className="w-11 h-11 rounded-xl bg-gray-200 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-40" />
                                <div className="h-3 bg-gray-200 rounded w-32" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtrados.length === 0 ? (
                <div className="card text-center py-16">
                    <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No hay cuestionarios todavía</p>
                    <p className="text-sm text-gray-400 mt-1">Crea tu primer cuestionario para tus clientes</p>
                    <button onClick={() => setShowCreador(true)} className="btn btn-primary mt-4">
                        <Plus size={16} /> Crear cuestionario
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {filtrados.map(c => (
                        <div key={c.id} className="card flex items-center gap-4">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: '#F2F2F7' }}>
                                <ClipboardList size={20} style={{ color: '#1C1C1E' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900">{c.titulo}</p>
                                <p className="text-sm text-gray-400 truncate">
                                    {c.descripcion || 'Sin descripción'} &middot; {c.preguntas?.length ?? 0} preguntas
                                </p>
                            </div>
                            <div className="hidden md:flex items-center gap-1">
                                <button
                                    onClick={() => copiarLink(c.codigo_publico)}
                                    className="btn btn-ghost btn-sm"
                                    title="Copiar link público"
                                >
                                    {copiado === c.codigo_publico ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                                    Link
                                </button>
                                <a
                                    href={`/cuestionario/${c.codigo_publico}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost btn-sm"
                                >
                                    <ExternalLink size={14} /> Vista
                                </a>
                                <button
                                    onClick={() => toggleActivo(c)}
                                    className={`btn btn-ghost btn-sm ${c.activo ? 'text-gray-700' : 'text-gray-400'}`}
                                >
                                    {c.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                    {c.activo ? 'Activo' : 'Inactivo'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para crear cuestionario */}
            <Modal
                abierto={showCreador}
                onCerrar={() => setShowCreador(false)}
                titulo="Nuevo cuestionario"
                descripcion="Crea preguntas para tus clientes"
            >
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Título del cuestionario</label>
                        <input
                            type="text"
                            value={titulo}
                            onChange={e => setTitulo(e.target.value)}
                            placeholder="Ej: Cuestionario inicial para nuevos clientes"
                            className="input"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
                        <textarea
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            placeholder="Explica brevemente qué información necesitas..."
                            rows={2}
                            className="input resize-none"
                        />
                    </div>
                    <CuestionarioCreador
                        onGuardar={(preguntas) => {
                            handleGuardarCuestionario(preguntas)
                        }}
                        guardando={guardando}
                    />
                </div>
            </Modal>
        </div>
    )
}

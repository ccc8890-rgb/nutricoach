'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Link2, X, Search, Plus, Trash2, Upload, Hash } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { FadeIn, PageTransition } from '@/components/ui/Motion'
import type { Alimento } from '@/types'
import { CATEGORIAS, TIPOS_COCCION, INTOLERANCIAS } from '@/lib/recetas-constants'
import { useToast } from '@/components/ui/Toast'
import { TagInput } from '@/components/ui/TagInput'

interface Ingrediente {
    id?: string
    tempId: string
    alimento_id: string | null
    nombre_libre: string
    cantidad_gramos: number
    alimento?: Alimento
}

export default function EditarRecetaPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const fileRef = useRef<HTMLInputElement>(null)
    const { addToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        nombre: '',
        descripcion: '',
        instrucciones: '',
        consejos: '',
        categoria: '',
        tipo_coccion: '',
        dificultad: '',
        porciones: '1',
        descripcion_porcion: '',
        tiempo_prep_min: '',
        tiempo_coccion_min: '',
        url_origen: '',
    })
    const [intolerancias, setIntolerancias] = useState<string[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
    const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
    const [imagenFile, setImagenFile] = useState<File | null>(null)
    const [imagenPreview, setImagenPreview] = useState<string | null>(null)
    const [imagenUrlExterna, setImagenUrlExterna] = useState('')
    const [imagenExistente, setImagenExistente] = useState('')

    // Buscador de alimentos para ingredientes
    const [buscadorAbierto, setBuscadorAbierto] = useState<string | null>(null)
    const [queryAlimento, setQueryAlimento] = useState('')
    const [resultados, setResultados] = useState<Alimento[]>([])
    const [buscando, setBuscando] = useState(false)

    const [guardando, setGuardando] = useState(false)

    // Cargar datos existentes
    useEffect(() => {
        async function load() {
            const [recetaRes, ingRes] = await Promise.all([
                supabase.from('recetas').select('*').eq('id', id).single(),
                supabase.from('receta_ingredientes').select('*, alimento:alimentos(*)').eq('receta_id', id).order('orden'),
            ])

            const receta = recetaRes.data
            if (!receta) return

            setForm({
                nombre: receta.nombre ?? '',
                descripcion: receta.descripcion ?? '',
                instrucciones: receta.instrucciones ?? '',
                consejos: receta.consejos ?? '',
                categoria: receta.categoria ?? '',
                tipo_coccion: receta.tipo_coccion ?? '',
                dificultad: receta.dificultad ?? '',
                porciones: String(receta.porciones ?? 1),
                descripcion_porcion: receta.descripcion_porcion ?? '',
                tiempo_prep_min: receta.tiempo_prep_min ? String(receta.tiempo_prep_min) : '',
                tiempo_coccion_min: receta.tiempo_coccion_min ? String(receta.tiempo_coccion_min) : '',
                url_origen: receta.url_origen ?? '',
            })

            setIntolerancias(receta.intolerancias ?? [])
            setTags(receta.tags ?? [])
            setImagenExistente(receta.imagen_url ?? '')
            setImagenUrlExterna(receta.imagen_url ?? '')

            setIngredientes((ingRes.data ?? []).map(ing => ({
                id: ing.id,
                tempId: crypto.randomUUID(),
                alimento_id: ing.alimento_id,
                nombre_libre: ing.nombre_libre ?? ing.alimento?.nombre ?? '',
                cantidad_gramos: ing.cantidad_gramos,
                alimento: ing.alimento,
            })))

            setLoading(false)
        }
        load()
    }, [id])

    // Cargar sugerencias de tags desde la API
    useEffect(() => {
        fetch('/api/recetas/tags')
            .then(r => r.json())
            .then(data => {
                if (data?.tags) setTagSuggestions(data.tags)
            })
            .catch(() => { })
    }, [])

    // Búsqueda de alimentos via API (service_role bypass RLS)
    useEffect(() => {
        if (!queryAlimento || queryAlimento.length < 2) { setResultados([]); return }
        setBuscando(true)
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/alimentos?q=${encodeURIComponent(queryAlimento)}&custom=all`)
                if (res.ok) {
                    const data = await res.json()
                    setResultados(data ?? [])
                } else {
                    setResultados([])
                }
            } catch {
                setResultados([])
            }
            setBuscando(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [queryAlimento])

    function añadirIngredienteLibre() {
        setIngredientes(prev => [...prev, {
            tempId: crypto.randomUUID(),
            alimento_id: null,
            nombre_libre: '',
            cantidad_gramos: 100,
        }])
    }

    function vincularAlimento(tempId: string, alimento: Alimento) {
        setIngredientes(prev => prev.map(i => i.tempId === tempId
            ? { ...i, alimento_id: alimento.id, nombre_libre: alimento.nombre, alimento }
            : i
        ))
        setBuscadorAbierto(null)
        setQueryAlimento('')
        setResultados([])
    }

    function actualizarIngrediente(tempId: string, campo: 'nombre_libre' | 'cantidad_gramos', valor: string | number) {
        setIngredientes(prev => prev.map(i => i.tempId === tempId ? { ...i, [campo]: valor } : i))
    }

    function eliminarIngrediente(tempId: string) {
        setIngredientes(prev => prev.filter(i => i.tempId !== tempId))
    }

    function toggleIntolerancia(v: string) {
        setIntolerancias(prev => prev.includes(v) ? prev.filter(i => i !== v) : [...prev, v])
    }

    function handleImagenChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        setImagenFile(file)
        setImagenUrlExterna('')
        setImagenExistente('')
        setImagenPreview(URL.createObjectURL(file))
    }

    // Calcular macros totales por porción
    const macrosTotales = (() => {
        const porcion = parseInt(form.porciones) || 1
        const ingConAlimento = ingredientes.filter(i => i.alimento)
        if (ingConAlimento.length === 0) return null
        const total = sumarMacros(ingConAlimento.map(i =>
            calcularMacrosPorCantidad(i.alimento!.calorias, i.alimento!.proteinas, i.alimento!.carbohidratos, i.alimento!.grasas, i.alimento!.fibra ?? 0, i.cantidad_gramos)
        ))
        return {
            kcal: total.calorias / porcion,
            proteinas: total.proteinas / porcion,
            carbohidratos: total.carbohidratos / porcion,
            grasas: total.grasas / porcion,
            fibra: total.fibra / porcion,
        }
    })()

    async function guardar() {
        if (!form.nombre.trim()) return
        setGuardando(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setGuardando(false); addToast({ type: 'error', title: 'Error', message: 'No autenticado' }); return }

        // Subir imagen si hay archivo local nuevo
        let imagen_url = imagenExistente || imagenUrlExterna || null
        if (imagenFile) {
            const ext = imagenFile.name.split('.').pop()
            const path = `${user.id}/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from('recetas').upload(path, imagenFile)
            if (!uploadError) {
                const { data: urlData } = supabase.storage.from('recetas').getPublicUrl(path)
                imagen_url = urlData.publicUrl
            }
        }

        // Actualizar receta
        const { error } = await supabase.from('recetas').update({
            nombre: form.nombre.trim(),
            descripcion: form.descripcion || null,
            instrucciones: form.instrucciones || null,
            consejos: form.consejos || null,
            categoria: form.categoria || null,
            tipo_coccion: form.tipo_coccion || null,
            dificultad: form.dificultad || null,
            intolerancias: intolerancias.length ? intolerancias : null,
            tags: tags.length ? tags : null,
            porciones: parseInt(form.porciones) || 1,
            descripcion_porcion: form.descripcion_porcion || null,
            tiempo_prep_min: form.tiempo_prep_min ? parseInt(form.tiempo_prep_min) : null,
            tiempo_coccion_min: form.tiempo_coccion_min ? parseInt(form.tiempo_coccion_min) : null,
            imagen_url,
            url_origen: form.url_origen || null,
            kcal: macrosTotales?.kcal ?? null,
            proteinas: macrosTotales?.proteinas ?? null,
            carbohidratos: macrosTotales?.carbohidratos ?? null,
            grasas: macrosTotales?.grasas ?? null,
            fibra: macrosTotales?.fibra ?? null,
        }).eq('id', id)

        if (error) { addToast({ type: 'error', title: 'Error', message: error.message || 'No se pudieron guardar los cambios' }); setGuardando(false); return }

        // Sincronizar ingredientes: borrar los que ya no existen, insertar/actualizar
        const idsExistentes = ingredientes.filter(i => i.id).map(i => i.id!)
        const { error: delError } = idsExistentes.length > 0
            ? await supabase.from('receta_ingredientes').delete().eq('receta_id', id).not('id', 'in', `(${idsExistentes.map(i => `"${i}"`).join(',')})`)
            : await supabase.from('receta_ingredientes').delete().eq('receta_id', id)
        if (delError) addToast({ type: 'error', title: 'Error', message: 'Error al sincronizar ingredientes: ' + delError.message })

        // Insertar o actualizar ingredientes
        for (let idx = 0; idx < ingredientes.length; idx++) {
            const ing = ingredientes[idx]
            const { error: ingErr } = ing.id
                ? await supabase.from('receta_ingredientes').update({
                    alimento_id: ing.alimento_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: idx,
                }).eq('id', ing.id)
                : await supabase.from('receta_ingredientes').insert({
                    receta_id: id,
                    alimento_id: ing.alimento_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: idx,
                })
            if (ingErr) addToast({ type: 'error', title: 'Error', message: 'Error al guardar ingrediente: ' + ingErr.message })
        }

        addToast({ type: 'success', title: 'Guardado', message: 'Receta actualizada correctamente' })
        router.push(`/recetas/${id}`)
    }

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
    )

    const imagenPreviewFinal = imagenPreview ?? imagenExistente

    return (
        <PageTransition>
            <div className="p-6 max-w-3xl mx-auto pb-safe">
                <div className="flex items-center gap-3 mb-8">
                    <Link href={`/recetas/${id}`} className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Editar receta</h1>
                </div>

                <div className="flex flex-col gap-6">
                    {/* Imagen */}
                    <FadeIn delay={0.05}>
                        <div className="card">
                            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Imagen</p>
                            {imagenPreviewFinal ? (
                                <div className="relative">
                                    <img
                                        src={imagenPreviewFinal}
                                        alt="Preview"
                                        className="w-full h-48 object-cover rounded-lg"
                                    />
                                    <button
                                        onClick={() => { setImagenFile(null); setImagenPreview(null); setImagenUrlExterna(''); setImagenExistente('') }}
                                        className="absolute top-2 right-2 rounded-full p-1 shadow"
                                        style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileRef.current?.click()}
                                    className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                                >
                                    <Upload size={20} />
                                    <span className="text-sm">Subir foto</span>
                                </button>
                            )}
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
                        </div>
                    </FadeIn>

                    {/* Datos básicos */}
                    <FadeIn delay={0.1}>
                        <div className="card flex flex-col gap-4">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Información básica</p>

                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>Nombre *</label>
                                <input className="input" placeholder="Ej: Tortitas de avena y plátano" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
                            </div>

                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>Descripción</label>
                                <textarea className="input resize-none h-20" placeholder="Breve descripción de la receta…" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Categoría</label>
                                    <select className="input" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                                        <option value="">— Seleccionar —</option>
                                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Tipo de cocción</label>
                                    <select className="input" value={form.tipo_coccion} onChange={e => setForm(p => ({ ...p, tipo_coccion: e.target.value }))}>
                                        <option value="">— Seleccionar —</option>
                                        {TIPOS_COCCION.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Dificultad</label>
                                    <select className="input" value={form.dificultad} onChange={e => setForm(p => ({ ...p, dificultad: e.target.value }))}>
                                        <option value="">— Seleccionar —</option>
                                        {['Fácil', 'Medio', 'Difícil'].map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Porciones</label>
                                    <input type="number" min={1} className="input" value={form.porciones} onChange={e => setForm(p => ({ ...p, porciones: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Qué es una porción</label>
                                    <input className="input" placeholder="Ej: 1 galleta, 2 tacos, 1 rebanada" value={form.descripcion_porcion} onChange={e => setForm(p => ({ ...p, descripcion_porcion: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Prep (min)</label>
                                    <input type="number" min={0} className="input" placeholder="15" value={form.tiempo_prep_min} onChange={e => setForm(p => ({ ...p, tiempo_prep_min: e.target.value }))} />
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Cocción (min)</label>
                                    <input type="number" min={0} className="input" placeholder="20" value={form.tiempo_coccion_min} onChange={e => setForm(p => ({ ...p, tiempo_coccion_min: e.target.value }))} />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2" style={{ color: 'var(--text-secondary)' }}>Intolerancias / apto para</label>
                                <div className="flex flex-wrap gap-2">
                                    {INTOLERANCIAS.map(i => (
                                        <button key={i} type="button" onClick={() => toggleIntolerancia(i)}
                                            className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                                            style={intolerancias.includes(i)
                                                ? { background: 'var(--primary)', borderColor: 'var(--primary)', color: '#fff' }
                                                : { color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
                                            onMouseEnter={e => { if (!intolerancias.includes(i)) { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' } }}
                                            onMouseLeave={e => { if (!intolerancias.includes(i)) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}>
                                            {i}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="mb-2" style={{ color: 'var(--text-secondary)' }}>Tags</label>
                                <TagInput
                                    tags={tags}
                                    onChange={setTags}
                                    suggestions={tagSuggestions}
                                    placeholder="Ej: mealprep, rápido, alto en proteína…"
                                />
                            </div>

                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>URL de origen</label>
                                <input className="input" placeholder="https://..." value={form.url_origen} onChange={e => setForm(p => ({ ...p, url_origen: e.target.value }))} />
                            </div>
                        </div>
                    </FadeIn>

                    {/* Ingredientes */}
                    <FadeIn delay={0.15}>
                        <div className="card">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Ingredientes</p>
                                <button onClick={añadirIngredienteLibre} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                                    <Plus size={13} /> Añadir
                                </button>
                            </div>

                            {ingredientes.some(i => !i.alimento) && (
                                <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-bg)' }}>
                                    Los ingredientes en naranja no están vinculados a la base de datos. Pulsa sobre ellos para buscarlos manualmente.
                                </p>
                            )}

                            {ingredientes.length === 0 ? (
                                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin ingredientes — añade uno para calcular macros automáticamente</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {ingredientes.map((ing) => (
                                        <div key={ing.tempId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
                                            {/* Nombre / vinculado */}
                                            <div className="flex-1 relative">
                                                {buscadorAbierto === ing.tempId ? (
                                                    <div>
                                                        <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--primary)', background: 'var(--surface)' }}>
                                                            <Search size={13} className="ml-2" style={{ color: 'var(--text-muted)' }} />
                                                            <input
                                                                autoFocus
                                                                className="flex-1 px-2 py-1.5 text-sm outline-none"
                                                                style={{ background: 'transparent', color: 'var(--text)' }}
                                                                placeholder="Buscar alimento…"
                                                                value={queryAlimento}
                                                                onChange={e => setQueryAlimento(e.target.value)}
                                                            />
                                                            <button onClick={() => { setBuscadorAbierto(null); setQueryAlimento(''); setResultados([]) }} className="px-2" style={{ color: 'var(--text-muted)' }}>
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                        {(resultados.length > 0 || buscando) && (
                                                            <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg max-h-40 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                                                {buscando && <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Buscando…</p>}
                                                                {resultados.map(a => (
                                                                    <button key={a.id} onClick={() => vincularAlimento(ing.tempId, a)}
                                                                        className="w-full text-left px-3 py-2 text-xs border-b last:border-0"
                                                                        style={{ borderColor: 'var(--border)' }}>
                                                                        <span className="font-medium" style={{ color: 'var(--text)' }}>{a.nombre}</span>
                                                                        <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{a.calorias} kcal/100g</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => { setBuscadorAbierto(ing.tempId); setQueryAlimento(ing.nombre_libre) }}
                                                        className="w-full text-left text-sm truncate"
                                                    >
                                                        {ing.nombre_libre ? (
                                                            <span className={ing.alimento ? 'font-medium' : 'underline decoration-dotted'}
                                                                style={{ color: ing.alimento ? 'var(--text)' : 'var(--warning)' }}>
                                                                {ing.nombre_libre}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)' }}>Buscar alimento…</span>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Cantidad */}
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    className="w-16 text-right border rounded px-2 py-1 text-sm outline-none"
                                                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                                                    value={ing.cantidad_gramos}
                                                    onChange={e => actualizarIngrediente(ing.tempId, 'cantidad_gramos', parseFloat(e.target.value) || 0)}
                                                />
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ing.cantidad_gramos === 0 ? 'al gusto' : 'g'}</span>
                                            </div>

                                            {/* Macros si vinculado y tiene cantidad */}
                                            {ing.alimento && ing.cantidad_gramos > 0 && (
                                                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                    {Math.round(ing.alimento.calorias * ing.cantidad_gramos / 100)} kcal
                                                </span>
                                            )}

                                            <button onClick={() => eliminarIngrediente(ing.tempId)} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Resumen macros calculados */}
                            {macrosTotales && (
                                <div className="mt-4 p-3 rounded-lg" style={{ background: 'var(--primary-bg)' }}>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--primary-dark)' }}>Macros por porción ({form.porciones} porciones)</p>
                                    <div className="flex gap-4 text-sm">
                                        <span className="font-bold" style={{ color: 'var(--primary-dark)' }}>{Math.round(macrosTotales.kcal)} kcal</span>
                                        <span style={{ color: 'var(--error)' }}>P:{Math.round(macrosTotales.proteinas)}g</span>
                                        <span style={{ color: 'var(--warning)' }}>C:{Math.round(macrosTotales.carbohidratos)}g</span>
                                        <span style={{ color: '#7C3AED' }}>G:{Math.round(macrosTotales.grasas)}g</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </FadeIn>

                    {/* Instrucciones */}
                    <FadeIn delay={0.2}>
                        <div className="card flex flex-col gap-4">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Preparación</p>
                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>Instrucciones</label>
                                <textarea className="input resize-none h-36 font-mono text-sm" placeholder={"1. Mezcla la avena con el huevo…\n2. Calienta la sartén…"} value={form.instrucciones} onChange={e => setForm(p => ({ ...p, instrucciones: e.target.value }))} />
                            </div>
                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>Consejos (opcional)</label>
                                <textarea className="input resize-none h-20" placeholder="Trucos, variaciones, sustituciones…" value={form.consejos} onChange={e => setForm(p => ({ ...p, consejos: e.target.value }))} />
                            </div>
                        </div>
                    </FadeIn>

                    {/* Guardar */}
                    <FadeIn delay={0.25}>
                        <div className="flex gap-3 justify-end pb-8">
                            <Link href={`/recetas/${id}`} className="btn-secondary">Cancelar</Link>
                            <button
                                onClick={guardar}
                                disabled={!form.nombre.trim() || guardando}
                                className="btn-primary"
                            >
                                {guardando ? (
                                    <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Guardando…</>
                                ) : 'Guardar cambios'}
                            </button>
                        </div>
                    </FadeIn>
                </div>
            </div>
        </PageTransition>
    )
}

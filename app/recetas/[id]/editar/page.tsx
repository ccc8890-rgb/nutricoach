'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Link2, X, Search, Plus, Trash2, Upload } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Alimento } from '@/types'

const CATEGORIAS = ['Desayuno', 'Comida', 'Cena', 'Merienda', 'Snack', 'Postre']
const TIPOS_COCCION = ['No Bake', 'Sartén/Wok', 'Horno', 'Horno/Airfryer', 'Microondas', 'Freidora de Aire', 'Vapor', 'Olla/Cazuela', 'Plancha']
const INTOLERANCIAS = ['Sin Gluten', 'Sin Lactosa', 'Vegano', 'Vegetariano', 'Sin Huevo', 'Sin Frutos Secos']

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
        if (!user) return

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

        if (error) { setGuardando(false); return }

        // Sincronizar ingredientes: borrar los que ya no existen, insertar/actualizar
        const idsExistentes = ingredientes.filter(i => i.id).map(i => i.id!)
        if (idsExistentes.length > 0) {
            await supabase.from('receta_ingredientes').delete().eq('receta_id', id).not('id', 'in', `(${idsExistentes.map(i => `"${i}"`).join(',')})`)
        } else {
            await supabase.from('receta_ingredientes').delete().eq('receta_id', id)
        }

        // Insertar o actualizar ingredientes
        for (let idx = 0; idx < ingredientes.length; idx++) {
            const ing = ingredientes[idx]
            if (ing.id) {
                // Actualizar existente
                await supabase.from('receta_ingredientes').update({
                    alimento_id: ing.alimento_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: idx,
                }).eq('id', ing.id)
            } else {
                // Insertar nuevo
                await supabase.from('receta_ingredientes').insert({
                    receta_id: id,
                    alimento_id: ing.alimento_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    orden: idx,
                })
            }
        }

        router.push(`/recetas/${id}`)
    }

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        </div>
    )

    const imagenPreviewFinal = imagenPreview ?? imagenExistente

    return (
        <div className="p-6 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <Link href={`/recetas/${id}`} className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
                <h1 className="text-xl font-bold text-gray-900">Editar receta</h1>
            </div>

            <div className="flex flex-col gap-6">
                {/* Imagen */}
                <div className="card">
                    <p className="text-sm font-semibold text-gray-700 mb-3">Imagen</p>
                    {imagenPreviewFinal ? (
                        <div className="relative">
                            <img
                                src={imagenPreviewFinal}
                                alt="Preview"
                                className="w-full h-48 object-cover rounded-lg"
                            />
                            <button
                                onClick={() => { setImagenFile(null); setImagenPreview(null); setImagenUrlExterna(''); setImagenExistente('') }}
                                className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileRef.current?.click()}
                            className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-green-300 hover:text-green-600 transition-colors"
                        >
                            <Upload size={20} />
                            <span className="text-sm">Subir foto</span>
                        </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
                </div>

                {/* Datos básicos */}
                <div className="card flex flex-col gap-4">
                    <p className="text-sm font-semibold text-gray-700">Información básica</p>

                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Nombre *</label>
                        <input className="input" placeholder="Ej: Tortitas de avena y plátano" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Descripción</label>
                        <textarea className="input resize-none h-20" placeholder="Breve descripción de la receta…" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Categoría</label>
                            <select className="input" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                                <option value="">— Seleccionar —</option>
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Tipo de cocción</label>
                            <select className="input" value={form.tipo_coccion} onChange={e => setForm(p => ({ ...p, tipo_coccion: e.target.value }))}>
                                <option value="">— Seleccionar —</option>
                                {TIPOS_COCCION.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Dificultad</label>
                            <select className="input" value={form.dificultad} onChange={e => setForm(p => ({ ...p, dificultad: e.target.value }))}>
                                <option value="">— Seleccionar —</option>
                                {['Fácil', 'Medio', 'Difícil'].map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Porciones</label>
                            <input type="number" min={1} className="input" value={form.porciones} onChange={e => setForm(p => ({ ...p, porciones: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Qué es una porción</label>
                            <input className="input" placeholder="Ej: 1 galleta, 2 tacos, 1 rebanada" value={form.descripcion_porcion} onChange={e => setForm(p => ({ ...p, descripcion_porcion: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Prep (min)</label>
                            <input type="number" min={0} className="input" placeholder="15" value={form.tiempo_prep_min} onChange={e => setForm(p => ({ ...p, tiempo_prep_min: e.target.value }))} />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600 mb-1">Cocción (min)</label>
                            <input type="number" min={0} className="input" placeholder="20" value={form.tiempo_coccion_min} onChange={e => setForm(p => ({ ...p, tiempo_coccion_min: e.target.value }))} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mb-2">Intolerancias / apto para</label>
                        <div className="flex flex-wrap gap-2">
                            {INTOLERANCIAS.map(i => (
                                <button key={i} type="button" onClick={() => toggleIntolerancia(i)}
                                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${intolerancias.includes(i) ? 'bg-green-600 text-white border-green-600' : 'text-gray-500 border-gray-200 hover:border-green-300'}`}>
                                    {i}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-gray-600 mb-1">URL de origen</label>
                        <input className="input" placeholder="https://..." value={form.url_origen} onChange={e => setForm(p => ({ ...p, url_origen: e.target.value }))} />
                    </div>
                </div>

                {/* Ingredientes */}
                <div className="card">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-gray-700">Ingredientes</p>
                        <button onClick={añadirIngredienteLibre} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                            <Plus size={13} /> Añadir
                        </button>
                    </div>

                    {ingredientes.some(i => !i.alimento) && (
                        <p className="text-xs text-amber-600 mb-3 bg-amber-50 px-3 py-2 rounded-lg">
                            Los ingredientes en naranja no están vinculados a la base de datos. Pulsa sobre ellos para buscarlos manualmente.
                        </p>
                    )}

                    {ingredientes.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">Sin ingredientes — añade uno para calcular macros automáticamente</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {ingredientes.map((ing) => (
                                <div key={ing.tempId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                    {/* Nombre / vinculado */}
                                    <div className="flex-1 relative">
                                        {buscadorAbierto === ing.tempId ? (
                                            <div>
                                                <div className="flex items-center border border-green-400 rounded-lg overflow-hidden bg-white">
                                                    <Search size={13} className="ml-2 text-gray-400 flex-shrink-0" />
                                                    <input
                                                        autoFocus
                                                        className="flex-1 px-2 py-1.5 text-sm outline-none"
                                                        placeholder="Buscar alimento…"
                                                        value={queryAlimento}
                                                        onChange={e => setQueryAlimento(e.target.value)}
                                                    />
                                                    <button onClick={() => { setBuscadorAbierto(null); setQueryAlimento(''); setResultados([]) }} className="px-2 text-gray-400">
                                                        <X size={13} />
                                                    </button>
                                                </div>
                                                {(resultados.length > 0 || buscando) && (
                                                    <div className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                                                        {buscando && <p className="px-3 py-2 text-xs text-gray-400">Buscando…</p>}
                                                        {resultados.map(a => (
                                                            <button key={a.id} onClick={() => vincularAlimento(ing.tempId, a)}
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b border-gray-50 last:border-0">
                                                                <span className="font-medium text-gray-800">{a.nombre}</span>
                                                                <span className="text-gray-400 ml-1">{a.calorias} kcal/100g</span>
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
                                                    <span className={
                                                        ing.alimento
                                                            ? 'text-gray-800 font-medium'
                                                            : 'text-amber-600 underline decoration-dotted'
                                                    }>
                                                        {ing.nombre_libre}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">Buscar alimento…</span>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Cantidad */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <input
                                            type="number"
                                            min={0}
                                            className="w-16 text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-green-400"
                                            value={ing.cantidad_gramos}
                                            onChange={e => actualizarIngrediente(ing.tempId, 'cantidad_gramos', parseFloat(e.target.value) || 0)}
                                        />
                                        <span className="text-xs text-gray-400">{ing.cantidad_gramos === 0 ? 'al gusto' : 'g'}</span>
                                    </div>

                                    {/* Macros si vinculado y tiene cantidad */}
                                    {ing.alimento && ing.cantidad_gramos > 0 && (
                                        <span className="text-xs text-gray-400 flex-shrink-0">
                                            {Math.round(ing.alimento.calorias * ing.cantidad_gramos / 100)} kcal
                                        </span>
                                    )}

                                    <button onClick={() => eliminarIngrediente(ing.tempId)} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Resumen macros calculados */}
                    {macrosTotales && (
                        <div className="mt-4 p-3 bg-green-50 rounded-lg">
                            <p className="text-xs font-medium text-green-700 mb-1">Macros por porción ({form.porciones} porciones)</p>
                            <div className="flex gap-4 text-sm">
                                <span className="font-bold text-green-800">{Math.round(macrosTotales.kcal)} kcal</span>
                                <span className="text-green-700">P:{Math.round(macrosTotales.proteinas)}g</span>
                                <span className="text-yellow-700">C:{Math.round(macrosTotales.carbohidratos)}g</span>
                                <span className="text-orange-700">G:{Math.round(macrosTotales.grasas)}g</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instrucciones */}
                <div className="card flex flex-col gap-4">
                    <p className="text-sm font-semibold text-gray-700">Preparación</p>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Instrucciones</label>
                        <textarea className="input resize-none h-36 font-mono text-sm" placeholder={"1. Mezcla la avena con el huevo…\n2. Calienta la sartén…"} value={form.instrucciones} onChange={e => setForm(p => ({ ...p, instrucciones: e.target.value }))} />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-600 mb-1">Consejos (opcional)</label>
                        <textarea className="input resize-none h-20" placeholder="Trucos, variaciones, sustituciones…" value={form.consejos} onChange={e => setForm(p => ({ ...p, consejos: e.target.value }))} />
                    </div>
                </div>

                {/* Guardar */}
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
            </div>
        </div>
    )
}

'use client'
import { Fragment, useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, X, Search, Plus, Trash2, Upload } from '@/components/icons/lucide'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import { FadeIn, PageTransition } from '@/components/ui/Motion'
import type { Alimento } from '@/types'
import { CATEGORIAS_PLATO, FAMILIAS_ELABORACION, FAMILIAS_PLATO, TIPOS_PLATO, TIPOS_COCCION, INTOLERANCIAS } from '@/lib/recetas-constants'
import { camposAlCambiarTipo, type TipoContenido } from '@/lib/recetas/clasificacion'
import { estudioDeFormulario, estudioVacio, formularioDeEstudio, validarEstudio, UNIDADES_RENDIMIENTO, type FormEstudio } from '@/lib/recetas/estudio'
import { KNOWN_TAGS } from '@/lib/auto-tag'
import { useToast } from '@/components/ui/Toast'
import { TagInput } from '@/components/ui/TagInput'
import ReportarProblema from '@/components/recetas/ReportarProblema'
import TaxonomiaRecetaPanel, { type TaxonomiaReceta } from '@/components/recetas/TaxonomiaRecetaPanel'

interface Ingrediente {
    id?: string
    tempId: string
    alimento_id: string | null
    nombre_libre: string
    cantidad_gramos: number
    cantidad_original?: number | null
    unidad_display?: string | null
    /** Fase de la receta (p. ej. «Fajitas», «Masa»): se conserva al guardar y agrupa la lista */
    grupo?: string | null
    alimento?: Alimento
    /** Línea que es una elaboración (poolish, masa, salsa…) en vez de un alimento */
    elaboracion_id?: string | null
    elaboracion?: ElaboracionEnlazada
}

interface ElaboracionEnlazada {
    id: string
    nombre: string
    categoria?: string | null
    kcal100: number
    macros100: { kcal: number; proteinas: number; carbohidratos: number; grasas: number; fibra: number }
}

export default function EditarRecetaPage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const returnToParam = useSearchParams().get('returnTo')
    const volverReceta = returnToParam ? `/recetas/${id}?returnTo=${encodeURIComponent(returnToParam)}` : `/recetas/${id}`
    const fileRef = useRef<HTMLInputElement>(null)
    const { addToast } = useToast()

    const [loading, setLoading] = useState(true)
    const [form, setForm] = useState({
        nombre: '',
        descripcion: '',
        instrucciones: '',
        consejos: '',
        categoria: '',
        tipo: 'plato' as TipoContenido,
        familia: '',
        tipo_plato: '',
        tipo_coccion: '',
        dificultad: '',
        porciones: '1',
        descripcion_porcion: '',
        tiempo_prep_min: '',
        tiempo_coccion_min: '',
        url_origen: '',
        peso_final_g: '',
    })
    const [intolerancias, setIntolerancias] = useState<string[]>([])
    const [tags, setTags] = useState<string[]>([])
    const [taxonomia, setTaxonomia] = useState<TaxonomiaReceta>({
        objetivos: [],
        deportes: [],
        momentos: [],
        estilos: [],
        premium_chef: false,
        uso_personal: false,
        batch_cooking: false,
        tupper: false,
        digestibilidad: '',
        densidad_energetica: '',
        nivel_elaboracion: 2,
        adherencia_score: 70,
        coste_estimado_nivel: '',
    })
    const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
    const [imagenFile, setImagenFile] = useState<File | null>(null)
    const [imagenPreview, setImagenPreview] = useState<string | null>(null)
    const [imagenUrlExterna, setImagenUrlExterna] = useState('')
    const [imagenExistente, setImagenExistente] = useState('')

    // Buscador de alimentos para ingredientes
    const [buscadorAbierto, setBuscadorAbierto] = useState<string | null>(null)
    const [queryAlimento, setQueryAlimento] = useState('')
    const [resultados, setResultados] = useState<Alimento[]>([])
    const [resultadosElab, setResultadosElab] = useState<ElaboracionEnlazada[]>([])
    const [buscando, setBuscando] = useState(false)

    const [guardando, setGuardando] = useState(false)
    const [estadoReceta, setEstadoReceta] = useState('')
    const [tipoRecetaActual, setTipoRecetaActual] = useState<string | null>(null)
    const [tipoOriginal, setTipoOriginal] = useState<TipoContenido>('plato')
    // Capa «Estudio» (cocina profesional): solo se guarda si se rellena algo
    const [estudioForm, setEstudioForm] = useState<FormEstudio>(formularioDeEstudio(null))
    const [teniaEstudio, setTeniaEstudio] = useState(false)
    const [estudioAbierto, setEstudioAbierto] = useState(false)
    const [reportando, setReportando] = useState(false)

    // Cargar datos existentes
    useEffect(() => {
        async function load() {
            const [recetaRes, ingRes] = await Promise.all([
                supabase.from('recetas').select('*').eq('id', id).single(),
                supabase.from('receta_ingredientes').select('*, alimento:alimentos(*)').eq('receta_id', id).order('orden'),
            ])

            const receta = recetaRes.data
            if (!receta) return
            setEstadoReceta(receta.estado ?? '')
            setTipoRecetaActual(receta.tipo_receta ?? null)
            setTipoOriginal(receta.tipo_contenido === 'elaboracion' ? 'elaboracion' : 'plato')
            const est = validarEstudio(receta.estudio)
            setEstudioForm(formularioDeEstudio(est))
            setTeniaEstudio(!estudioVacio(est))
            setEstudioAbierto(!estudioVacio(est))

            setForm({
                nombre: receta.nombre ?? '',
                descripcion: receta.descripcion ?? '',
                instrucciones: receta.instrucciones ?? '',
                consejos: receta.consejos ?? '',
                categoria: receta.categoria ?? '',
                tipo: (receta.tipo_contenido === 'elaboracion' ? 'elaboracion' : 'plato') as TipoContenido,
                familia: receta.familia ?? '',
                tipo_plato: receta.tipo_plato ?? '',
                tipo_coccion: receta.tipo_coccion ?? '',
                dificultad: receta.dificultad ?? '',
                porciones: String(receta.porciones ?? 1),
                descripcion_porcion: receta.descripcion_porcion ?? '',
                tiempo_prep_min: receta.tiempo_prep_min ? String(receta.tiempo_prep_min) : '',
                tiempo_coccion_min: receta.tiempo_coccion_min ? String(receta.tiempo_coccion_min) : '',
                url_origen: receta.url_origen ?? '',
                peso_final_g: receta.peso_final_g ? String(receta.peso_final_g) : '',
            })

            setIntolerancias(receta.intolerancias ?? [])
            setTags(receta.tags ?? [])
            setTaxonomia({
                objetivos: receta.objetivos ?? [],
                deportes: receta.deportes ?? [],
                momentos: receta.momentos ?? [],
                estilos: receta.estilos ?? [],
                premium_chef: Boolean(receta.premium_chef),
                uso_personal: Boolean(receta.uso_personal),
                batch_cooking: Boolean(receta.batch_cooking),
                tupper: Boolean(receta.tupper),
                digestibilidad: receta.digestibilidad ?? '',
                densidad_energetica: receta.densidad_energetica ?? '',
                nivel_elaboracion: receta.nivel_elaboracion ?? 2,
                adherencia_score: receta.adherencia_score ?? 70,
                coste_estimado_nivel: receta.coste_estimado_nivel ?? '',
            })
            setImagenExistente(receta.imagen_url ?? '')
            setImagenUrlExterna(receta.imagen_url ?? '')

            // Datos de las elaboraciones ya enlazadas (nombre y macros por 100 g)
            const idsElab = [...new Set((ingRes.data ?? []).map(i => i.elaboracion_id).filter(Boolean))] as string[]
            let enlazadas: ElaboracionEnlazada[] = []
            if (idsElab.length > 0) {
                try {
                    const r = await fetch(`/api/recetas/elaboraciones?ids=${idsElab.join(',')}`)
                    if (r.ok) enlazadas = (await r.json()).elaboraciones ?? []
                } catch { /* sin datos: la línea se ve sin kcal */ }
            }
            setIngredientes((ingRes.data ?? []).map(ing => ({
                id: ing.id,
                tempId: crypto.randomUUID(),
                elaboracion_id: ing.elaboracion_id ?? null,
                elaboracion: enlazadas.find(e => e.id === ing.elaboracion_id),
                alimento_id: ing.alimento_id,
                nombre_libre: ing.nombre_libre ?? ing.alimento?.nombre ?? '',
                cantidad_gramos: ing.cantidad_gramos,
                cantidad_original: ing.cantidad_original ?? null,
                unidad_display: ing.unidad_display ?? null,
                grupo: ing.grupo ?? null,
                alimento: ing.alimento,
            })))

            setLoading(false)
        }
        load()
    }, [id])

    // Búsqueda de alimentos via API (service_role bypass RLS)
    useEffect(() => {
        if (!queryAlimento || queryAlimento.length < 2) { setResultados([]); setResultadosElab([]); return }
        setBuscando(true)
        const timer = setTimeout(async () => {
            try {
                const [res, resElab] = await Promise.all([
                    fetch(`/api/alimentos?q=${encodeURIComponent(queryAlimento)}&custom=all`),
                    fetch(`/api/recetas/elaboraciones?q=${encodeURIComponent(queryAlimento)}`),
                ])
                setResultados(res.ok ? (await res.json()) ?? [] : [])
                // No se puede enlazar una receta dentro de sí misma
                setResultadosElab(resElab.ok ? ((await resElab.json()).elaboraciones ?? []).filter((e: ElaboracionEnlazada) => e.id !== id) : [])
            } catch {
                setResultados([])
                setResultadosElab([])
            }
            setBuscando(false)
        }, 300)
        return () => clearTimeout(timer)
    }, [queryAlimento, id])

    function añadirIngredienteLibre(grupo?: string | null) {
        const nuevo: Ingrediente = { tempId: crypto.randomUUID(), alimento_id: null, nombre_libre: '', cantidad_gramos: 100, grupo: grupo ?? null }
        setIngredientes(prev => {
            // Dentro de una fase, el ingrediente nuevo va al final de esa fase
            const ultimo = grupo ? prev.map(i => i.grupo).lastIndexOf(grupo) : -1
            return ultimo < 0 ? [...prev, nuevo] : [...prev.slice(0, ultimo + 1), nuevo, ...prev.slice(ultimo + 1)]
        })
    }

    function vincularAlimento(tempId: string, alimento: Alimento) {
        setIngredientes(prev => prev.map(i => i.tempId === tempId
            ? { ...i, alimento_id: alimento.id, nombre_libre: alimento.nombre, alimento, elaboracion_id: null, elaboracion: undefined }
            : i
        ))
        setBuscadorAbierto(null)
        setQueryAlimento('')
        setResultados([])
        setResultadosElab([])
    }

    function vincularElaboracion(tempId: string, e: ElaboracionEnlazada) {
        setIngredientes(prev => prev.map(i => i.tempId === tempId
            ? { ...i, alimento_id: null, alimento: undefined, nombre_libre: e.nombre, elaboracion_id: e.id, elaboracion: e }
            : i
        ))
        setBuscadorAbierto(null)
        setQueryAlimento('')
        setResultados([])
        setResultadosElab([])
    }

    function actualizarIngrediente(tempId: string, campo: 'nombre_libre' | 'cantidad_gramos' | 'cantidad_original' | 'unidad_display', valor: string | number | null) {
        setIngredientes(prev => prev.map(i => i.tempId === tempId ? { ...i, [campo]: valor } : i))
    }

    /** La equivalencia casera («= 2 huevos») solo se ofrece si ya la tiene o si es algo que se cuenta; la ficha ya deduce el resto por el nombre */
    function equivalenciaVisible(ing: Ingrediente) {
        if (/^(g|gr|gramos?|ml)$/i.test(ing.unidad_display?.trim() ?? '')) return false // «150 g = 150 g» no aporta nada
        if (ing.unidad_display?.trim() || ing.cantidad_original) return true
        const nom = ing.nombre_libre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return /^(huevos?|claras?|yemas?|yogur(es)?|ajo)\b/.test(nom) && !/polvo/.test(nom)
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

    // Una ficha es elaboración (masa, salsa, fondo…) cuando así se elige en «Tipo»
    const esElaboracion = form.tipo === 'elaboracion'

    // Calcular macros totales por porción
    const macrosTotales = (() => {
        const porcion = parseInt(form.porciones) || 1
        // Una línea cuenta con los macros de su alimento o, si es una elaboración, con los suyos por 100 g
        const macrosBase = (i: Ingrediente) => i.elaboracion
            ? { calorias: i.elaboracion.macros100.kcal, proteinas: i.elaboracion.macros100.proteinas, carbohidratos: i.elaboracion.macros100.carbohidratos, grasas: i.elaboracion.macros100.grasas, fibra: i.elaboracion.macros100.fibra }
            : i.alimento ? { calorias: i.alimento.calorias, proteinas: i.alimento.proteinas, carbohidratos: i.alimento.carbohidratos, grasas: i.alimento.grasas, fibra: i.alimento.fibra ?? 0 } : null
        const ingConAlimento = ingredientes.filter(i => macrosBase(i))
        if (ingConAlimento.length === 0) return null
        const total = sumarMacros(ingConAlimento.map(i => {
            const m = macrosBase(i)!
            return calcularMacrosPorCantidad(m.calorias, m.proteinas, m.carbohidratos, m.grasas, m.fibra, i.cantidad_gramos)
        }))
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

        // Enlazar elaboraciones: comprobar antes de guardar que no se crea un ciclo (A dentro de B y B dentro de A)
        const idsElab = [...new Set(ingredientes.map(i => i.elaboracion_id).filter(Boolean))] as string[]
        if (idsElab.length > 0) {
            const val = await fetch(`/api/recetas/${id}/enlaces`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ elaboracion_ids: idsElab }) }).catch(() => null)
            if (!val || !val.ok) {
                const msg = val ? (await val.json().catch(() => null))?.error : null
                addToast({ type: 'error', title: 'No se puede enlazar', message: msg ?? 'No se pudo comprobar el enlace de elaboraciones' })
                setGuardando(false)
                return
            }
        }

        // Una elaboración en uso no puede pasar a plato: las recetas que la llevan perderían sus ingredientes
        if (tipoOriginal === 'elaboracion' && form.tipo === 'plato') {
            const { count } = await supabase.from('receta_ingredientes').select('id', { count: 'exact', head: true }).eq('elaboracion_id', id)
            if (count && count > 0) {
                addToast({ type: 'error', title: 'No se puede convertir en plato', message: `Esta elaboración se usa en ${count} ${count === 1 ? 'línea de receta' : 'líneas de receta'}: quítala de ellas primero.` })
                setGuardando(false)
                return
            }
        }

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
            peso_final_g: form.peso_final_g.trim() ? parseFloat(form.peso_final_g) || null : null,
            // Estudio: solo se escribe si hay datos (o para vaciarlo si antes los había): una base sin la columna sigue guardando con normalidad
            ...(() => { const est = estudioDeFormulario(estudioForm); return !estudioVacio(est) ? { estudio: est } : teniaEstudio ? { estudio: null } : {} })(),
            // Tipo y familia: una elaboración lleva categoría «Elaboración» y la marca interna salsa_base; un plato conserva su momento del día
            ...camposAlCambiarTipo({ nombre: form.nombre, tipo: form.tipo, familia: form.familia || null, categoria: form.categoria || null, kcal: macrosTotales?.kcal, proteinas: macrosTotales?.proteinas, tipoRecetaActual }),
            tipo_plato: form.tipo_plato || null,
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
            objetivos: taxonomia.objetivos,
            deportes: taxonomia.deportes,
            momentos: taxonomia.momentos,
            estilos: taxonomia.estilos,
            premium_chef: taxonomia.premium_chef,
            uso_personal: taxonomia.uso_personal,
            batch_cooking: taxonomia.batch_cooking,
            tupper: taxonomia.tupper,
            digestibilidad: taxonomia.digestibilidad || null,
            densidad_energetica: taxonomia.densidad_energetica || null,
            nivel_elaboracion: taxonomia.nivel_elaboracion,
            adherencia_score: taxonomia.adherencia_score,
            coste_estimado_nivel: taxonomia.coste_estimado_nivel || null,
            taxonomia_version: 2,
            taxonomia_actualizada_at: new Date().toISOString(),
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
                    alimento_id: ing.elaboracion_id ? null : ing.alimento_id || null,
                    elaboracion_id: ing.elaboracion_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    cantidad_original: ing.unidad_display?.trim() ? ing.cantidad_original : null,
                    unidad_display: ing.unidad_display?.trim() || null,
                    grupo: ing.grupo || null,
                    orden: idx,
                }).eq('id', ing.id)
                : await supabase.from('receta_ingredientes').insert({
                    receta_id: id,
                    alimento_id: ing.elaboracion_id ? null : ing.alimento_id || null,
                    elaboracion_id: ing.elaboracion_id || null,
                    nombre_libre: ing.nombre_libre || null,
                    cantidad_gramos: ing.cantidad_gramos,
                    cantidad_original: ing.unidad_display?.trim() ? ing.cantidad_original : null,
                    unidad_display: ing.unidad_display?.trim() || null,
                    grupo: ing.grupo || null,
                    orden: idx,
                })
            if (ingErr) addToast({ type: 'error', title: 'Error', message: 'Error al guardar ingrediente: ' + ingErr.message })
        }

        // Con elaboraciones enlazadas, o si esta receta ES una elaboración, los macros se recalculan en servidor (y en las recetas que la usan)
        if (idsElab.length > 0 || esElaboracion) {
            const rec = await fetch(`/api/recetas/${id}/recalcular`, { method: 'POST' }).catch(() => null)
            if (!rec || !rec.ok) addToast({ type: 'error', title: 'Macros', message: 'Se guardó, pero no se pudieron recalcular los macros de las recetas que usan esta elaboración' })
        }

        addToast({ type: 'success', title: 'Guardado', message: 'Receta actualizada correctamente' })
        router.push(volverReceta)
    }

    if (loading) return (
        <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
        </div>
    )

    const imagenPreviewFinal = imagenPreview ?? imagenExistente

    return (
        <PageTransition className="coach-recipe-editor">
            <div className="p-6 max-w-6xl mx-auto pb-safe">
                <div className="flex items-center gap-3 mb-8">
                    <Link href={volverReceta} className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Editar receta</h1>
                    <div className="ml-auto flex items-center gap-2">
                        {estadoReceta === 'aprobada' && (
                            <button type="button" onClick={() => setReportando(true)}
                                className="rounded-lg border px-3 py-1.5 text-sm font-medium"
                                style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                                Pasar a revisión
                            </button>
                        )}
                        <button
                            onClick={guardar}
                            disabled={!form.nombre.trim() || guardando}
                            className="btn-primary"
                        >
                            {guardando ? 'Guardando…' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] items-start">
                        <div className="flex flex-col gap-6 min-w-0">
                    {/* Datos básicos */}
                    <FadeIn delay={0.1}>
                        <div className="card flex flex-col gap-4">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Receta</p>

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
                                    <label style={{ color: 'var(--text-secondary)' }}>Porciones</label>
                                    <input type="number" min={1} className="input" value={form.porciones} onChange={e => setForm(p => ({ ...p, porciones: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                    </FadeIn>

                    {/* Ingredientes */}
                    <FadeIn delay={0.15}>
                        <div className="card">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Ingredientes</p>
                                <button onClick={() => añadirIngredienteLibre()} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                                    <Plus size={13} /> Añadir
                                </button>
                            </div>

                            {ingredientes.some(i => !i.alimento && !i.elaboracion_id) && (
                                <p className="text-xs mb-3 px-3 py-2 rounded-lg" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-bg)' }}>
                                    Los ingredientes en naranja no están vinculados a la base de datos. Pulsa sobre ellos para buscarlos manualmente.
                                </p>
                            )}

                            {ingredientes.length === 0 ? (
                                <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>Sin ingredientes — añade uno para calcular macros automáticamente</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {ingredientes.map((ing, idx) => (
                                        <Fragment key={ing.tempId}>
                                        {ingredientes.some(i => i.grupo) && ing.grupo !== (ingredientes[idx - 1]?.grupo ?? null) && (
                                            <div className="flex items-center justify-between pt-3 first:pt-0">
                                                <p className="coach-recipe-kicker">{ing.grupo ?? 'Otros'}</p>
                                                {ing.grupo && (
                                                    <button type="button" onClick={() => añadirIngredienteLibre(ing.grupo)} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                                                        <Plus size={12} /> Añadir a {ing.grupo}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
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
                                                                autoComplete="off"
                                                            />
                                                            <button onClick={() => { setBuscadorAbierto(null); setQueryAlimento(''); setResultados([]) }} className="px-2" style={{ color: 'var(--text-muted)' }}>
                                                                <X size={13} />
                                                            </button>
                                                        </div>
                                                        {(resultados.length > 0 || resultadosElab.length > 0 || buscando) && (
                                                            <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg max-h-40 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                                                                {buscando && <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Buscando…</p>}
                                                                {resultadosElab.map(e => (
                                                                    <button key={e.id} onClick={() => vincularElaboracion(ing.tempId, e)}
                                                                        className="w-full text-left px-3 py-2 text-xs border-b last:border-0"
                                                                        style={{ borderColor: 'var(--border)' }}>
                                                                        <span className="font-medium" style={{ color: 'var(--text)' }}>{e.nombre}</span>
                                                                        <span className="ml-1 uppercase tracking-wide" style={{ color: 'var(--text-muted)', fontSize: 10 }}>Elaboración</span>
                                                                        <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{e.kcal100} kcal/100g</span>
                                                                    </button>
                                                                ))}
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
                                                            <span className={ing.alimento || ing.elaboracion_id ? 'font-medium' : 'underline decoration-dotted'}
                                                                style={{ color: ing.alimento || ing.elaboracion_id ? 'var(--text)' : 'var(--warning)' }}>
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
                                                    className="w-20 text-right border rounded px-2 py-1 text-sm outline-none"
                                                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                                                    value={ing.cantidad_gramos}
                                                    onChange={e => actualizarIngrediente(ing.tempId, 'cantidad_gramos', parseFloat(e.target.value) || 0)}
                                                />
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ing.cantidad_gramos === 0 ? 'al gusto' : 'g'}</span>
                                                {equivalenciaVisible(ing) && (<>
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>=</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    step="any"
                                                    placeholder="cant."
                                                    title="Equivalencia casera, opcional: cantidad (ej. 2)"
                                                    className="w-20 text-right border rounded px-2 py-1 text-sm outline-none"
                                                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                                                    value={ing.cantidad_original ?? ''}
                                                    onChange={e => actualizarIngrediente(ing.tempId, 'cantidad_original', e.target.value === '' ? null : parseFloat(e.target.value))}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="unidad"
                                                    title="Equivalencia casera, opcional: unidad (huevos, cucharadas, yogur…)"
                                                    className="w-24 border rounded px-2 py-1 text-sm outline-none"
                                                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                                                    value={ing.unidad_display ?? ''}
                                                    onChange={e => actualizarIngrediente(ing.tempId, 'unidad_display', e.target.value)}
                                                />
                                                </>)}
                                            </div>

                                            {/* Macros si vinculado y tiene cantidad */}
                                            {(ing.alimento || ing.elaboracion) && ing.cantidad_gramos > 0 && (
                                                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                    {Math.round((ing.elaboracion ? ing.elaboracion.kcal100 : ing.alimento!.calorias) * ing.cantidad_gramos / 100)} kcal
                                                </span>
                                            )}

                                            <button onClick={() => eliminarIngrediente(ing.tempId)} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        </Fragment>
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

                    {/* Estudio (cocina profesional) */}
                    <FadeIn delay={0.18}>
                        <details className="card" open={estudioAbierto} onToggle={e => setEstudioAbierto((e.currentTarget as HTMLDetailsElement).open)}>
                            <summary className="cursor-pointer text-sm font-semibold" style={{ color: 'var(--text)' }}>Estudio (cocina profesional) <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· opcional: solo coach</span></summary>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Rinde</label>
                                    <div className="flex gap-2">
                                        <input type="text" inputMode="decimal" className="input" placeholder="900" value={estudioForm.rendimiento_cantidad} onChange={e => setEstudioForm(p => ({ ...p, rendimiento_cantidad: e.target.value }))} />
                                        <select className="input" value={estudioForm.rendimiento_unidad} onChange={e => setEstudioForm(p => ({ ...p, rendimiento_unidad: e.target.value }))}>
                                            <option value="">—</option>
                                            {UNIDADES_RENDIMIENTO.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div><label style={{ color: 'var(--text-secondary)' }}>Tiempo activo (min)</label><input type="number" min={0} className="input" value={estudioForm.tiempo_activo_min} onChange={e => setEstudioForm(p => ({ ...p, tiempo_activo_min: e.target.value }))} /></div>
                                    <div><label style={{ color: 'var(--text-secondary)' }}>Tiempo total (min)</label><input type="number" min={0} className="input" value={estudioForm.tiempo_total_min} onChange={e => setEstudioForm(p => ({ ...p, tiempo_total_min: e.target.value }))} /></div>
                                </div>
                                <div className="col-span-2"><label style={{ color: 'var(--text-secondary)' }}>Mise en place</label><textarea className="input resize-none h-16" placeholder="Mantequilla a 16 °C, huevos a temperatura ambiente…" value={estudioForm.mise_en_place} onChange={e => setEstudioForm(p => ({ ...p, mise_en_place: e.target.value }))} /></div>
                                <div className="col-span-2"><label style={{ color: 'var(--text-secondary)' }}>Porcionado</label><input type="text" className="input" placeholder="12 piezas de 75 g" value={estudioForm.porcionado} onChange={e => setEstudioForm(p => ({ ...p, porcionado: e.target.value }))} /></div>
                                <div className="col-span-2 grid grid-cols-3 gap-2">
                                    <div><label style={{ color: 'var(--text-secondary)' }}>Ambiente (h)</label><input type="text" inputMode="decimal" className="input" value={estudioForm.ambiente_h} onChange={e => setEstudioForm(p => ({ ...p, ambiente_h: e.target.value }))} /></div>
                                    <div><label style={{ color: 'var(--text-secondary)' }}>Nevera (días)</label><input type="text" inputMode="decimal" className="input" value={estudioForm.nevera_dias} onChange={e => setEstudioForm(p => ({ ...p, nevera_dias: e.target.value }))} /></div>
                                    <div><label style={{ color: 'var(--text-secondary)' }}>Congelador (meses)</label><input type="text" inputMode="decimal" className="input" value={estudioForm.congelador_meses} onChange={e => setEstudioForm(p => ({ ...p, congelador_meses: e.target.value }))} /></div>
                                </div>
                                <div className="col-span-2"><label style={{ color: 'var(--text-secondary)' }}>Notas de conservación</label><input type="text" className="input" placeholder="En bolsa hermética" value={estudioForm.conservacion_notas} onChange={e => setEstudioForm(p => ({ ...p, conservacion_notas: e.target.value }))} /></div>
                                <div><label style={{ color: 'var(--text-secondary)' }}>Equipo</label><input type="text" className="input" placeholder="Amasadora, termómetro" value={estudioForm.equipo} onChange={e => setEstudioForm(p => ({ ...p, equipo: e.target.value }))} /></div>
                                <div><label style={{ color: 'var(--text-secondary)' }}>Origen / cocina</label><input type="text" className="input" placeholder="Francia" value={estudioForm.origen} onChange={e => setEstudioForm(p => ({ ...p, origen: e.target.value }))} /></div>
                                <div className="col-span-2"><label style={{ color: 'var(--text-secondary)' }}>Variantes</label><textarea className="input resize-none h-16" placeholder="Sin lactosa con mantequilla clarificada…" value={estudioForm.variantes} onChange={e => setEstudioForm(p => ({ ...p, variantes: e.target.value }))} /></div>
                            </div>
                        </details>
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

                        </div>
                        <div className="flex flex-col gap-6 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
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

                    <details className="card">
                        <summary className="cursor-pointer select-none text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            Clasificación y datos
                            <span className="block text-xs font-normal mt-1" style={{ color: 'var(--text-muted)' }}>{form.porciones || '—'} porciones · {form.tipo_plato || 'sin tipo'} · {form.tipo_coccion || 'sin cocción'} · {form.dificultad || 'sin dificultad'}</span>
                        </summary>
                        <div className="flex flex-col gap-4 mt-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Tipo</label>
                                    <select className="input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value as TipoContenido, familia: '' }))}>
                                        <option value="plato">Plato</option>
                                        <option value="elaboracion">Elaboración (masa, salsa, fondo…)</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Familia</label>
                                    <select className="input" value={form.familia} onChange={e => setForm(p => ({ ...p, familia: e.target.value }))}>
                                        <option value="">— Seleccionar —</option>
                                        {(esElaboracion ? FAMILIAS_ELABORACION : FAMILIAS_PLATO).map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                {!esElaboracion && (
                                    <div>
                                        <label style={{ color: 'var(--text-secondary)' }}>Categoría (cuándo se come)</label>
                                        <select className="input" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                                            <option value="">— Seleccionar —</option>
                                            {CATEGORIAS_PLATO.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label style={{ color: 'var(--text-secondary)' }}>Tipo de plato</label>
                                    <select className="input" value={form.tipo_plato} onChange={e => setForm(p => ({ ...p, tipo_plato: e.target.value }))}>
                                        <option value="">— Seleccionar —</option>
                                        {TIPOS_PLATO.filter(t => t !== 'Salsa' && t !== 'Acompañamiento').map(t => <option key={t} value={t}>{t}</option>)}
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
                                {esElaboracion && (
                                    <div>
                                        <label style={{ color: 'var(--text-secondary)' }}>Peso final (g)</label>
                                        <input type="number" min={1} className="input" placeholder="Suma de ingredientes" title="Peso del producto terminado: una masa pierde agua al cocinar. Vacío = suma de los ingredientes" value={form.peso_final_g} onChange={e => setForm(p => ({ ...p, peso_final_g: e.target.value }))} />
                                    </div>
                                )}
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
                                <label className="mb-2" style={{ color: 'var(--text-secondary)' }}>Alérgenos / clasificación dietética</label>
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
                                <label className="mb-1" style={{ color: 'var(--text-secondary)' }}>Clasificación</label>
                                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                                    Cómo aparece en los filtros del recetario. Una receta puede tener varios.
                                </p>
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                    {KNOWN_TAGS.map(tag => {
                                        const active = tags.includes(tag)
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => setTags(active ? tags.filter(t => t !== tag) : [...tags, tag])}
                                                className="text-xs px-2.5 py-1 rounded-full border transition-all"
                                                style={active ? {
                                                    background: 'var(--accent-bg)',
                                                    color: 'var(--text)',
                                                    fontWeight: 600,
                                                    borderColor: 'var(--accent)',
                                                } : {
                                                    background: 'transparent',
                                                    color: 'var(--text-secondary)',
                                                    borderColor: 'var(--border)',
                                                }}
                                            >
                                                {tag}
                                            </button>
                                        )
                                    })}
                                </div>
                                <TagInput
                                    tags={tags.filter(t => !KNOWN_TAGS.includes(t))}
                                    onChange={custom => setTags([...tags.filter(t => KNOWN_TAGS.includes(t)), ...custom])}
                                    placeholder="Tag personalizado (ej: mealprep, rápido…)"
                                />
                            </div>

                            <div>
                                <label style={{ color: 'var(--text-secondary)' }}>URL de origen</label>
                                <input className="input" placeholder="https://..." value={form.url_origen} onChange={e => setForm(p => ({ ...p, url_origen: e.target.value }))} />
                            </div>

                            <TaxonomiaRecetaPanel value={taxonomia} onChange={setTaxonomia} />
                        </div>
                    </details>
                        </div>
                    </div>

                    {/* Guardar */}
                    <FadeIn delay={0.25}>
                        <div className="flex gap-3 justify-end pb-8">
                            <Link href={volverReceta} className="btn-secondary">Cancelar</Link>
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
            <ReportarProblema ids={[id]} abierto={reportando} onCerrar={() => setReportando(false)} onHecho={() => { window.location.href = returnToParam && returnToParam.startsWith('/') ? returnToParam : '/recetas' }} />
        </PageTransition>
    )
}

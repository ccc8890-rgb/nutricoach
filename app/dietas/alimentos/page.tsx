'use client'

import { useEffect, useState, useCallback } from 'react'
import { useDebounce } from '@/lib/useDebounce'
import { Plus, Search, Loader2, Pencil, Trash2, Apple, UtensilsCrossed, Wheat, Beef, Milk, Egg, Fish, Sun, FlaskConical, Cookie, Coffee, CircleDot, Database, Download, ChevronDown, ChevronRight, Brain, CheckCircle, XCircle } from 'lucide-react'
import type { Alimento } from '@/types'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/Modal'
import { SkeletonCard } from '@/components/ui/Skeleton'

// Categorías en orden lógico de grupos alimenticios
const CATEGORIAS = [
    'Carnes', 'Pescados', 'Huevos', 'Lácteos',
    'Verduras', 'Frutas', 'Legumbres', 'Cereales', 'Tubérculos',
    'Grasas', 'Frutos secos', 'Semillas', 'Condimentos',
    'Bebidas', 'Suplementos', 'Otros', 'Supermercado',
]

// Orden de display de categorías (el mismo array define la prioridad)
const CATEGORY_ORDER = CATEGORIAS

const CATEGORIA_ICON: Record<string, typeof Beef> = {
    Carnes: Beef,
    Pescados: Fish,
    Huevos: Egg,
    Lácteos: Milk,
    Suplementos: FlaskConical,
    Cereales: Wheat,
    Tubérculos: CircleDot,
    Legumbres: CircleDot,
    Verduras: Sun,
    Frutas: Apple,
    Grasas: Cookie,
    'Frutos secos': CircleDot,
    Semillas: CircleDot,
    Condimentos: Coffee,
    Otros: UtensilsCrossed,
    Bebidas: Coffee,
    Supermercado: CircleDot,
}

const CATEGORIA_COLOR: Record<string, string> = {
    Carnes: '#EF4444',
    Pescados: '#3B82F6',
    Huevos: '#A1A1A6',
    Lácteos: '#8B5CF6',
    Suplementos: '#1C1C1E',
    Cereales: '#8E8E93',
    Tubérculos: '#92400E',
    Legumbres: '#65A30D',
    Verduras: '#22C55E',
    Frutas: '#F97316',
    Grasas: '#EC4899',
    'Frutos secos': '#A855F7',
    Semillas: '#06B6D4',
    Condimentos: '#6B7280',
    Otros: '#78716C',
    Bebidas: '#0EA5E9',
    Supermercado: '#9CA3AF',
}

const NUTRI_LABELS = [
    { key: 'calorias', label: 'Calorías', unit: 'kcal', color: '#EF4444' },
    { key: 'proteinas', label: 'Proteínas', unit: 'g', color: '#3B82F6' },
    { key: 'carbohidratos', label: 'Carbohidratos', unit: 'g', color: '#A1A1A6' },
    { key: 'grasas', label: 'Grasas', unit: 'g', color: '#8B5CF6' },
    { key: 'fibra', label: 'Fibra', unit: 'g', color: '#22C55E' },
] as const satisfies readonly { key: keyof Alimento; label: string; unit: string; color: string }[]

const FORM_VACIO = { nombre: '', categoria: 'Supermercado', calorias: '', proteinas: '', carbohidratos: '', grasas: '', fibra: '' }

// Perfil lipídico visible directamente en la card (cuando el alimento tiene datos)
const LIPID_HIGHLIGHTS: { key: keyof Alimento; label: string; color: string }[] = [
    { key: 'saturados_g', label: 'Sat', color: '#EF4444' },
    { key: 'monoinsaturados_g', label: 'Mono', color: '#F97316' },
    { key: 'poliinsaturados_g', label: 'Ω-3/6', color: '#3B82F6' },
    { key: 'colesterol_mg', label: 'Colest', color: '#8B5CF6' },
]

// Vitaminas y minerales más relevantes clínicamente
const MICRO_HIGHLIGHTS: { key: keyof Alimento; label: string; unit: string; color: string }[] = [
    { key: 'vitamina_d_ug', label: 'Vit D', unit: 'µg', color: '#F59E0B' },
    { key: 'vitamina_c_mg', label: 'Vit C', unit: 'mg', color: '#F97316' },
    { key: 'vitamina_b12_ug', label: 'B12', unit: 'µg', color: '#10B981' },
    { key: 'calcio_mg', label: 'Ca', unit: 'mg', color: '#6366F1' },
    { key: 'hierro_mg', label: 'Fe', unit: 'mg', color: '#EF4444' },
    { key: 'zinc_mg', label: 'Zn', unit: 'mg', color: '#8B5CF6' },
    { key: 'magnesio_mg', label: 'Mg', unit: 'mg', color: '#06B6D4' },
]

// Configuración de badges de fuente
// IMPORTANTE: 'curada' está excluido explícitamente — es el valor por defecto
// y mostrarlo solo añade ruido visual. Solo mostramos badges cuando la fuente
// es relevante (BEDCA, OFF, IA, Coach).
const FUENTE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    bedca: { label: 'BEDCA', color: '#1C1C1E', bg: '#F2F2F7', border: '#E5E5EA' },
    openfoodfacts: { label: 'OFF', color: '#F97316', bg: '#FFF7ED', border: '#FED7AA' },
    ia: { label: 'IA', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
    coach: { label: 'Coach', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
}

// Categorías de micronutrientes para el acordeón
const MICRO_GRUPOS: { titulo: string; campos: { key: keyof Alimento; label: string; unit: string }[] }[] = [
    {
        titulo: 'Vitaminas',
        campos: [
            { key: 'vitamina_a_ug', label: 'Vitamina A', unit: 'µg' },
            { key: 'vitamina_c_mg', label: 'Vitamina C', unit: 'mg' },
            { key: 'vitamina_d_ug', label: 'Vitamina D', unit: 'µg' },
            { key: 'vitamina_e_mg', label: 'Vitamina E', unit: 'mg' },
            { key: 'vitamina_k_ug', label: 'Vitamina K', unit: 'µg' },
            { key: 'vitamina_b6_mg', label: 'Vitamina B6', unit: 'mg' },
            { key: 'vitamina_b12_ug', label: 'Vitamina B12', unit: 'µg' },
            { key: 'tiamina_mg', label: 'Tiamina (B1)', unit: 'mg' },
            { key: 'riboflavina_mg', label: 'Riboflavina (B2)', unit: 'mg' },
            { key: 'niacina_mg', label: 'Niacina (B3)', unit: 'mg' },
            { key: 'folato_ug', label: 'Folato (B9)', unit: 'µg' },
        ],
    },
    {
        titulo: 'Minerales',
        campos: [
            { key: 'calcio_mg', label: 'Calcio', unit: 'mg' },
            { key: 'hierro_mg', label: 'Hierro', unit: 'mg' },
            { key: 'magnesio_mg', label: 'Magnesio', unit: 'mg' },
            { key: 'fosforo_mg', label: 'Fósforo', unit: 'mg' },
            { key: 'potasio_mg', label: 'Potasio', unit: 'mg' },
            { key: 'sodio_mg', label: 'Sodio', unit: 'mg' },
            { key: 'zinc_mg', label: 'Zinc', unit: 'mg' },
            { key: 'cobre_mg', label: 'Cobre', unit: 'mg' },
            { key: 'selenio_ug', label: 'Selenio', unit: 'µg' },
        ],
    },
    {
        titulo: 'Perfil lipídico',
        campos: [
            { key: 'saturados_g', label: 'Saturadas', unit: 'g' },
            { key: 'monoinsaturados_g', label: 'Monoinsaturadas', unit: 'g' },
            { key: 'poliinsaturados_g', label: 'Omega-3/6 (poliin.)', unit: 'g' },
            { key: 'colesterol_mg', label: 'Colesterol', unit: 'mg' },
        ],
    },
]

function tieneMicros(a: Alimento): boolean {
    return MICRO_GRUPOS.some(grupo =>
        grupo.campos.some(c => (a[c.key] as number ?? 0) > 0)
    )
}

interface OFFResultado {
    nombre: string
    calorias: number
    proteinas: number
    carbohidratos: number
    grasas: number
    fibra: number
    azucares: number
    categoria: string
    imagen: string | null
    _fuente: 'off'
    codigo_barras?: string | null
}

export default function AlimentosPage() {
    const { addToast } = useToast()
    const [alimentos, setAlimentos] = useState<Alimento[]>([])
    const [loading, setLoading] = useState(true)
    const [seedLoading, setSeedLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [categoriaFiltro, setCategoriaFiltro] = useState('')
    const [soloCustom, setSoloCustom] = useState(false)
    const [soloIA, setSoloIA] = useState(false)
    const debouncedSearch = useDebounce(search, 300)
    const [showForm, setShowForm] = useState(false)
    const [editando, setEditando] = useState<Alimento | null>(null)
    const [form, setForm] = useState(FORM_VACIO)
    const [guardando, setGuardando] = useState(false)

    // Micro accordion state
    const [microAbierto, setMicroAbierto] = useState<Set<string>>(new Set())

    function toggleMicro(id: string) {
        setMicroAbierto(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    // OFF state
    const [resultadosOFF, setResultadosOFF] = useState<OFFResultado[]>([])
    const [offLoading, setOffLoading] = useState(false)
    const [importandoOFF, setImportandoOFF] = useState<string | null>(null)

    async function poblarBaseDatos() {
        setSeedLoading(true)
        try {
            const res = await fetch('/api/seed-alimentos')
            const data = await res.json()
            if (!res.ok) {
                addToast({ type: 'error', title: 'Error', message: data.error ?? 'No se pudo poblar' })
            } else if (data.count > 0) {
                addToast({ type: 'success', title: 'Base de datos poblada', message: `${data.count} alimentos base insertados` })
                load()
            } else {
                addToast({ type: 'info', title: 'Sin cambios', message: data.message })
                load()
            }
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Error de red al poblar base de datos' })
        }
        setSeedLoading(false)
    }

    const load = useCallback(async () => {
        setLoading(true)
        const params = new URLSearchParams()
        if (debouncedSearch) params.set('q', debouncedSearch)
        if (categoriaFiltro) params.set('categoria', categoriaFiltro)
        if (soloCustom) params.set('custom', 'true')

        const res = await fetch(`/api/alimentos?${params.toString()}`)
        const data = await res.json()
        if (Array.isArray(data)) setAlimentos(data)
        setLoading(false)
    }, [debouncedSearch, categoriaFiltro, soloCustom])

    // Cargar OFF en paralelo cuando hay búsqueda
    useEffect(() => {
        if (!debouncedSearch || debouncedSearch.length < 2) {
            setResultadosOFF([])
            return
        }
        let cancel = false
        setOffLoading(true)
        fetch(`/api/off?q=${encodeURIComponent(debouncedSearch)}`)
            .then(r => r.json())
            .then((data: OFFResultado[]) => {
                if (!cancel) setResultadosOFF(data)
            })
            .catch(() => { if (!cancel) setResultadosOFF([]) })
            .finally(() => { if (!cancel) setOffLoading(false) })
        return () => { cancel = true }
    }, [debouncedSearch])

    useEffect(() => { load() }, [load])

    function abrirNuevo(prefill?: Partial<typeof FORM_VACIO>) {
        setEditando(null)
        setForm(prefill ? { ...FORM_VACIO, ...prefill } : FORM_VACIO)
        setShowForm(true)
    }

    function abrirEditar(a: Alimento) {
        setEditando(a)
        setForm({
            nombre: a.nombre,
            categoria: a.categoria,
            calorias: String(a.calorias),
            proteinas: String(a.proteinas),
            carbohidratos: String(a.carbohidratos),
            grasas: String(a.grasas),
            fibra: String(a.fibra ?? 0),
        })
        setShowForm(true)
    }

    async function handleGuardar() {
        if (!form.nombre.trim() || form.calorias === '') {
            addToast({ type: 'error', title: 'Validación', message: 'Nombre y calorías son obligatorios' })
            return
        }

        setGuardando(true)
        const body = {
            nombre: form.nombre.trim(),
            categoria: form.categoria,
            calorias: parseFloat(form.calorias) || 0,
            proteinas: parseFloat(form.proteinas) || 0,
            carbohidratos: parseFloat(form.carbohidratos) || 0,
            grasas: parseFloat(form.grasas) || 0,
            fibra: parseFloat(form.fibra) || 0,
        }

        let res: Response
        if (editando) {
            res = await fetch(`/api/alimentos/${editando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
        } else {
            res = await fetch('/api/alimentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
        }

        const result = await res.json()
        if (!res.ok) {
            addToast({ type: 'error', title: 'Error', message: result.error ?? 'No se pudo guardar' })
        } else {
            addToast({
                type: 'success',
                title: editando ? 'Alimento actualizado' : 'Alimento creado',
                message: result.duplicado ? 'Ya existía en tu base de datos' : form.nombre.trim(),
            })
            setShowForm(false)
            load()
        }
        setGuardando(false)
    }

    async function handleEliminar(a: Alimento) {
        if (!confirm(`¿Eliminar "${a.nombre}" permanentemente?`)) return
        const res = await fetch(`/api/alimentos/${a.id}`, { method: 'DELETE' })
        if (res.ok) {
            addToast({ type: 'success', title: 'Eliminado', message: a.nombre })
            load()
        } else {
            const err = await res.json()
            addToast({ type: 'error', title: 'Error', message: err.error })
        }
    }

    async function importarOFF(item: OFFResultado) {
        setImportandoOFF(item.nombre)
        try {
            const res = await fetch('/api/alimentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: item.nombre,
                    categoria: item.categoria,
                    calorias: item.calorias,
                    proteinas: item.proteinas,
                    carbohidratos: item.carbohidratos,
                    grasas: item.grasas,
                    fibra: item.fibra,
                    fuente: 'openfoodfacts',
                    codigo_externo: item.codigo_barras ?? undefined,
                }),
            })
            const result = await res.json()
            if (!res.ok) {
                addToast({ type: 'error', title: 'Error', message: result.error ?? 'No se pudo importar' })
            } else {
                addToast({
                    type: 'success',
                    title: 'Importado',
                    message: result.duplicado ? `"${item.nombre}" ya existía` : `"${item.nombre}" importado correctamente`,
                })
                // Quitar de resultados OFF y recargar lista local
                setResultadosOFF(prev => prev.filter(r => r.nombre !== item.nombre))
                load()
            }
        } catch {
            addToast({ type: 'error', title: 'Error', message: 'Error de red al importar' })
        }
        setImportandoOFF(null)
    }

    const filtradas = alimentos.filter(a =>
        (!categoriaFiltro || a.categoria === categoriaFiltro) &&
        (!soloCustom || a.custom) &&
        (!soloIA || a.fuente === 'ia')
    )

    // Agrupar por categoría
    const grupos = filtradas.reduce<Record<string, Alimento[]>>((acc, a) => {
        if (!acc[a.categoria]) acc[a.categoria] = []
        acc[a.categoria].push(a)
        return acc
    }, {})

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Alimentos</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Base de datos de {alimentos.length} alimentos
                        {resultadosOFF.length > 0 && ` + ${resultadosOFF.length} de Open Food Facts`}
                    </p>
                </div>
                <button onClick={() => abrirNuevo()} className="btn-primary btn-sm">
                    <Plus size={16} className="mr-1" /> Nuevo alimento
                </button>
            </header>

            {/* Filtros */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        className="input search-input"
                        placeholder="Buscar alimentos (incluye Open Food Facts)..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select className="input w-auto" value={categoriaFiltro} onChange={e => setCategoriaFiltro(e.target.value)}>
                    <option value="">Todas las categorías</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <input
                        type="checkbox"
                        checked={soloCustom}
                        onChange={e => setSoloCustom(e.target.checked)}
                        className="rounded" style={{ accentColor: 'var(--primary)' }}
                    />
                    Solo creados por mí
                </label>
                <label className="flex items-center gap-2 text-sm" style={{ color: '#7C3AED' }}>
                    <input
                        type="checkbox"
                        checked={soloIA}
                        onChange={e => setSoloIA(e.target.checked)}
                        className="rounded" style={{ accentColor: '#7C3AED' }}
                    />
                    Solo IA
                </label>
            </div>

            {/* Loading — skeleton grid que imita la estructura real */}
            {
                loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Array.from({ length: 9 }).map((_, i) => (
                            <SkeletonCard key={i} lines={3} />
                        ))}
                    </div>
                ) : filtradas.length === 0 && resultadosOFF.length === 0 ? (
                    <div className="text-center py-16">
                        <Apple size={48} className="mx-auto text-gray-200 mb-3" />
                        <p className="text-gray-400">No hay alimentos que coincidan</p>
                        <button onClick={() => abrirNuevo()} className="btn-primary btn-sm mt-4">
                            <Plus size={16} className="mr-1" /> Crear primer alimento
                        </button>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Resultados locales agrupados por categoría — orden lógico */}
                        {Object.entries(grupos)
                            .sort(([a], [b]) => {
                                const ia = CATEGORY_ORDER.indexOf(a)
                                const ib = CATEGORY_ORDER.indexOf(b)
                                // Categorías conocidas primero; desconocidas al final por orden alfabético
                                if (ia === -1 && ib === -1) return a.localeCompare(b)
                                if (ia === -1) return 1
                                if (ib === -1) return -1
                                return ia - ib
                            })
                            .map(([categoria, items]) => {
                            const Icon = CATEGORIA_ICON[categoria] ?? CircleDot
                            const color = CATEGORIA_COLOR[categoria] ?? '#6B7280'
                            return (
                                <div key={categoria}>
                                    <h2 className="flex items-center gap-2 text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                                        <Icon size={16} style={{ color }} />
                                        {categoria}
                                        <span className="font-normal" style={{ color: 'var(--text-muted)' }}>({items.length})</span>
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {items.map(a => (
                                            <div
                                                key={a.id}
                                                className="card p-3 relative group"
                                            >
                                                {/* Badges superior */}
                                                <div className="absolute top-2 right-2 flex gap-1">
                                                    {a.custom && (
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border" style={{ color: 'var(--primary)', backgroundColor: 'var(--primary-bg)', borderColor: 'var(--primary)' }}>
                                                            custom
                                                        </span>
                                                    )}
                                                    {a.fuente && FUENTE_CONFIG[a.fuente] && (
                                                        <span
                                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1"
                                                            style={{
                                                                color: FUENTE_CONFIG[a.fuente].color,
                                                                background: FUENTE_CONFIG[a.fuente].bg,
                                                                borderColor: FUENTE_CONFIG[a.fuente].border,
                                                            }}
                                                        >
                                                            {FUENTE_CONFIG[a.fuente].label}
                                                        </span>
                                                    )}
                                                </div>

                                                <p className="font-medium text-sm mb-2 pr-20" style={{ color: 'var(--text)' }}>{a.nombre}</p>

                                                {/* Macros */}
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                                    {NUTRI_LABELS.map(({ key, label, unit, color: c }) => {
                                                        const val = a[key] as number | undefined
                                                        if (val === undefined || val === null) return null
                                                        return (
                                                            <span key={key} className="flex items-center gap-1" title={label}>
                                                                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: c }} />
                                                                <span style={{ color: c }} className="font-medium">{label}</span>
                                                                <span>{val}{unit === 'kcal' ? '' : 'g'}</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>{unit}</span>
                                                            </span>
                                                        )
                                                    })}
                                                </div>

                                                {/* Perfil lipídico — visible directamente si hay datos */}
                                                {LIPID_HIGHLIGHTS.some(h => (a[h.key] as number ?? 0) > 0) && (
                                                    <div className="mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                                                        <p className="text-[10px] uppercase tracking-wider mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Perfil lipídico</p>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                            {LIPID_HIGHLIGHTS.map(h => {
                                                                const val = a[h.key] as number | undefined
                                                                if (!val || val === 0) return null
                                                                const unit = h.key === 'colesterol_mg' ? 'mg' : 'g'
                                                                return (
                                                                    <span key={String(h.key)} className="flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: h.color }} />
                                                                        <span style={{ color: h.color }} className="font-medium">{h.label}</span>
                                                                        <span style={{ color: 'var(--text-secondary)' }}>{val}{unit}</span>
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Vitaminas y minerales clave — visible directamente si hay datos */}
                                                {MICRO_HIGHLIGHTS.some(h => (a[h.key] as number ?? 0) > 0) && (
                                                    <div className="mt-1.5 text-xs">
                                                        <p className="text-[10px] uppercase tracking-wider mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Vitaminas y minerales</p>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                            {MICRO_HIGHLIGHTS.map(h => {
                                                                const val = a[h.key] as number | undefined
                                                                if (!val || val === 0) return null
                                                                return (
                                                                    <span key={String(h.key)} className="flex items-center gap-1">
                                                                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: h.color }} />
                                                                        <span style={{ color: h.color }} className="font-medium">{h.label}</span>
                                                                        <span style={{ color: 'var(--text-secondary)' }}>{val}{h.unit}</span>
                                                                    </span>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Botón acordeón — solo para el perfil completo (resto de vitaminas) */}
                                                {tieneMicros(a) && (
                                                    <button
                                                        onClick={() => toggleMicro(a.id)}
                                                        className="mt-2 text-xs flex items-center gap-1 transition-colors"
                                                        style={{ color: 'var(--text-muted)' }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                                                    >
                                                        {microAbierto.has(a.id) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                        Perfil completo
                                                    </button>
                                                )}

                                                {/* Acordeón micronutrientes */}
                                                {microAbierto.has(a.id) && tieneMicros(a) && (
                                                    <div className="mt-2 pt-2 space-y-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
                                                        {MICRO_GRUPOS.map(grupo => {
                                                            const tieneAlguno = grupo.campos.some(c => (a[c.key] as number ?? 0) > 0)
                                                            if (!tieneAlguno) return null
                                                            return (
                                                                <div key={grupo.titulo}>
                                                                    <p className="font-medium mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                                                                        {grupo.titulo}
                                                                    </p>
                                                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                                                        {grupo.campos.map(c => {
                                                                            const val = a[c.key] as number | undefined
                                                                            if (!val || val === 0) return null
                                                                            return (
                                                                                <span key={c.key} style={{ color: 'var(--text-muted)' }}>
                                                                                    {c.label}: <strong style={{ color: 'var(--text-secondary)' }} className="font-medium">{val}</strong> {c.unit}
                                                                                </span>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {/* Acciones hover */}
                                                <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                    {a.custom && (
                                                        <>
                                                            <button
                                                                onClick={() => abrirEditar(a)}
                                                                className="p-1 rounded-md border transition-colors" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                                                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'var(--primary-light)' }}
                                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                                                                title="Editar"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleEliminar(a)}
                                                                className="p-1 rounded-md border transition-colors" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                                                onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = '#FECACA' }}
                                                                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </>
                                                    )}
                                                    {!a.custom && (
                                                        <span className="text-[10px] rounded-md px-1.5 py-0.5 border" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
                                                            Sistema
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}

                        {/* Open Food Facts results */}
                        {debouncedSearch.length >= 2 && (
                            <div>
                                <h2 className="flex items-center gap-2 text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                                    <Database size={16} style={{ color: '#F97316' }} />
                                    Open Food Facts
                                    {offLoading ? (
                                        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                                    ) : (
                                        <span style={{ color: 'var(--text-muted)' }} className="font-normal">({resultadosOFF.length})</span>
                                    )}
                                </h2>
                                {offLoading ? (
                                    <div className="flex justify-center py-8">
                                        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#F97316', borderTopColor: 'transparent' }} />
                                    </div>
                                ) : resultadosOFF.length === 0 ? (
                                    <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>Sin resultados en Open Food Facts</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {resultadosOFF.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="card p-3 relative group"
                                            >
                                                {/* Badge OFF */}
                                                <span className="absolute top-2 right-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full border flex items-center gap-1" style={{ color: '#C2410C', backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}>
                                                    <Database size={10} />
                                                    OFF
                                                </span>

                                                <div className="flex items-start gap-3">
                                                    {/* Imagen si existe */}
                                                    {item.imagen && (
                                                        <img
                                                            src={item.imagen}
                                                            alt={item.nombre}
                                                            className="w-10 h-10 rounded-md object-cover flex-shrink-0" style={{ backgroundColor: 'var(--bg)' }}
                                                            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm mb-2 pr-12 leading-tight" style={{ color: 'var(--text)' }}>
                                                            {item.nombre}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Micros */}
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                                                    {NUTRI_LABELS.map(({ key, label, unit, color: c }) => {
                                                        const val = item[key] as number | undefined
                                                        if (val === undefined || val === null) return null
                                                        return (
                                                            <span key={key} className="flex items-center gap-1" title={label}>
                                                                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: c }} />
                                                                <span style={{ color: c }} className="font-medium">{label}</span>
                                                                <span>{val}{unit === 'kcal' ? '' : 'g'}</span>
                                                                <span style={{ color: 'var(--text-muted)' }}>{unit}</span>
                                                            </span>
                                                        )
                                                    })}
                                                </div>

                                                {/* Botón importar */}
                                                <div className="mt-2">
                                                    <button
                                                        onClick={() => importarOFF(item)}
                                                        disabled={importandoOFF === item.nombre}
                                                        className="text-xs font-medium rounded-md px-2 py-1 transition-colors flex items-center gap-1 border"
                                                        style={{ color: '#C2410C', backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
                                                        onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.backgroundColor = '#FFEDD5'; e.currentTarget.style.borderColor = '#FDBA74' } }}
                                                        onMouseLeave={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.backgroundColor = '#FFF7ED'; e.currentTarget.style.borderColor = '#FED7AA' } }}
                                                    >
                                                        {importandoOFF === item.nombre ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <Download size={12} />
                                                        )}
                                                        {importandoOFF === item.nombre ? 'Importando...' : 'Importar'}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            }

            {/* Modal formulario */}
            <Modal
                abierto={showForm}
                onCerrar={() => setShowForm(false)}
                titulo={editando ? 'Editar alimento' : 'Nuevo alimento'}
                descripcion={editando ? `Editando "${editando.nombre}"` : 'Añade un alimento personalizado a tu base de datos'}
                accion={{
                    label: editando ? 'Guardar cambios' : 'Crear alimento',
                    onClick: handleGuardar,
                    loading: guardando,
                    disabled: guardando,
                }}
                accionSecundaria={{ label: 'Cancelar', onClick: () => setShowForm(false) }}
            >
                <div className="flex flex-col gap-4">
                    <div>
                        <label className="block mb-1.5 text-sm font-medium text-gray-700">Nombre *</label>
                        <input
                            className="input"
                            placeholder="Ej: Pechuga de pavo"
                            value={form.nombre}
                            onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                        />
                    </div>
                    <div>
                        <label className="block mb-1.5 text-sm font-medium text-gray-700">Categoría</label>
                        <select
                            className="input"
                            value={form.categoria}
                            onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}
                        >
                            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {NUTRI_LABELS.map(({ key, label, unit, color }) => (
                            <div key={key}>
                                <label className="block mb-1 text-xs font-medium text-gray-600" style={{ color }}>
                                    {label} ({unit})
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className="input"
                                    placeholder="0"
                                    value={form[key]}
                                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div >
    )
}

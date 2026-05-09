'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ShoppingCart, Plus, X, ChevronDown, ChevronUp,
    Copy, Check, TrendingDown, Store, Euro
} from 'lucide-react'

/* ── Tipos ─────────────────────────────────────────────────── */

interface Receta {
    id: string
    nombre: string
    porciones: number
    kcal: number
}

interface Cliente {
    id: string
    nombre: string
    apellidos: string
    plan_activo?: { id: string; nombre: string }
}

interface Supermercado {
    id: string
    nombre: string
    color: string
    slug: string
}

interface LineaCompra {
    alimento_id: string
    alimento_nombre: string
    categoria: string
    cantidad_gramos: number
    recetas_origen: string[]
    precio_por_kg: number
    coste_euros: number
    super_id: string | null
    super_nombre: string | null
    super_color: string | null
    url_producto: string | null
}

interface ResumenSuper {
    id: string
    nombre: string
    color: string
    slug: string
    lineas: LineaCompra[]
    coste_total: number
}

/* ── Helpers ───────────────────────────────────────────────── */

const CAT_EMOJI: Record<string, string> = {
    'Verduras': '🥦', 'Hortalizas': '🥬', 'Frutas': '🍎', 'Carnes': '🥩',
    'Pescados': '🐟', 'Mariscos': '🦐', 'Huevos': '🥚', 'Lácteos': '🥛',
    'Lacteos': '🥛', 'Legumbres': '🫘', 'Cereales': '🌾', 'Tubérculos': '🥔',
    'Frutos secos': '🥜', 'Aceites': '🫒', 'Especias': '🌶️', 'Condimentos': '🧂',
    'Salsas y condimentos': '🥫', 'Bebidas': '🧃', 'Congelados': '❄️',
    'Conservas': '🥫', 'Pan': '🍞', 'Arroces y pastas': '🍝', 'Otros': '📦',
}

function emoji(cat: string) {
    return CAT_EMOJI[cat] || CAT_EMOJI[cat?.split(' ')[0]] || '🛒'
}

function fmt(g: number) {
    return g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${Math.round(g)} g`
}

/* ── Componente principal ──────────────────────────────────── */

export default function ListaCompraPage() {
    const [recetas, setRecetas] = useState<Receta[]>([])
    const [clientes, setClientes] = useState<Cliente[]>([])
    const [supermercados, setSupermercados] = useState<Supermercado[]>([])

    const [selRecetas, setSelRecetas] = useState<{ receta: Receta; porciones: number }[]>([])
    const [selCliente, setSelCliente] = useState<string>('')
    const [periodo, setPeriodo] = useState<'diario' | 'semanal' | 'mensual'>('semanal')
    const [supSel, setSupSel] = useState<string>('')  // '' = más barato automático

    const [lista, setLista] = useState<LineaCompra[]>([])
    const [generando, setGenerando] = useState(false)
    const [error, setError] = useState('')

    const [copiado, setCopiado] = useState(false)
    const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

    /* Carga inicial */
    useEffect(() => {
        Promise.all([
            fetch('/api/recetas').then(r => r.json()),
            fetch('/api/clientes').then(r => r.json()),
            fetch('/api/precios/supermercados').then(r => r.json()),
        ]).then(([recetasData, clientesData, supersData]) => {
            setRecetas(recetasData.recetas || recetasData || [])
            setClientes(clientesData.clientes || clientesData || [])
            setSupermercados(supersData.supermercados || supersData || [])
        }).catch(() => { })
    }, [])

    /* Añadir receta */
    function agregarReceta(id: string) {
        const r = recetas.find(r => r.id === id)
        if (!r || selRecetas.some(s => s.receta.id === id)) return
        setSelRecetas(prev => [...prev, { receta: r, porciones: r.porciones || 1 }])
    }

    function quitarReceta(id: string) {
        setSelRecetas(prev => prev.filter(s => s.receta.id !== id))
    }

    function cambiarPorciones(id: string, porciones: number) {
        setSelRecetas(prev => prev.map(s => s.receta.id === id ? { ...s, porciones } : s))
    }

    /* Generar lista */
    async function generarLista() {
        if (selRecetas.length === 0 && !selCliente) {
            setError('Selecciona al menos una receta o un cliente')
            return
        }
        setGenerando(true)
        setError('')
        try {
            const params = new URLSearchParams()
            if (selRecetas.length > 0) {
                params.set('recetas', JSON.stringify(selRecetas.map(s => ({ id: s.receta.id, porciones: s.porciones }))))
            }
            if (selCliente) params.set('cliente_id', selCliente)
            if (supSel) params.set('supermercado_id', supSel)
            params.set('periodo', periodo)

            const res = await fetch(`/api/compra?${params}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al generar lista')
            setLista(data.lista || [])
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error')
        } finally {
            setGenerando(false)
        }
    }

    /* Agrupar por supermercado */
    const porSuper = useMemo<ResumenSuper[]>(() => {
        const mapa = new Map<string, ResumenSuper>()
        const sinPrecio: LineaCompra[] = []

        for (const l of lista) {
            if (!l.super_id) {
                sinPrecio.push(l)
                continue
            }
            if (!mapa.has(l.super_id)) {
                mapa.set(l.super_id, {
                    id: l.super_id,
                    nombre: l.super_nombre || '',
                    color: l.super_color || '#888',
                    slug: '',
                    lineas: [],
                    coste_total: 0,
                })
            }
            const s = mapa.get(l.super_id)!
            s.lineas.push(l)
            s.coste_total += l.coste_euros
        }

        const result = Array.from(mapa.values())
            .sort((a, b) => b.coste_total - a.coste_total)

        if (sinPrecio.length > 0) {
            result.push({
                id: 'sin-precio',
                nombre: 'Sin precio registrado',
                color: '#9ca3af',
                slug: '',
                lineas: sinPrecio,
                coste_total: 0,
            })
        }

        return result
    }, [lista])

    const costeTotal = useMemo(() => lista.reduce((s, l) => s + l.coste_euros, 0), [lista])

    /* Agrupar por categoría dentro de un super */
    function porCategoria(lineas: LineaCompra[]) {
        const mapa = new Map<string, LineaCompra[]>()
        for (const l of lineas) {
            const cat = l.categoria || 'Otros'
            if (!mapa.has(cat)) mapa.set(cat, [])
            mapa.get(cat)!.push(l)
        }
        return Array.from(mapa.entries()).sort(([a], [b]) => a.localeCompare(b))
    }

    /* Copiar al portapapeles */
    function copiar() {
        const lineas: string[] = [`🛒 LISTA DE LA COMPRA — ${periodo.toUpperCase()}`, '']
        for (const s of porSuper) {
            if (s.lineas.length === 0) continue
            lineas.push(`\n📍 ${s.nombre} — ${s.coste_total.toFixed(2)} €`)
            for (const l of s.lineas) {
                const precio = l.coste_euros > 0 ? ` (${l.coste_euros.toFixed(2)} €)` : ''
                lineas.push(`  • ${l.alimento_nombre} — ${fmt(l.cantidad_gramos)}${precio}`)
            }
        }
        if (costeTotal > 0) lineas.push(`\n💰 TOTAL: ${costeTotal.toFixed(2)} €`)

        navigator.clipboard.writeText(lineas.join('\n')).then(() => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        })
    }

    function toggleExpand(id: string) {
        setExpandidos(prev => {
            const s = new Set(prev)
            s.has(id) ? s.delete(id) : s.add(id)
            return s
        })
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">

            {/* Cabecera */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6" />
                        Lista de la compra
                    </h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
                        Genera la lista optimizada por supermercado con costes reales
                    </p>
                </div>
                {lista.length > 0 && (
                    <button onClick={copiar}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
                        style={{ background: 'var(--surface)', color: 'var(--text)' }}>
                        {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiado ? 'Copiado' : 'Copiar'}
                    </button>
                )}
            </div>

            {/* Panel de configuración */}
            <div className="p-4 rounded-xl border space-y-4" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>

                {/* Período */}
                <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>PERÍODO</label>
                    <div className="flex gap-2">
                        {(['diario', 'semanal', 'mensual'] as const).map(p => (
                            <button key={p}
                                onClick={() => setPeriodo(p)}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors"
                                style={{
                                    background: periodo === p ? 'var(--accent)' : 'var(--surface)',
                                    color: periodo === p ? '#fff' : 'var(--text)',
                                }}>
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Supermercado */}
                <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>SUPERMERCADO</label>
                    <select
                        value={supSel}
                        onChange={e => setSupSel(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                        <option value="">🏷️ Precio más barato (automático)</option>
                        {supermercados.map(s => (
                            <option key={s.id} value={s.id}>{s.nombre}</option>
                        ))}
                    </select>
                </div>

                {/* Selección de recetas */}
                <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>RECETAS</label>
                    <div className="flex gap-2 mb-3">
                        <select
                            onChange={e => { if (e.target.value) { agregarReceta(e.target.value); e.target.value = '' } }}
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                            <option value="">+ Añadir receta...</option>
                            {recetas
                                .filter(r => !selRecetas.some(s => s.receta.id === r.id))
                                .map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                        </select>
                    </div>
                    {selRecetas.length > 0 && (
                        <div className="space-y-2">
                            {selRecetas.map(({ receta, porciones }) => (
                                <div key={receta.id}
                                    className="flex items-center gap-3 p-2 rounded-lg"
                                    style={{ background: 'var(--surface)' }}>
                                    <span className="flex-1 text-sm truncate">{receta.nombre}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>porciones:</span>
                                        <input
                                            type="number" min={1} max={20} value={porciones}
                                            onChange={e => cambiarPorciones(receta.id, parseInt(e.target.value) || 1)}
                                            className="w-14 px-2 py-1 rounded border text-sm text-center"
                                            style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                                        />
                                    </div>
                                    <button onClick={() => quitarReceta(receta.id)} className="p-1 hover:opacity-70 transition-opacity">
                                        <X className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selección de cliente */}
                <div>
                    <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--muted-foreground)' }}>O DESDE PLAN DE CLIENTE</label>
                    <select
                        value={selCliente}
                        onChange={e => setSelCliente(e.target.value)}
                        className="w-full sm:w-auto px-3 py-2 rounded-lg border text-sm"
                        style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}>
                        <option value="">Sin cliente</option>
                        {clientes.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.nombre} {c.apellidos}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="text-sm p-3 rounded-lg" style={{ background: '#fef2f2', color: '#dc2626' }}>
                        ❌ {error}
                    </div>
                )}

                <button
                    onClick={generarLista}
                    disabled={generando || (selRecetas.length === 0 && !selCliente)}
                    className="w-full py-2.5 rounded-lg font-medium text-sm transition-opacity disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
                    {generando ? 'Generando...' : 'Generar lista de la compra'}
                </button>
            </div>

            {/* Resultado: lista por supermercado */}
            {lista.length > 0 && (
                <div className="space-y-4">
                    {/* Resumen de coste */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-xl border col-span-2 sm:col-span-1" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Total {periodo}</div>
                            <div className="text-xl font-bold">{costeTotal.toFixed(2)} €</div>
                        </div>
                        {periodo !== 'diario' && (
                            <div className="p-3 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Diario</div>
                                <div className="font-bold">{(costeTotal / (periodo === 'semanal' ? 7 : 30)).toFixed(2)} €</div>
                            </div>
                        )}
                        {periodo !== 'mensual' && (
                            <div className="p-3 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                                <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Mensual</div>
                                <div className="font-bold">{(costeTotal * (periodo === 'diario' ? 30 : 4.33)).toFixed(2)} €</div>
                            </div>
                        )}
                        <div className="p-3 rounded-xl border" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Productos</div>
                            <div className="font-bold">{lista.length}</div>
                        </div>
                    </div>

                    {/* Un card por supermercado */}
                    {porSuper.map(s => {
                        const expandido = expandidos.has(s.id)
                        const categorias = porCategoria(s.lineas)
                        return (
                            <div key={s.id} className="rounded-xl border overflow-hidden"
                                style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
                                <button
                                    onClick={() => toggleExpand(s.id)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-black/5 transition-colors"
                                    style={{ borderLeft: `4px solid ${s.color}` }}>
                                    <div className="flex items-center gap-3">
                                        <Store className="w-5 h-5" style={{ color: s.color }} />
                                        <div className="text-left">
                                            <div className="font-semibold">{s.nombre}</div>
                                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                                                {s.lineas.length} productos
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {s.coste_total > 0 && (
                                            <div className="text-right">
                                                <div className="font-bold">{s.coste_total.toFixed(2)} €</div>
                                            </div>
                                        )}
                                        {expandido ? <ChevronUp className="w-4 h-4 opacity-40" /> : <ChevronDown className="w-4 h-4 opacity-40" />}
                                    </div>
                                </button>

                                {expandido && (
                                    <div className="divide-y" style={{ borderTop: '1px solid var(--border)' }}>
                                        {categorias.map(([cat, lineas]) => (
                                            <div key={cat} className="px-4 py-3">
                                                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
                                                    {emoji(cat)} {cat}
                                                </div>
                                                <div className="space-y-1.5">
                                                    {lineas.map(l => (
                                                        <div key={l.alimento_id}
                                                            className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span>{l.alimento_nombre}</span>
                                                                {l.recetas_origen.length > 0 && (
                                                                    <span className="text-xs px-1.5 py-0.5 rounded hidden sm:inline"
                                                                        style={{ background: 'var(--surface)', color: 'var(--muted-foreground)' }}>
                                                                        {l.recetas_origen.join(', ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0 ml-2">
                                                                <span style={{ color: 'var(--muted-foreground)' }}>{fmt(l.cantidad_gramos)}</span>
                                                                {l.coste_euros > 0 && (
                                                                    <span className="font-medium">{l.coste_euros.toFixed(2)} €</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
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

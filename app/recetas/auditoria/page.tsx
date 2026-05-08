'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Check, ChevronUp, ChevronDown } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

// Ingredientes que son normales en pequeñas cantidades
const ESPECIAS = new Set([
  'sal', 'pimienta', 'comino', 'canela', 'cúrcuma', 'pimentón', 'orégano', 'tomillo',
  'romero', 'ajo en polvo', 'cebolla en polvo', 'nuez moscada', 'cardamomo', 'curry',
  'paprika', 'cayena', 'jengibre', 'clavo', 'anís', 'vainilla', 'bicarbonato',
  'levadura', 'stevia', 'eritritol', 'edulcorante', 'azafrán', 'perejil', 'cilantro',
  'menta', 'albahaca', 'eneldo', 'estragón', 'laurel', 'chile', 'mostaza en polvo',
  'cacao en polvo', 'colorante', 'sal marina', 'sal rosa', 'pimienta negra',
])

function esEspecia(nombre: string) {
  const n = nombre.toLowerCase()
  return Array.from(ESPECIAS).some(e => n.includes(e))
}

function esSospechoso(nombre: string, cantidad: number) {
  if (cantidad < 0) return false
  if (cantidad === 0) return true // al gusto / sin pesar
  if (esEspecia(nombre)) return cantidad > 30
  return cantidad < 5
}

// ─── Tipado fuerte para la respuesta de Supabase ───
// NOTA: Supabase join devuelve arrays (no objetos), por eso el casteo con [0]
interface IngredienteRow {
  id: string
  cantidad_gramos: number | null
  nombre_libre: string | null
  alimento: { nombre: string }[] | null
  receta: { id: string; nombre: string; coach_id: string }[] | null
}

interface Fila {
  ing_id: string
  receta_id: string
  receta_nombre: string
  nombre: string
  cantidad_gramos: number
  sospechoso: boolean
}

type Orden = 'cantidad_asc' | 'cantidad_desc' | 'receta'

export default function AuditoriaIngredientesPage() {
  const { addToast } = useToast()
  const [filas, setFilas] = useState<Fila[]>([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState<Orden>('cantidad_asc')
  const [soloSospechosos, setSoloSospechosos] = useState(true)
  const [editando, setEditando] = useState<Record<string, number>>({})
  const [guardando, setGuardando] = useState<Set<string>>(new Set())
  const [guardados, setGuardados] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('receta_ingredientes')
        .select('id, cantidad_gramos, nombre_libre, alimento:alimentos(nombre), receta:recetas!receta_id(id, nombre, coach_id)')
        .order('cantidad_gramos', { ascending: true })

      if (!data) { setLoading(false); return }

      const filtradas: Fila[] = (data as unknown as IngredienteRow[])
        .filter(row => row.receta && row.receta[0] && row.receta[0].coach_id === user.id)
        .map(row => {
          const nombre = row.nombre_libre || (row.alimento?.[0]?.nombre) || '(sin nombre)'
          const cantidad = row.cantidad_gramos ?? 0
          return {
            ing_id: row.id,
            receta_id: row.receta![0]!.id,
            receta_nombre: row.receta![0]!.nombre,
            nombre,
            cantidad_gramos: cantidad,
            sospechoso: esSospechoso(nombre, cantidad),
          }
        })

      setFilas(filtradas)
      setLoading(false)
    }
    load()
  }, [])

  async function guardarCantidad(ing_id: string) {
    const nueva = editando[ing_id]
    if (nueva === undefined) return
    setGuardando(prev => new Set(prev).add(ing_id))

    const { error } = await supabase.from('receta_ingredientes').update({ cantidad_gramos: nueva }).eq('id', ing_id)

    if (error) {
      addToast({ type: 'error', title: 'Error', message: 'No se pudo guardar: ' + error.message })
      setGuardando(prev => { const n = new Set(prev); n.delete(ing_id); return n })
      return
    }

    setFilas(prev => prev.map(f => f.ing_id === ing_id
      ? { ...f, cantidad_gramos: nueva, sospechoso: esSospechoso(f.nombre, nueva) }
      : f
    ))
    setEditando(prev => { const n = { ...prev }; delete n[ing_id]; return n })
    setGuardando(prev => { const n = new Set(prev); n.delete(ing_id); return n })
    setGuardados(prev => new Set(prev).add(ing_id))
    setTimeout(() => setGuardados(prev => { const n = new Set(prev); n.delete(ing_id); return n }), 2000)
  }

  const ordenadas = [...filas].sort((a, b) => {
    if (orden === 'cantidad_asc') return a.cantidad_gramos - b.cantidad_gramos
    if (orden === 'cantidad_desc') return b.cantidad_gramos - a.cantidad_gramos
    return a.receta_nombre.localeCompare(b.receta_nombre)
  })

  const visibles = soloSospechosos ? ordenadas.filter(f => f.sospechoso) : ordenadas
  const totalSospechosos = filas.filter(f => f.sospechoso).length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/recetas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Auditoría de ingredientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {totalSospechosos > 0
              ? `${totalSospechosos} ingredientes con cantidades sospechosas`
              : 'Todos los ingredientes parecen correctos'}
          </p>
        </div>
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button
          onClick={() => setSoloSospechosos(p => !p)}
          className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
          style={soloSospechosos
            ? { background: '#FEF3C7', color: '#92400E', borderColor: '#FCD34D' }
            : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
        >
          <AlertTriangle size={11} className="inline mr-1" />
          Solo sospechosos ({totalSospechosos})
        </button>
        <div className="flex gap-1.5 ml-auto">
          {([
            { v: 'cantidad_asc', label: 'Menor primero' },
            { v: 'cantidad_desc', label: 'Mayor primero' },
            { v: 'receta', label: 'Por receta' },
          ] as { v: Orden; label: string }[]).map(o => (
            <button key={o.v} onClick={() => setOrden(o.v)}
              className="text-xs px-3 py-1.5 rounded-full border font-medium"
              style={orden === o.v
                ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 skeleton rounded-xl animate-pulse" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <div className="card text-center py-12">
          <Check size={36} className="mx-auto mb-3" style={{ color: 'var(--primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>
            {soloSospechosos ? 'No hay ingredientes sospechosos' : 'No hay ingredientes en la base de datos'}
          </p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Ingrediente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Receta</th>
                <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Cantidad (g)
                  {orden === 'cantidad_asc' && <ChevronUp size={12} className="inline ml-1" />}
                  {orden === 'cantidad_desc' && <ChevronDown size={12} className="inline ml-1" />}
                </th>
                <th className="px-4 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila, idx) => {
                const valor = editando[fila.ing_id] ?? fila.cantidad_gramos
                const modificado = editando[fila.ing_id] !== undefined
                const ok = guardados.has(fila.ing_id)
                const busy = guardando.has(fila.ing_id)

                return (
                  <tr key={fila.ing_id}
                    style={{
                      borderBottom: idx < visibles.length - 1 ? '1px solid var(--border)' : 'none',
                      background: fila.sospechoso ? 'var(--accent-bg)' : 'var(--bg)',
                    }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {fila.sospechoso && <AlertTriangle size={12} style={{ color: '#8E8E93', flexShrink: 0 }} />}
                        <span style={{ color: 'var(--text)' }}>{fila.nombre}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/recetas/${fila.receta_id}/editar`}
                        className="text-xs underline decoration-dotted"
                        style={{ color: 'var(--text-secondary)' }}>
                        {fila.receta_nombre}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        value={valor}
                        onChange={e => setEditando(prev => ({ ...prev, [fila.ing_id]: parseFloat(e.target.value) || 0 }))}
                        className="w-20 text-right border rounded px-2 py-1 text-sm outline-none"
                        style={{
                          borderColor: modificado ? 'var(--primary)' : 'var(--border)',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {ok ? (
                        <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                          <Check size={14} className="inline" /> Guardado
                        </span>
                      ) : modificado ? (
                        <button
                          disabled={busy}
                          onClick={() => guardarCantidad(fila.ing_id)}
                          className="text-xs px-3 py-1 rounded-lg font-medium text-white disabled:opacity-50"
                          style={{ background: 'var(--primary)' }}>
                          {busy ? '…' : 'Guardar'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>
        Sospechoso = &lt;5g en ingredientes no especias · &gt;30g en especias/condimentos
      </p>
    </div>
  )
}

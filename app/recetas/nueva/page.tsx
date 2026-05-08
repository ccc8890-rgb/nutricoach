'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Link2, Plus, Search, X, Trash2, Upload } from 'lucide-react'
import { calcularMacrosPorCantidad, sumarMacros } from '@/lib/utils'
import type { Alimento } from '@/types'
import { CATEGORIAS, TIPOS_COCCION, INTOLERANCIAS } from '@/lib/recetas-constants'
import { useToast } from '@/components/ui/Toast'

interface Ingrediente {
  tempId: string
  alimento_id: string | null
  nombre_libre: string
  cantidad_gramos: number
  alimento?: Alimento
}

// ─── Componente del formulario completo (fallback "Crear en blanco") ───
function FormularioCompleto({ onVolver }: { onVolver: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    nombre: '', descripcion: '', instrucciones: '', consejos: '',
    categoria: '', tipo_coccion: '', dificultad: '',
    porciones: '1', tiempo_prep_min: '', tiempo_coccion_min: '', url_origen: '',
  })
  const [intolerancias, setIntolerancias] = useState<string[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [imagenFile, setImagenFile] = useState<File | null>(null)
  const [imagenPreview, setImagenPreview] = useState<string | null>(null)
  const [imagenUrlExterna, setImagenUrlExterna] = useState('')

  const [guardando, setGuardando] = useState(false)

  // Buscador de alimentos
  const [buscadorAbierto, setBuscadorAbierto] = useState<string | null>(null)
  const [queryAlimento, setQueryAlimento] = useState('')
  const [resultados, setResultados] = useState<Alimento[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => {
    if (!queryAlimento || queryAlimento.length < 2) { setResultados([]); return }
    setBuscando(true)
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('alimentos').select('*').ilike('nombre', `%${queryAlimento}%`).limit(10)
      setResultados(data ?? [])
      setBuscando(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [queryAlimento])

  function añadirIngredienteLibre() {
    setIngredientes(prev => [...prev, {
      tempId: crypto.randomUUID(), alimento_id: null, nombre_libre: '', cantidad_gramos: 100,
    }])
  }

  function vincularAlimento(tempId: string, alimento: Alimento) {
    setIngredientes(prev => prev.map(i => i.tempId === tempId
      ? { ...i, alimento_id: alimento.id, nombre_libre: alimento.nombre, alimento } : i))
    setBuscadorAbierto(null); setQueryAlimento(''); setResultados([])
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
    setImagenFile(file); setImagenUrlExterna(''); setImagenPreview(URL.createObjectURL(file))
  }

  const macrosTotales = (() => {
    const porcion = parseInt(form.porciones) || 1
    const ingConAlimento = ingredientes.filter(i => i.alimento)
    if (ingConAlimento.length === 0) return null
    const total = sumarMacros(ingConAlimento.map(i =>
      calcularMacrosPorCantidad(i.alimento!.calorias, i.alimento!.proteinas, i.alimento!.carbohidratos, i.alimento!.grasas, i.alimento!.fibra ?? 0, i.cantidad_gramos)
    ))
    return {
      kcal: total.calorias / porcion, proteinas: total.proteinas / porcion,
      carbohidratos: total.carbohidratos / porcion, grasas: total.grasas / porcion, fibra: total.fibra / porcion,
    }
  })()

  const { addToast } = useToast()

  async function guardar() {
    if (!form.nombre.trim()) return
    setGuardando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGuardando(false); return }

    let imagen_url = imagenUrlExterna || null
    if (imagenFile) {
      const ext = imagenFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('recetas').upload(path, imagenFile)
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('recetas').getPublicUrl(path)
        imagen_url = urlData.publicUrl
      }
    }

    const { data: receta, error } = await supabase.from('recetas').insert({
      coach_id: user.id, nombre: form.nombre.trim(),
      descripcion: form.descripcion || null, instrucciones: form.instrucciones || null,
      consejos: form.consejos || null, categoria: form.categoria || null,
      tipo_coccion: form.tipo_coccion || null, dificultad: form.dificultad || null,
      intolerancias: intolerancias.length ? intolerancias : null,
      porciones: parseInt(form.porciones) || 1,
      tiempo_prep_min: form.tiempo_prep_min ? parseInt(form.tiempo_prep_min) : null,
      tiempo_coccion_min: form.tiempo_coccion_min ? parseInt(form.tiempo_coccion_min) : null,
      imagen_url, fuente: form.url_origen ? 'url' : 'manual', url_origen: form.url_origen || null,
      kcal: macrosTotales?.kcal ?? null, proteinas: macrosTotales?.proteinas ?? null,
      carbohidratos: macrosTotales?.carbohidratos ?? null, grasas: macrosTotales?.grasas ?? null, fibra: macrosTotales?.fibra ?? null,
    }).select().single()
    if (error || !receta) {
      addToast({ type: 'error', title: 'Error', message: error?.message || 'No se pudo guardar la receta' })
      setGuardando(false); return
    }

    if (ingredientes.length) {
      const { error: ingError } = await supabase.from('receta_ingredientes').insert(
        ingredientes.map((ing, idx) => ({ receta_id: receta.id, alimento_id: ing.alimento_id || null, nombre_libre: ing.nombre_libre || null, cantidad_gramos: ing.cantidad_gramos, orden: idx }))
      )
      if (ingError) {
        addToast({ type: 'error', title: 'Error', message: 'Receta guardada pero fallaron los ingredientes: ' + ingError.message })
      }
    }
    window.location.href = `/recetas/${receta.id}`
  }

  return (
    <div className="flex flex-col gap-6">
      <button onClick={onVolver} className="text-sm flex items-center gap-1.5 self-start" style={{ color: 'var(--primary)' }}>
        <ArrowLeft size={14} /> Volver al import rápido
      </button>

      {/* Imagen */}
      <div className="card">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Imagen</p>
        {(imagenPreview || imagenUrlExterna) ? (
          <div className="relative">
            <img src={imagenPreview ?? imagenUrlExterna} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
            <button onClick={() => { setImagenFile(null); setImagenPreview(null); setImagenUrlExterna('') }}
              className="absolute top-2 right-2 p-1 rounded-full" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>
              <X size={14} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary-light)'; e.currentTarget.style.color = 'var(--primary)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
            <Upload size={20} /><span className="text-sm">Subir foto</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImagenChange} />
      </div>

      {/* Datos básicos */}
      <div className="card flex flex-col gap-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Información básica</p>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre *</label>
          <input className="input" placeholder="Ej: Tortitas de avena y plátano" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Descripción</label>
          <textarea className="input resize-none h-20" placeholder="Breve descripción de la receta…" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Categoría</label>
            <select className="input" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo cocción</label>
            <select className="input" value={form.tipo_coccion} onChange={e => setForm(p => ({ ...p, tipo_coccion: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {TIPOS_COCCION.map(c => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Dificultad</label>
            <select className="input" value={form.dificultad} onChange={e => setForm(p => ({ ...p, dificultad: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {['Fácil', 'Medio', 'Difícil'].map(d => <option key={d} value={d}>{d}</option>)}
            </select></div>
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Porciones</label>
            <input type="number" min={1} className="input" value={form.porciones} onChange={e => setForm(p => ({ ...p, porciones: e.target.value }))} /></div>
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Prep (min)</label>
            <input type="number" min={0} className="input" placeholder="15" value={form.tiempo_prep_min} onChange={e => setForm(p => ({ ...p, tiempo_prep_min: e.target.value }))} /></div>
          <div><label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Cocción (min)</label>
            <input type="number" min={0} className="input" placeholder="20" value={form.tiempo_coccion_min} onChange={e => setForm(p => ({ ...p, tiempo_coccion_min: e.target.value }))} /></div>
        </div>
        <div>
          <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>Intolerancias / apto para</label>
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
      </div>

      {/* Ingredientes */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Ingredientes</p>
          <button onClick={añadirIngredienteLibre} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
            <Plus size={13} /> Añadir
          </button>
        </div>
        {ingredientes.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>Sin ingredientes — añade uno para calcular macros</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ingredientes.map((ing) => (
              <div key={ing.tempId} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'var(--bg)' }}>
                <div className="flex-1 relative">
                  {buscadorAbierto === ing.tempId ? (
                    <div>
                      <div className="flex items-center rounded-lg overflow-hidden" style={{ border: '1px solid var(--primary)', background: 'var(--surface)' }}>
                        <Search size={13} className="ml-2" style={{ color: 'var(--text-muted)' }} />
                        <input autoFocus className="flex-1 px-2 py-1.5 text-sm outline-none" style={{ background: 'transparent' }}
                          placeholder="Buscar alimento…" value={queryAlimento} onChange={e => setQueryAlimento(e.target.value)} />
                        <button onClick={() => { setBuscadorAbierto(null); setQueryAlimento(''); setResultados([]) }} className="px-2" style={{ color: 'var(--text-muted)' }}>
                          <X size={13} />
                        </button>
                      </div>
                      {(resultados.length > 0 || buscando) && (
                        <div className="absolute z-10 left-0 right-0 mt-1 rounded-lg max-h-40 overflow-y-auto" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                          {buscando && <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Buscando…</p>}
                          {resultados.map(a => (
                            <button key={a.id} onClick={() => vincularAlimento(ing.tempId, a)}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-green-50 border-b last:border-0"
                              style={{ borderColor: 'var(--border)' }}>
                              <span className="font-medium" style={{ color: 'var(--text)' }}>{a.nombre}</span>
                              <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{a.calorias} kcal/100g</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => { setBuscadorAbierto(ing.tempId); setQueryAlimento(ing.nombre_libre) }}
                      className="w-full text-left text-sm truncate">
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
                <div className="flex items-center gap-1 flex-shrink-0">
                  <input type="number" min={0}
                    className="w-16 text-right border rounded px-2 py-1 text-sm outline-none"
                    style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }}
                    value={ing.cantidad_gramos}
                    onChange={e => setIngredientes(prev => prev.map(i => i.tempId === ing.tempId ? { ...i, cantidad_gramos: parseFloat(e.target.value) || 0 } : i))} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{ing.cantidad_gramos === 0 ? 'al gusto' : 'g'}</span>
                </div>
                {ing.alimento && ing.cantidad_gramos > 0 && (
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {Math.round(ing.alimento.calorias * ing.cantidad_gramos / 100)} kcal
                  </span>
                )}
                <button onClick={() => eliminarIngrediente(ing.tempId)} style={{ color: 'var(--text-muted)' }} className="hover:text-red-400 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
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

      {/* Instrucciones */}
      <div className="card flex flex-col gap-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Preparación</p>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Instrucciones</label>
          <textarea className="input resize-none h-36 font-mono text-sm"
            placeholder={"1. Mezcla la avena con el huevo…\n2. Calienta la sartén…"}
            value={form.instrucciones} onChange={e => setForm(p => ({ ...p, instrucciones: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Consejos (opcional)</label>
          <textarea className="input resize-none h-20" placeholder="Trucos, variaciones, sustituciones…"
            value={form.consejos} onChange={e => setForm(p => ({ ...p, consejos: e.target.value }))} />
        </div>
      </div>

      {/* Guardar */}
      <div className="flex gap-3 justify-end pb-8">
        <button onClick={onVolver} className="btn-secondary">Cancelar</button>
        <button onClick={guardar} disabled={!form.nombre.trim() || guardando} className="btn-primary">
          {guardando ? (
            <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" /> Guardando…</>
          ) : 'Guardar receta'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Página principal: modo rápido (import URL) o formulario completo
// ═══════════════════════════════════════════════════════
export default function NuevaRecetaPage() {
  const [url, setUrl] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const [modoFormulario, setModoFormulario] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const saltarBlurRef = useRef(false)

  async function crearReceta(urlValue: string) {
    const trimmed = urlValue.trim()
    if (!trimmed || creando) return
    setCreando(true)
    setError('')
    try {
      const res = await fetch('/api/scrape-receta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Error al procesar la URL')
        setCreando(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Error de conexión. Comprueba la URL e inténtalo de nuevo.')
      setCreando(false)
    }
  }

  // Auto-crear al perder el foco (si hay URL válida y no está ya creando)
  function handleBlur() {
    if (saltarBlurRef.current) {
      saltarBlurRef.current = false
      return
    }
    if (url.trim() && !creando) {
      crearReceta(url)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && url.trim() && !creando) {
      crearReceta(url)
    }
  }

  if (modoFormulario) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/recetas" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Nueva receta</h1>
        </div>
        <FormularioCompleto onVolver={() => setModoFormulario(false)} />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full text-center mb-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'var(--primary-bg)' }}>
          <Link2 size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>Nueva receta</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Pega la URL de cualquier web de recetas y la creamos automáticamente
        </p>
      </div>

      <div className="w-full card !p-0 overflow-hidden" style={{ borderColor: error ? 'var(--error)' : 'var(--border)' }}>
        <div className="flex items-center">
          <input
            ref={inputRef}
            type="url"
            className="flex-1 px-5 py-4 text-base outline-none bg-transparent"
            style={{ color: 'var(--text)' }}
            placeholder="https://directoalpaladar.com/receta-de-…"
            value={url}
            onChange={e => { setUrl(e.target.value); setError('') }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={creando}
            autoFocus
          />
          {creando && (
            <div className="flex items-center gap-2 pr-5">
              <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>Creando…</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm mt-3 px-4 py-2 rounded-lg" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
          {error}
        </p>
      )}

      <p className="text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
        La receta se creará automáticamente al pegar la URL o pulsar Enter
      </p>

      <div className="mt-8 pt-6 border-t w-full text-center" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => { saltarBlurRef.current = true; setModoFormulario(true) }}
          className="text-sm flex items-center gap-2 mx-auto px-4 py-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.color = 'var(--text)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <Plus size={14} />
          O crea una receta desde cero
        </button>
      </div>
    </div>
  )
}

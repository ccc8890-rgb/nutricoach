'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Link2, FileText, Hash, Loader2, Sparkles } from 'lucide-react'

const DISCIPLINAS = ['nutricion', 'hyrox', 'running', 'ciclismo', 'triatlon', 'hibrido', 'fuerza', 'recuperacion', 'general']
const CATEGORIAS = ['periodizacion', 'intensidad', 'volumen', 'fuerza', 'resistencia', 'hiit', 'zona2', 'competicion', 'recuperacion', 'proteina', 'hidratacion', 'suplementacion', 'patologia', 'composicion_corporal', 'metabolismo', 'metodologia', 'otro']
const TIPOS = ['estudio', 'meta_analisis', 'revision', 'guia_clinica', 'protocolo', 'metodologia', 'referencia', 'nota_propia']
const NIVELES = ['meta_analisis', 'rct', 'revision_sistematica', 'estudio_observacional', 'opinion_experto', 'practica_clinica']

type Modo = 'url' | 'doi' | 'texto' | 'manual'

const FORM_VACIO = {
  titulo: '',
  resumen: '',
  fuente: '',
  disciplina: 'hyrox',
  categoria: 'periodizacion',
  tipo: 'estudio',
  nivel_evidencia: '',
  tags: '',
  poblacion: '',
  condiciones: '',
  puntos_clave: '',
  url_origen: '',
  doi: '',
  contenido_completo: '',
}

export default function NuevaFichaPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('url')
  const [input, setInput] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [prerellenado, setPrerellenado] = useState(false)

  function setField(k: string, v: string) {
    setForm(p => ({ ...p, [k]: v }))
  }

  async function procesar() {
    if (!input.trim()) return
    setProcesando(true)

    const body: Record<string, string> = {}
    if (modo === 'url') body.url = input.trim()
    else if (modo === 'doi') body.doi = input.trim()
    else body.texto = input.trim()

    const res = await fetch('/api/conocimiento/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setProcesando(false)

    if (!res.ok) {
      alert(data.error ?? 'Error al procesar')
      return
    }

    setForm({
      titulo: data.titulo ?? '',
      resumen: data.resumen ?? '',
      fuente: data.fuente ?? '',
      disciplina: data.disciplina ?? 'general',
      categoria: data.categoria ?? 'otro',
      tipo: data.tipo ?? 'estudio',
      nivel_evidencia: data.nivel_evidencia ?? '',
      tags: (data.tags ?? []).join(', '),
      poblacion: (data.poblacion ?? []).join(', '),
      condiciones: (data.condiciones ?? []).join(', '),
      puntos_clave: (data.puntos_clave ?? []).join('\n'),
      url_origen: data.url_origen ?? input.trim(),
      doi: data.doi ?? '',
      contenido_completo: data.contenido_completo ?? '',
    })
    setPrerellenado(true)
  }

  async function guardar() {
    if (!form.titulo.trim() || !form.resumen.trim()) return
    setGuardando(true)

    const payload = {
      ...form,
      tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
      poblacion: form.poblacion.split(',').map(s => s.trim()).filter(Boolean),
      condiciones: form.condiciones.split(',').map(s => s.trim()).filter(Boolean),
      puntos_clave: form.puntos_clave.split('\n').map(s => s.trim()).filter(Boolean),
      nivel_evidencia: form.nivel_evidencia || null,
      doi: form.doi || null,
      url_origen: form.url_origen || null,
      contenido_completo: form.contenido_completo || null,
      fuente_tipo: prerellenado ? (modo === 'doi' ? 'doi' : modo === 'url' ? 'scrapeado' : 'ia_generado') : 'manual',
    }

    const res = await fetch('/api/conocimiento', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    setGuardando(false)
    if (res.ok) {
      router.push('/conocimiento')
    } else {
      const err = await res.json()
      alert(err.error ?? 'Error al guardar')
    }
  }

  const modos: { id: Modo; label: string; icon: React.ReactNode; placeholder: string }[] = [
    { id: 'url', label: 'URL', icon: <Link2 size={14} />, placeholder: 'https://pubmed.ncbi.nlm.nih.gov/...' },
    { id: 'doi', label: 'DOI', icon: <Hash size={14} />, placeholder: '10.1038/s41591-024-...' },
    { id: 'texto', label: 'Texto', icon: <FileText size={14} />, placeholder: 'Pega el abstract o el texto del artículo aquí…' },
    { id: 'manual', label: 'Manual', icon: <Sparkles size={14} />, placeholder: '' },
  ]

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/conocimiento" className="btn-secondary p-2"><ArrowLeft size={18} /></Link>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Nueva ficha de conocimiento</h1>
      </div>

      {/* Modo de ingesta */}
      <div className="card mb-5">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Fuente</p>
        <div className="flex gap-2 mb-4">
          {modos.map(m => (
            <button key={m.id} onClick={() => setModo(m.id)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-medium"
              style={modo === m.id
                ? { background: 'var(--primary)', color: 'white', borderColor: 'var(--primary)' }
                : { background: 'var(--surface)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {modo !== 'manual' && (
          <div className="flex gap-2">
            {modo === 'texto' ? (
              <textarea
                className="input resize-none h-24 flex-1 text-sm"
                placeholder={modos.find(m2 => m2.id === modo)?.placeholder}
                value={input}
                onChange={e => setInput(e.target.value)}
              />
            ) : (
              <input
                className="input flex-1"
                placeholder={modos.find(m2 => m2.id === modo)?.placeholder}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && procesar()}
              />
            )}
            <button
              onClick={procesar}
              disabled={procesando || !input.trim()}
              className="btn btn-primary flex-shrink-0 disabled:opacity-50">
              {procesando ? <><Loader2 size={15} className="animate-spin" /> Analizando…</> : <><Sparkles size={15} /> Analizar con IA</>}
            </button>
          </div>
        )}

        {prerellenado && (
          <p className="text-xs mt-2 font-medium" style={{ color: 'var(--primary)' }}>
            ✓ Ficha pre-rellenada por IA — revisa y ajusta antes de guardar
          </p>
        )}
      </div>

      {/* Formulario */}
      <div className="card flex flex-col gap-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {prerellenado ? 'Revisa y ajusta' : 'Datos de la ficha'}
        </p>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Título *</label>
          <input className="input" value={form.titulo} onChange={e => setField('titulo', e.target.value)} placeholder="Ej: Efecto del entrenamiento polarizado en HYROX…" />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Resumen accionable * (lo que usa la IA)</label>
          <textarea className="input resize-none h-28" value={form.resumen} onChange={e => setField('resumen', e.target.value)} placeholder="Conclusiones clave en lenguaje directo para el coach…" />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Puntos clave (uno por línea)</label>
          <textarea className="input resize-none h-20 text-sm" value={form.puntos_clave} onChange={e => setField('puntos_clave', e.target.value)} placeholder={"80% del volumen en zona 1-2\nEl 20% restante en zona 5\n..."} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Disciplina *</label>
            <select className="input" value={form.disciplina} onChange={e => setField('disciplina', e.target.value)}>
              {DISCIPLINAS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Categoría *</label>
            <select className="input" value={form.categoria} onChange={e => setField('categoria', e.target.value)}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
            <select className="input" value={form.tipo} onChange={e => setField('tipo', e.target.value)}>
              {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nivel de evidencia</label>
            <select className="input" value={form.nivel_evidencia} onChange={e => setField('nivel_evidencia', e.target.value)}>
              <option value="">— Seleccionar —</option>
              {NIVELES.map(n => <option key={n} value={n}>{n.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Fuente (autor, año, revista)</label>
          <input className="input" value={form.fuente} onChange={e => setField('fuente', e.target.value)} placeholder="Seiler KS, 2010. Scandinavian Journal of Medicine & Science in Sports" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tags (separados por coma)</label>
            <input className="input text-sm" value={form.tags} onChange={e => setField('tags', e.target.value)} placeholder="zona2, polarizado, umbral" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Condiciones (separadas por coma)</label>
            <input className="input text-sm" value={form.condiciones} onChange={e => setField('condiciones', e.target.value)} placeholder="hyrox, tendinitis, menopausia" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Población (separada por coma)</label>
            <input className="input text-sm" value={form.poblacion} onChange={e => setField('poblacion', e.target.value)} placeholder="atletas amateur, mujeres, masters" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>URL de origen</label>
            <input className="input text-sm" value={form.url_origen} onChange={e => setField('url_origen', e.target.value)} placeholder="https://..." />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-5 pb-8">
        <Link href="/conocimiento" className="btn-secondary">Cancelar</Link>
        <button
          onClick={guardar}
          disabled={!form.titulo.trim() || !form.resumen.trim() || guardando}
          className="btn btn-primary disabled:opacity-50">
          {guardando ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Guardar ficha'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TagInput } from '@/components/ui/TagInput'
import EstructuraSesionEditor from './EstructuraSesionEditor'
import { CONFIANZAS, ETIQUETA, MATERIALES, MODALIDADES, NIVELES, OBJETIVOS, TIPOS_METODO, type BloqueMetodo, type Material, type Metodo } from '@/lib/metodos/constantes'

interface Props {
  inicial?: Metodo
  onGuardado?: (m: Metodo) => void
}

const Campo = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{etiqueta}</span>
    {children}
  </label>
)

async function llamar<T>(url: string, metodo: 'POST' | 'PATCH', cuerpo: unknown): Promise<{ ok: true; datos: T } | { ok: false; error: string; existenteId?: string }> {
  const res = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: datos.error || 'No se pudo guardar', existenteId: datos.existente_id }
  return { ok: true, datos: datos as T }
}

// Formulario de alta y edición de una ficha. La miniatura se sube desde la ficha ya creada (necesita su id).
export default function FichaMetodo({ inicial, onGuardado }: Props) {
  const router = useRouter()
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'sesion')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [resumen, setResumen] = useState(inicial?.resumen ?? '')
  const [modalidad, setModalidad] = useState(inicial?.modalidad ?? 'fuerza')
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? '')
  const [nivel, setNivel] = useState(inicial?.nivel ?? '')
  const [material, setMaterial] = useState<Material[]>(inicial?.material ?? [])
  const [duracion, setDuracion] = useState(inicial?.duracion_min ? String(inicial.duracion_min) : '')
  const [autor, setAutor] = useState(inicial?.autor ?? '')
  const [plataforma, setPlataforma] = useState(inicial?.plataforma ?? '')
  const [urlOrigen, setUrlOrigen] = useState(inicial?.url_origen ?? '')
  const [videoUrl, setVideoUrl] = useState(inicial?.video_url ?? '')
  const [confianza, setConfianza] = useState(inicial?.confianza ?? 'anecdotico')
  const [notas, setNotas] = useState(inicial?.notas_coach ?? '')
  const [tags, setTags] = useState<string[]>(inicial?.tags ?? [])
  const [estructura, setEstructura] = useState<BloqueMetodo[]>(inicial?.estructura ?? [])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [existenteId, setExistenteId] = useState<string | null>(null)

  const cuerpo = () => ({
    tipo, titulo, resumen: resumen || null, modalidad, objetivo: objetivo || null, nivel: nivel || null, material,
    duracion_min: duracion ? Number(duracion) : null, autor: autor || null, plataforma: plataforma || null,
    url_origen: urlOrigen || null, video_url: videoUrl || null, confianza, notas_coach: notas || null, tags,
    estructura: tipo === 'sesion' ? estructura : [],
  })

  const guardar = async (aprobar: boolean) => {
    setGuardando(true); setError(''); setExistenteId(null)
    try {
      const r = inicial
        ? await llamar<{ metodo: Metodo }>(`/api/metodos/${inicial.id}`, 'PATCH', cuerpo())
        : await llamar<{ metodo: Metodo }>('/api/metodos', 'POST', cuerpo())
      if (!r.ok) { setError(r.error); setExistenteId(r.existenteId ?? null); return }
      let ficha = r.datos.metodo
      if (aprobar) {
        const a = await llamar<{ metodo: Metodo }>(`/api/metodos/${ficha.id}/estado`, 'PATCH', { estado: 'aprobada' })
        if (!a.ok) { setError(`La ficha se guardó, pero no se pudo aprobar: ${a.error}`); router.push(`/entrenos/metodos/${ficha.id}`); return }
        ficha = a.datos.metodo
      }
      if (inicial) onGuardado?.(ficha)
      else router.push(`/entrenos/metodos/${ficha.id}`)
    } catch {
      setError('No se pudo guardar: comprueba la conexión')
    } finally {
      setGuardando(false)
    }
  }

  const alternarMaterial = (m: Material) => setMaterial(material.includes(m) ? material.filter(x => x !== m) : [...material, m])

  return (
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); void guardar(false) }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Tipo"><select className="input" value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}>{TIPOS_METODO.map(t => <option key={t} value={t}>{ETIQUETA[t]}</option>)}</select></Campo>
        <Campo etiqueta="Modalidad"><select className="input" value={modalidad} onChange={e => setModalidad(e.target.value as typeof modalidad)}>{MODALIDADES.map(m => <option key={m} value={m}>{ETIQUETA[m]}</option>)}</select></Campo>
      </div>
      <Campo etiqueta="Título"><input className="input" value={titulo} onChange={e => setTitulo(e.target.value)} maxLength={160} required /></Campo>
      <Campo etiqueta="Resumen"><textarea className="input" rows={3} value={resumen} onChange={e => setResumen(e.target.value)} placeholder="Con tus palabras: qué propone y por qué te interesa" /></Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Objetivo"><select className="input" value={objetivo} onChange={e => setObjetivo(e.target.value as typeof objetivo)}><option value="">—</option>{OBJETIVOS.map(o => <option key={o} value={o}>{ETIQUETA[o]}</option>)}</select></Campo>
        <Campo etiqueta="Nivel"><select className="input" value={nivel} onChange={e => setNivel(e.target.value as typeof nivel)}><option value="">—</option>{NIVELES.map(n => <option key={n} value={n}>{ETIQUETA[n]}</option>)}</select></Campo>
        <Campo etiqueta="Duración (min)"><input className="input" type="number" min={1} max={600} value={duracion} onChange={e => setDuracion(e.target.value)} /></Campo>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Material</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {MATERIALES.map(m => <label key={m} className="text-sm flex items-center gap-1"><input type="checkbox" checked={material.includes(m)} onChange={() => alternarMaterial(m)} />{ETIQUETA[m]}</label>)}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Autor"><input className="input" value={autor} onChange={e => setAutor(e.target.value)} placeholder="@usuario o nombre" /></Campo>
        <Campo etiqueta="Plataforma"><input className="input" value={plataforma} onChange={e => setPlataforma(e.target.value)} placeholder="Instagram, YouTube, web…" /></Campo>
        <Campo etiqueta="Enlace de origen"><input className="input" value={urlOrigen} onChange={e => setUrlOrigen(e.target.value)} placeholder="https://…" /></Campo>
        <Campo etiqueta="Enlace al vídeo"><input className="input" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://… (si es distinto del origen)" /></Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Confianza"><select className="input" value={confianza} onChange={e => setConfianza(e.target.value as typeof confianza)}>{CONFIANZAS.map(c => <option key={c} value={c}>{ETIQUETA[c]}</option>)}</select></Campo>
        <Campo etiqueta="Etiquetas"><TagInput tags={tags} onChange={setTags} placeholder="Añadir etiqueta" maxTags={12} /></Campo>
      </div>
      {tipo === 'sesion' && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Sesión</p>
          <EstructuraSesionEditor valor={estructura} onCambio={setEstructura} />
        </div>
      )}
      <Campo etiqueta="Notas tuyas"><textarea className="input" rows={3} value={notas} onChange={e => setNotas(e.target.value)} /></Campo>

      {error && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger, #c0392b)' }}>
          {error}{existenteId && <> · <Link href={`/entrenos/metodos/${existenteId}`} className="underline">Abrir la existente</Link></>}
        </p>
      )}
      <div className="flex gap-3 flex-wrap">
        <button type="submit" className="btn btn-primary" disabled={guardando || !titulo.trim()}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        {!inicial && <button type="button" className="btn btn-secondary" disabled={guardando || !titulo.trim()} onClick={() => void guardar(true)}>Guardar y aprobar</button>}
        {!inicial && <p className="text-xs self-center" style={{ color: 'var(--text-muted)' }}>La miniatura se sube desde la ficha, una vez guardada.</p>}
      </div>
    </form>
  )
}

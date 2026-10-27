'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import FichaMetodo from '@/components/metodos/FichaMetodo'
import { ETIQUETA, type EstadoMetodo, type Metodo } from '@/lib/metodos/constantes'
import { listaRecordada } from '@/lib/useEstadoUrl'

interface Evento { tipo: string; nota: string | null; created_at: string }
const TEXTO_EVENTO: Record<string, string> = {
  creada: 'Ficha creada', editada: 'Ficha editada', aprobada: 'Aprobada', descartada: 'Descartada', reabierta: 'Reabierta',
  ia_activada: 'Activada para la IA', ia_desactivada: 'Desactivada para la IA',
}
const ACCIONES: Record<EstadoMetodo, { estado: EstadoMetodo; texto: string }[]> = {
  en_revision: [{ estado: 'aprobada', texto: 'Aprobar' }, { estado: 'descartada', texto: 'Descartar' }],
  aprobada: [{ estado: 'en_revision', texto: 'Reabrir' }, { estado: 'descartada', texto: 'Descartar' }],
  descartada: [{ estado: 'en_revision', texto: 'Reabrir' }],
  con_agente: [],
}
const fecha = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function FichaMetodoPage() {
  const { id } = useParams<{ id: string }>()
  const [metodo, setMetodo] = useState<Metodo | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/metodos/${id}`)
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(datos.error || 'No se pudo cargar la ficha')
      setMetodo(datos.metodo); setEventos(datos.eventos ?? []); setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la ficha')
    } finally {
      setCargando(false)
    }
  }, [id])
  useEffect(() => { void cargar() }, [cargar])

  const accion = async (url: string, cuerpo: unknown) => {
    setTrabajando(true); setAviso('')
    try {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(datos.error || 'No se pudo completar la acción'); return }
      await cargar()
    } catch {
      setAviso('No se pudo completar la acción: comprueba la conexión')
    } finally {
      setTrabajando(false)
    }
  }

  const subirMiniatura = useCallback(async (f: File) => {
    setTrabajando(true); setAviso('')
    try {
      const form = new FormData(); form.append('archivo', f)
      const res = await fetch(`/api/metodos/${id}/miniatura`, { method: 'POST', body: form })
      const datos = await res.json().catch(() => ({}))
      if (!res.ok) { setAviso(datos.error || 'No se pudo subir la miniatura'); return }
      await cargar()
    } catch {
      setAviso('No se pudo subir la miniatura: comprueba la conexión')
    } finally {
      setTrabajando(false)
    }
  }, [id, cargar])

  // ⌘V con una imagen en el portapapeles sube la miniatura
  useEffect(() => {
    const alPegar = (ev: ClipboardEvent) => {
      const imagen = [...(ev.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'))
      if (imagen && !['INPUT', 'TEXTAREA'].includes((ev.target as HTMLElement)?.tagName)) void subirMiniatura(imagen)
    }
    window.addEventListener('paste', alPegar)
    return () => window.removeEventListener('paste', alPegar)
  }, [subirMiniatura])

  if (cargando) return <div className="max-w-3xl mx-auto px-4 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>Cargando…</div>
  if (!metodo) return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-3">
      <p role="alert" className="text-sm">{error || 'Ficha no encontrada'}</p>
      <Link href="/entrenos/metodos" className="underline text-sm">Volver a la biblioteca</Link>
    </div>
  )

  const original = metodo.url_origen || metodo.video_url
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <Link href={listaRecordada('metodos', '/entrenos/metodos')} className="text-sm" style={{ color: 'var(--text-muted)' }}>← Biblioteca de métodos</Link>
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{ETIQUETA[metodo.estado]}</p>
        {metodo.miniatura_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={metodo.miniatura_url} alt="" className="w-full max-h-72 object-cover" />
          : <div className="w-full h-32 flex items-center justify-center text-xs uppercase tracking-widest" style={{ background: 'var(--surface-2, rgba(128,128,128,0.08))', color: 'var(--text-muted)' }}>Sin miniatura</div>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-secondary btn-sm" disabled={trabajando} onClick={() => archivo.current?.click()}>{metodo.miniatura_url ? 'Cambiar miniatura' : 'Subir miniatura'}</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>o pega una imagen con ⌘V</span>
          <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void subirMiniatura(f); e.target.value = '' }} />
          {original && <a href={original} target="_blank" rel="noopener noreferrer" className="text-sm underline">Ver original</a>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {ACCIONES[metodo.estado].map(a => (
            <button key={a.estado} type="button" className={a.estado === 'aprobada' ? 'btn btn-primary' : 'btn btn-secondary'} disabled={trabajando} onClick={() => void accion(`/api/metodos/${id}/estado`, { estado: a.estado })}>{a.texto}</button>
          ))}
          <label className="text-sm flex items-center gap-2" style={{ color: metodo.estado === 'aprobada' ? 'var(--text)' : 'var(--text-muted)' }}>
            <input type="checkbox" checked={metodo.disponible_ia} disabled={trabajando || metodo.estado !== 'aprobada'} onChange={e => void accion(`/api/metodos/${id}`, { disponible_ia: e.target.checked })} />
            Disponible para la IA{metodo.estado !== 'aprobada' && ' (solo fichas aprobadas)'}
          </label>
        </div>
        {aviso && <p role="alert" className="text-sm" style={{ color: 'var(--danger, #c0392b)' }}>{aviso}</p>}
      </header>

      <FichaMetodo key={metodo.id} inicial={metodo} onGuardado={m => { setMetodo(m); void cargar() }} />

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>Historial</h2>
        <ul className="text-sm space-y-1">
          {eventos.map((e, i) => <li key={i}>{fecha(e.created_at)} · {TEXTO_EVENTO[e.tipo] ?? e.tipo}{e.nota ? ` — ${e.nota}` : ''}</li>)}
          {!eventos.length && <li style={{ color: 'var(--text-muted)' }}>Sin movimientos todavía.</li>}
        </ul>
      </section>
    </div>
  )
}

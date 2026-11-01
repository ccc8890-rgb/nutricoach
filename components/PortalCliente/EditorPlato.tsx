'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, Trash, X } from '@/components/icons/portal-phosphor'
import { Plus } from '@/components/icons/portal-lucide'

export type PlatoDetalle = {
  id: string; nombre: string; tipo_comida: string; estado: 'borrador' | 'pendiente' | 'aprobado' | 'devuelto'
  foto_original_url: string | null; foto_limpia_url: string | null; porciones: number; pasos: string | null
  kcal: number; proteinas: number; carbohidratos: number; grasas: number; incompleto: boolean; estimado: boolean; nota_coach: string | null
}
type Linea = { nombre_libre: string; cantidad_gramos: number; alimento_id: string | null }

const ESTADO_TEXTO: Record<PlatoDetalle['estado'], string> = {
  borrador: 'Borrador: aún no se lo has enviado a tu coach.',
  pendiente: 'Pendiente de revisión: tu coach lo está mirando. Las cifras son aproximadas.',
  aprobado: 'Aprobado por tu coach. Si lo cambias, volverá a revisión (mientras tanto sigue valiendo la versión aprobada).',
  devuelto: 'Tu coach lo ha devuelto. Corrígelo y vuelve a enviarlo.',
}

/** Ficha editable de un plato propio: foto, nombre, ingredientes con gramos y pasos. Las cifras son «estimadas» hasta que el coach aprueba. */
export default function EditorPlato({ codigo, platoId, aviso, onVolver }: { codigo: string; platoId: string; aviso?: string | null; onVolver: () => void }) {
  const [plato, setPlato] = useState<PlatoDetalle | null>(null)
  const [lineas, setLineas] = useState<Linea[]>([])
  const [nombre, setNombre] = useState('')
  const [pasos, setPasos] = useState('')
  const [sucio, setSucio] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  function aplicar(p: PlatoDetalle, l: Linea[]) {
    setPlato(p); setLineas(l.map(x => ({ nombre_libre: x.nombre_libre, cantidad_gramos: Number(x.cantidad_gramos), alimento_id: x.alimento_id })))
    setNombre(p.nombre); setPasos(p.pasos ?? ''); setSucio(false)
  }
  useEffect(() => {
    let vivo = true
    fetch(`/api/cliente/${codigo}/platos/${platoId}`).then(r => r.json()).then(j => { if (vivo && j.plato) aplicar(j.plato, j.lineas ?? []) }).catch(() => setError('No se pudo cargar el plato')).finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [codigo, platoId])

  async function guardar(): Promise<boolean> {
    setOcupado(true); setError(null)
    try {
      const r = await fetch(`/api/cliente/${codigo}/platos/${platoId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, pasos, lineas: lineas.filter(l => l.nombre_libre.trim().length >= 2) }),
      })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'No se pudo guardar'); return false }
      aplicar(j.plato, j.lineas ?? []); return true
    } catch { setError('No se pudo guardar'); return false } finally { setOcupado(false) }
  }
  async function enviar() {
    if (sucio && !(await guardar())) return
    setOcupado(true); setError(null)
    try {
      const r = await fetch(`/api/cliente/${codigo}/platos/${platoId}/enviar`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'No se pudo enviar'); return }
      setPlato(j.plato)
    } catch { setError('No se pudo enviar') } finally { setOcupado(false) }
  }
  async function borrar() {
    if (!window.confirm('¿Borrar este plato?')) return
    const r = await fetch(`/api/cliente/${codigo}/platos/${platoId}`, { method: 'DELETE' })
    if (r.ok) onVolver(); else setError((await r.json().catch(() => ({}))).error ?? 'No se pudo borrar')
  }
  const cambiarLinea = (i: number, c: Partial<Linea>) => { setLineas(ls => ls.map((l, k) => (k === i ? { ...l, ...c } : l))); setSucio(true) }

  if (cargando) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>
  if (!plato) return <div><button type="button" onClick={onVolver} className="editorial-action"><ArrowLeft size={16} /><span>Volver</span></button><p className="text-sm mt-3" role="alert">{error ?? 'Plato no encontrado'}</p></div>

  const foto = plato.foto_limpia_url ?? plato.foto_original_url
  const puedeEnviar = plato.estado === 'borrador' || plato.estado === 'devuelto'
  const sinEnlazar = lineas.filter(l => !l.alimento_id).length

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onVolver} className="editorial-action self-start"><ArrowLeft size={16} /><span>Mis platos</span></button>

      <div className="flex gap-2">
        {foto && <div className="relative w-1/2 aspect-square"><Image src={foto} alt="Foto del plato" fill sizes="50vw" className="object-cover" /></div>}
        {plato.foto_limpia_url && plato.foto_original_url && <div className="relative w-1/2 aspect-square" style={{ opacity: 0.85 }}><Image src={plato.foto_original_url} alt="Foto original" fill sizes="50vw" className="object-cover" /></div>}
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{ESTADO_TEXTO[plato.estado]}</p>
      {plato.estado === 'devuelto' && plato.nota_coach && <p className="text-sm p-2" style={{ border: '1px solid var(--editorial-rule)' }}>Tu coach: {plato.nota_coach}</p>}
      {aviso && <p className="text-sm" role="status" style={{ color: 'var(--text-secondary)' }}>{aviso}</p>}

      <input value={nombre} onChange={e => { setNombre(e.target.value); setSucio(true) }} maxLength={80} placeholder="Nombre del plato" aria-label="Nombre del plato"
        className="text-lg font-semibold p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />

      <div>
        <p className="editorial-kicker">{plato.estimado ? 'Valores estimados' : 'Valores'}</p>
        <p className="font-mono text-sm mt-1" style={{ color: 'var(--text)' }}>
          {Math.round(plato.kcal)} kcal · P {Math.round(plato.proteinas)} · C {Math.round(plato.carbohidratos)} · G {Math.round(plato.grasas)}
        </p>
        {(plato.incompleto || sinEnlazar > 0) && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Hay ingredientes sin datos nutricionales: las cifras están incompletas hasta que tu coach los revise.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <p className="editorial-kicker">Ingredientes</p>
        {lineas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={l.nombre_libre} onChange={e => cambiarLinea(i, { nombre_libre: e.target.value, alimento_id: null })} aria-label={`Ingrediente ${i + 1}`} maxLength={80}
              className="flex-1 min-w-0 text-sm p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <input value={l.cantidad_gramos} onChange={e => cambiarLinea(i, { cantidad_gramos: Number(e.target.value.replace(',', '.')) || 0 })} inputMode="decimal" aria-label={`Gramos de ${l.nombre_libre}`}
              className="w-20 text-sm p-2 text-right" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
            <span className="text-xs w-3" style={{ color: 'var(--text-muted)' }}>g</span>
            <button type="button" aria-label={`Quitar ${l.nombre_libre}`} onClick={() => { setLineas(ls => ls.filter((_, k) => k !== i)); setSucio(true) }} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
        ))}
        {lineas.length < 25 && (
          <button type="button" className="editorial-action self-start" onClick={() => { setLineas(ls => [...ls, { nombre_libre: '', cantidad_gramos: 0, alimento_id: null }]); setSucio(true) }}>
            <Plus size={14} /><span>Añadir ingrediente</span>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="editorial-kicker">Preparación</p>
        <textarea value={pasos} onChange={e => { setPasos(e.target.value); setSucio(true) }} rows={5} maxLength={3000} aria-label="Pasos de la preparación"
          className="text-sm p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
      </div>

      {error && <p className="text-sm" role="alert" style={{ color: 'var(--danger, #d4554a)' }}>{error}</p>}

      <div className="flex flex-wrap gap-2">
        {sucio && <button type="button" className="editorial-action" disabled={ocupado} style={{ border: '1px solid var(--editorial-rule)' }} onClick={() => { void guardar() }}><span>{ocupado ? 'Guardando…' : 'Guardar cambios'}</span></button>}
        {puedeEnviar && <button type="button" className="editorial-action" disabled={ocupado} style={{ border: '1px solid var(--editorial-rule)', color: 'var(--text)' }} onClick={() => { void enviar() }}><span>Enviar a mi coach</span></button>}
        {puedeEnviar && <button type="button" className="editorial-action" disabled={ocupado} onClick={() => { void borrar() }}><Trash size={14} /><span>Borrar</span></button>}
      </div>
    </div>
  )
}

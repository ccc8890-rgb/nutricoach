'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Plus } from '@/components/icons/portal-lucide'
import { reducirFoto } from '@/lib/platos/reducir-foto'
import EditorPlato, { type PlatoDetalle } from './EditorPlato'

type PlatoResumen = {
  id: string; nombre: string; tipo_comida: string; estado: 'borrador' | 'pendiente' | 'aprobado' | 'devuelto'
  foto_original_url: string | null; foto_limpia_url: string | null; kcal: number; estimado: boolean; nota_coach: string | null
}

const ETIQUETA: Record<PlatoResumen['estado'], string> = { borrador: 'Borrador', pendiente: 'Pendiente de revisión', aprobado: 'Aprobado', devuelto: 'Devuelto por tu coach' }
const TIPOS = ['Desayuno', 'Comida', 'Cena', 'Snack', 'Otro'] as const

/** Sub-pestaña «Mis platos»: los platos habituales del cliente (foto → ficha estimada → revisión del coach). */
export default function PlatosCliente({ codigo, abrirId, onAbierto }: { codigo: string; abrirId?: string | null; onAbierto?: () => void }) {
  const [platos, setPlatos] = useState<PlatoResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('Comida')
  const [nota, setNota] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const fotoRef = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/cliente/${codigo}/platos`)
      const j = await r.json()
      setPlatos(r.ok ? j.platos ?? [] : [])
    } catch { setPlatos([]) }
    setCargando(false)
  }, [codigo])
  useEffect(() => { cargar() }, [cargar])
  useEffect(() => { if (abrirId) { setAbierto(abrirId); onAbierto?.() } }, [abrirId, onAbierto])

  async function subir(file: File) {
    setSubiendo(true); setError(null); setAviso(null)
    const fd = new FormData()
    fd.append('foto', await reducirFoto(file)); fd.append('tipo_comida', tipo); if (nota.trim()) fd.append('nota', nota.trim())
    try {
      const r = await fetch(`/api/cliente/${codigo}/platos`, { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok) { setError(j.error ?? 'No se pudo analizar la foto'); return }
      setNuevo(false); setNota(''); setAviso(j.aviso ?? null)
      await cargar(); setAbierto(j.plato.id)
      // Retoque opcional: no bloquea nada; si llega, la ficha lo enseñará la próxima vez que se abra
      fetch(`/api/cliente/${codigo}/platos/${j.plato.id}/foto-limpia`, { method: 'POST' }).then(() => cargar()).catch(() => {})
    } catch { setError('No se pudo analizar la foto') } finally { setSubiendo(false) }
  }

  if (abierto) {
    return <EditorPlato codigo={codigo} platoId={abierto} aviso={aviso} onVolver={() => { setAbierto(null); setAviso(null); cargar() }} />
  }
  if (cargando) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Haz una foto de lo que comes habitualmente. Calculo una ficha aproximada; tu coach la revisa y la ajusta a tu dieta.</p>

      {!nuevo ? (
        <button type="button" className="editorial-action" style={{ border: '1px solid var(--editorial-rule)' }} onClick={() => setNuevo(true)}>
          <Plus size={16} /><span>Añadir mi plato</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3 p-3" style={{ border: '1px solid var(--editorial-rule)', background: 'var(--editorial-panel)' }}>
          <p className="editorial-kicker">Nuevo plato</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de comida">
            {TIPOS.map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)} aria-pressed={tipo === t}
                className="font-mono text-[11px] uppercase tracking-[0.06em] pb-1"
                style={{ color: tipo === t ? 'var(--text)' : 'var(--text-muted)', borderBottom: tipo === t ? '1px solid var(--text)' : '1px solid transparent' }}>{t}</button>
            ))}
          </div>
          <input value={nota} onChange={e => setNota(e.target.value)} maxLength={500} placeholder="Nota opcional: «lo como casi a diario»" className="text-sm p-2"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <input ref={fotoRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" capture="environment" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) subir(f); e.target.value = '' }} />
          <div className="flex gap-2">
            <button type="button" className="editorial-action" disabled={subiendo} style={{ border: '1px solid var(--editorial-rule)' }} onClick={() => fotoRef.current?.click()}>
              <Camera size={16} /><span>{subiendo ? 'Analizando…' : 'Hacer o elegir foto'}</span>
            </button>
            <button type="button" className="editorial-action" disabled={subiendo} onClick={() => { setNuevo(false); setError(null) }}><span>Cancelar</span></button>
          </div>
          {error && <p className="text-sm" role="alert" style={{ color: 'var(--danger, #d4554a)' }}>{error}</p>}
        </div>
      )}

      {platos.length === 0 ? (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Aún no has añadido ningún plato.</p>
      ) : (
        <ul className="flex flex-col" style={{ borderTop: '1px solid var(--editorial-rule)' }}>
          {platos.map(p => (
            <li key={p.id} style={{ borderBottom: '1px solid var(--editorial-rule)' }}>
              <button type="button" onClick={() => setAbierto(p.id)} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="relative w-14 h-14 shrink-0 overflow-hidden" style={{ background: 'var(--surface-elevated)' }}>
                  {(p.foto_limpia_url ?? p.foto_original_url) && <Image src={p.foto_limpia_url ?? p.foto_original_url ?? ''} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{p.nombre || 'Plato sin nombre'}</span>
                  <span className="block font-mono text-[11px] uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>
                    {ETIQUETA[p.estado]} · {Math.round(p.kcal)} kcal{p.estimado ? ' (estimado)' : ''}
                  </span>
                  {p.estado === 'devuelto' && p.nota_coach && <span className="block text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Tu coach: {p.nota_coach}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type { PlatoDetalle }

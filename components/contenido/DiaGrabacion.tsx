'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { formatoFecha, hoyMadrid } from '@/lib/contenido/fechas'
import type { LineaCompraTanda } from '@/lib/contenido/compra-tanda'
import { api } from './api'
import { useClientes } from './useClientes'
import EscaletaPlanos from './EscaletaPlanos'
import SelectorReceta from './SelectorReceta'
import type { Pieza } from './tipos'

type Tanda = {
  fecha: string
  piezas: Pieza[]
  compra: { lineas: LineaCompraTanda[]; costeEstimado: number }
  resumen: { recetas: number; minutos: number; planosPendientes: number; enDieta: number }
}
type RecetaDieta = { id: string; nombre: string; origen: string }

const clave = (fecha: string) => `contenido:tengo:${fecha}`
const CLAVE_DIA = 'contenido:dia'
const diaGuardado = () => { try { return sessionStorage.getItem(CLAVE_DIA) } catch { return null } }
const pasosDe = (texto: string | null | undefined) => (texto ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean)

export default function DiaGrabacion({ fechaInicial }: { fechaInicial?: string }) {
  const { addToast } = useToast()
  const [fecha, setFechaEstado] = useState(fechaInicial ?? hoyMadrid())
  const { clientes, clienteId, setClienteId } = useClientes()
  const [resultado, setResultado] = useState<{ colocadas: number; omitidas: { titulo: string; motivo: string }[] } | null>(null)
  const [tanda, setTanda] = useState<Tanda | null>(null)
  const [tengo, setTengo] = useState<string[]>([])
  const [dieta, setDieta] = useState<RecetaDieta[] | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [fueraDeDieta, setFueraDeDieta] = useState<string[]>([])

  useEffect(() => {
    const guardado = fechaInicial ? null : diaGuardado()
    if (guardado) setFechaEstado(guardado)
  }, [fechaInicial])

  function setFecha(f: string) {
    setFechaEstado(f)
    setResultado(null)
    try { sessionStorage.setItem(CLAVE_DIA, f) } catch { /* sin almacenamiento */ }
  }

  useEffect(() => {
    try { setTengo(JSON.parse(localStorage.getItem(clave(fecha)) ?? '[]')) } catch { setTengo([]) }
  }, [fecha])

  const cargar = useCallback(async () => {
    const q = new URLSearchParams({ fecha, ...(clienteId ? { cliente_id: clienteId } : {}) })
    const r = await api<Tanda>(`/api/contenido/tanda?${q}`)
    if (r.ok) setTanda(r.data)
    else addToast({ type: 'error', title: 'No se pudo cargar la tanda', message: r.error })
  }, [fecha, clienteId, addToast])

  useEffect(() => { cargar() }, [cargar])

  function alternarTengo(id: string) {
    const siguiente = tengo.includes(id) ? tengo.filter(x => x !== id) : [...tengo, id]
    setTengo(siguiente)
    try { localStorage.setItem(clave(fecha), JSON.stringify(siguiente)) } catch { /* sin almacenamiento: no pasa nada */ }
  }

  const alternarDieta = (id: string) => setFueraDeDieta(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id]))

  async function abrirDieta() {
    if (!clienteId) { addToast({ type: 'error', title: 'Elige primero una dieta' }); return }
    const r = await api<{ recetas: RecetaDieta[] }>(`/api/contenido/dieta-semana?cliente_id=${clienteId}`)
    if (r.ok) setDieta(r.data.recetas)
    else addToast({ type: 'error', title: 'No se pudo cargar la dieta', message: r.error })
  }

  async function anadirATanda(id: string) {
    const r = await api('/api/contenido/tanda/anadir', { method: 'POST', body: JSON.stringify({ fecha, receta_ids: [id] }) })
    if (!r.ok) { addToast({ type: 'error', title: 'No se pudo añadir', message: r.error }); return }
    cargar()
  }

  async function colocarEnDieta() {
    if (!clienteId || !tanda) return
    const incluidas = tanda.piezas.filter(p => p.receta_id && !fueraDeDieta.includes(p.id))
    if (incluidas.length === 0) { addToast({ type: 'error', title: 'No hay recetas marcadas para la dieta' }); return }
    if (!confirm(`Se colocarán ${incluidas.length} recetas en Comida y Cena desde el ${formatoFecha(fecha)}. Sustituye lo que haya en esos huecos de las semanas planificadas. ¿Continuar?`)) return
    const r = await api<{ colocadas: number; omitidas: { titulo: string; motivo: string }[] }>('/api/contenido/tanda/colocar', {
      method: 'POST', body: JSON.stringify({ fecha, cliente_id: clienteId, pieza_ids: incluidas.map(p => p.id) }),
    })
    if (!r.ok) { addToast({ type: 'error', title: 'No se pudo colocar en la dieta', message: r.error }); return }
    setResultado(r.data)
    cargar()
  }

  const porCategoria = useMemo(() => {
    const m = new Map<string, LineaCompraTanda[]>()
    for (const l of tanda?.compra.lineas ?? []) m.set(l.categoria, [...(m.get(l.categoria) ?? []), l])
    return [...m.entries()]
  }, [tanda])

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>Día <input className="input" type="date" value={fecha} onChange={e => e.target.value && setFecha(e.target.value)} /></label>
        <label>Dieta de{' '}
          <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">(sin dieta)</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
        </label>
        <span style={{ color: 'var(--text-muted)' }}>{formatoFecha(fecha)}</span>
      </div>

      {tanda && (
        <div className="card" style={{ padding: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><strong>{tanda.resumen.recetas}</strong> recetas</span>
          <span><strong>{tanda.resumen.minutos}</strong> min de preparación</span>
          <span><strong>{tanda.resumen.planosPendientes}</strong> planos por grabar</span>
          {clienteId && <span><strong>{tanda.resumen.enDieta}</strong> en la dieta</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => (dieta ? setDieta(null) : abrirDieta())}>
          {dieta ? 'Cerrar' : 'Añadir desde mi dieta'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => setBuscando(b => !b)}>{buscando ? 'Cerrar' : 'Añadir otra receta del recetario'}</button>
        <button className="btn btn-primary btn-sm" disabled={!clienteId || !tanda || tanda.piezas.length === 0} onClick={colocarEnDieta}>
          Colocar en mi dieta
        </button>
      </div>

      {resultado && (
        <div className="card" role="status" style={{ padding: 12, borderColor: resultado.omitidas.length ? 'var(--warning, #d97706)' : 'var(--success, #16a34a)' }}>
          <strong>{resultado.colocadas} {resultado.colocadas === 1 ? 'receta colocada' : 'recetas colocadas'} en la dieta</strong>
          {resultado.omitidas.map(o => <p key={o.titulo} style={{ margin: '4px 0 0', fontSize: 13 }}>{o.titulo}: {o.motivo}</p>)}
        </div>
      )}

      {dieta && (
        <div className="card" style={{ padding: 8, maxHeight: 260, overflowY: 'auto' }}>
          {dieta.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>La dieta no tiene recetas todavía.</p>}
          {dieta.map(r => {
            const yaEsta = tanda?.piezas.some(p => p.receta_id === r.id)
            return (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: 14 }}>{r.nombre} <span style={{ color: 'var(--text-muted)' }}>· {r.origen}</span></span>
                <button className="btn btn-ghost btn-sm" disabled={yaEsta} onClick={() => anadirATanda(r.id)}>{yaEsta ? 'En la tanda' : 'Añadir'}</button>
              </div>
            )
          })}
        </div>
      )}
      {buscando && <SelectorReceta onElegir={r => { anadirATanda(r.id); setBuscando(false) }} />}

      {tanda && tanda.piezas.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No hay recetas para grabar este día.</p>}

      {tanda?.piezas.map((p, i) => (
        <div key={p.id} className="card" style={{ padding: 12, display: 'grid', gap: 8 }}>
          <strong>{i + 1}. {p.titulo}{p.receta?.tiempo_prep_min ? ` · ${p.receta.tiempo_prep_min} min` : ''}</strong>
          {p.receta_id && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!fueraDeDieta.includes(p.id)} onChange={() => alternarDieta(p.id)} />
              Entra en mi dieta
            </label>
          )}
          <EscaletaPlanos piezaId={p.id} hechos={p.planos_hechos} onCambio={cargar} />
          {pasosDe(p.receta?.instrucciones).length > 0 && (
            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>Pasos de la receta</summary>
              <ol style={{ margin: '6px 0 0 18px' }}>{pasosDe(p.receta?.instrucciones).map((s, k) => <li key={k} style={{ fontSize: 13 }}>{s}</li>)}</ol>
            </details>
          )}
        </div>
      ))}

      {tanda && tanda.compra.lineas.length > 0 && (
        <div className="card" style={{ padding: 12, display: 'grid', gap: 10 }}>
          <strong>Compra de la tanda · ≈ {tanda.compra.costeEstimado.toFixed(2)} €</strong>
          {porCategoria.map(([cat, lineas]) => (
            <div key={cat}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>{cat}</div>
              {lineas.map(l => (
                <label key={l.alimento_id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 14 }}>
                  <input type="checkbox" checked={tengo.includes(l.alimento_id)} onChange={() => alternarTengo(l.alimento_id)} aria-label={`Ya tengo ${l.alimento_nombre}`} />
                  <span style={{ textDecoration: tengo.includes(l.alimento_id) ? 'line-through' : 'none' }}>
                    {l.alimento_nombre} · {l.gramos} g
                    <span style={{ color: 'var(--text-muted)' }}> ({l.recetas.join(', ')})</span>
                    {l.coste_estimado !== null && <span style={{ color: 'var(--text-muted)' }}> · ≈ {l.coste_estimado.toFixed(2)} €</span>}
                  </span>
                </label>
              ))}
            </div>
          ))}
          <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Marca lo que ya tienes en casa. El coste usa el precio más barato de cada ingrediente.</p>
        </div>
      )}
    </div>
  )
}

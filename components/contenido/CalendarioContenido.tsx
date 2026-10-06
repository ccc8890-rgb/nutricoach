'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatoFecha, hoyMadrid, lunesDe, sumarDias } from '@/lib/contenido/fechas'
import { api } from './api'
import type { Pieza } from './tipos'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MAX_SEMANAS = 8

type ComidaDia = { id: string; nombre: string; receta: { id: string; nombre: string } | null }
type DiaDieta = { dia: string; comidas: ComidaDia[] }
type ClienteLista = { id: string; nombre: string }

const SEMANA_MS = 7 * 86_400_000

export default function CalendarioContenido({ onAbrirDia }: { onAbrirDia: (fecha: string) => void }) {
  const { addToast } = useToast()
  const hoy = hoyMadrid()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [piezas, setPiezas] = useState<Pieza[]>([])
  const [clientes, setClientes] = useState<ClienteLista[]>([])
  const [clienteId, setClienteId] = useState('')
  const [dieta, setDieta] = useState<DiaDieta[] | null>(null)

  // 0 = semana en curso, 1 = la próxima…, negativo = pasada
  const offset = Math.round((Date.parse(lunes) - Date.parse(lunesDe(hoy))) / SEMANA_MS)

  const cargar = useCallback(async () => {
    const r = await api<{ piezas: Pieza[] }>('/api/contenido/piezas')
    if (r.ok) setPiezas(r.data.piezas)
    else addToast({ type: 'error', title: 'No se pudo cargar el calendario', message: r.error })
  }, [addToast])
  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    api<{ clientes?: ClienteLista[] } | ClienteLista[]>('/api/clientes').then(r => {
      if (!r.ok) return
      const lista = Array.isArray(r.data) ? r.data : r.data.clientes ?? []
      setClientes(lista)
      setClienteId(prev => prev || (lista.find(c => /casanova/i.test(c.nombre)) ?? lista[0])?.id || '')
    })
  }, [])

  useEffect(() => {
    let activo = true
    async function cargarDieta() {
      if (!clienteId || offset < 0 || offset > MAX_SEMANAS) { setDieta(null); return }
      if (offset === 0) {
        const r = await api<{ dias?: DiaDieta[] }>(`/api/clientes/${clienteId}/semana-dieta`)
        if (activo) setDieta(r.ok ? r.data.dias ?? null : null)
      } else {
        const r = await api<{ semanas?: { semana: number; dias: DiaDieta[] }[] }>(`/api/clientes/${clienteId}/semana-dieta/futuras?semanas=${offset}`)
        if (activo) setDieta(r.ok ? r.data.semanas?.find(s => s.semana === offset)?.dias ?? null : null)
      }
    }
    cargarDieta()
    return () => { activo = false }
  }, [clienteId, offset])

  // Recetas marcadas "para grabar": se señalan en la dieta para ver qué días ya las vas a comer.
  const paraGrabar = useMemo(() => new Set(piezas.filter(p => p.estado === 'para_grabar' && p.receta_id).map(p => p.receta_id as string)), [piezas])

  const dias = DIAS.map((nombre, i) => ({ nombre, fecha: sumarDias(lunes, i), comidas: dieta?.find(d => d.dia === NOMBRES_DIA[i])?.comidas ?? [] }))

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setLunes(sumarDias(lunes, -7))} aria-label="Semana anterior"><ChevronLeft size={16} /></button>
        <strong>Semana del {formatoFecha(lunes)}</strong>
        <button className="btn btn-secondary btn-sm" onClick={() => setLunes(sumarDias(lunes, 7))} aria-label="Semana siguiente"><ChevronRight size={16} /></button>
        <button className="btn btn-ghost btn-sm" onClick={() => setLunes(lunesDe(hoy))}>Hoy</button>
        <label style={{ marginLeft: 'auto' }}>Dieta de{' '}
          <select className="input" value={clienteId} onChange={e => setClienteId(e.target.value)}>
            <option value="">(sin dieta)</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>
      {clienteId && !dieta && <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No hay dieta para esta semana (solo se muestra la semana en curso y hasta 8 semanas planificadas).</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {dias.map(d => {
          const grabar = piezas.filter(p => p.fecha_grabacion === d.fecha)
          const publicar = piezas.filter(p => p.fecha_publicacion === d.fecha)
          return (
            <div key={d.fecha} className="card" style={{ padding: 8, minHeight: 130, outline: d.fecha === hoy ? '1px solid var(--accent)' : 'none', display: 'grid', alignContent: 'start', gap: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.nombre} {formatoFecha(d.fecha).slice(0, 5)}</div>
              {grabar.length > 0 && (
                <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onAbrirDia(d.fecha)}>🎬 Grabar ({grabar.length})</button>
              )}
              {grabar.map(p => <div key={`g${p.id}`} style={{ fontSize: 12 }}>{p.titulo}</div>)}
              {publicar.map(p => <div key={`p${p.id}`} style={{ fontSize: 12, color: 'var(--success)' }}>📤 {p.titulo}</div>)}
              {d.comidas.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 4, display: 'grid', gap: 2 }}>
                  {d.comidas.map(c => (
                    <div key={c.id} style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{c.nombre}:</span> {c.receta?.nombre ?? '—'}{c.receta && paraGrabar.has(c.receta.id) ? ' 🎬' : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

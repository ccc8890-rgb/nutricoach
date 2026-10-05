'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, Pill } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { ContextoSuplementos, Recomendacion } from '@/lib/nutricion/suplementos'

type Ambito = 'sesion' | 'diaria' | 'carrera'
type Estado = 'propuesta' | 'aprobada' | 'descartada'
type Propuesta = Omit<Recomendacion, 'estado'> & { estado: Estado; notas: string | null }
type Datos = Record<Ambito, Propuesta[]> & { avisos: string[]; ctx: ContextoSuplementos }

const BLOQUES: { ambito: Ambito; titulo: string }[] = [
  { ambito: 'sesion', titulo: 'Entreno de hoy' },
  { ambito: 'diaria', titulo: 'Día a día' },
  { ambito: 'carrera', titulo: 'Día de carrera' },
]
const EVIDENCIA = { A: 'A fuerte', B: 'B moderada', C: 'C limitada' }
const ESTADOS = { propuesta: 'Propuesta', aprobada: 'Aprobada', descartada: 'Descartada' }
const COLORES = { propuesta: 'var(--warning)', aprobada: 'var(--success)', descartada: 'var(--text-muted)' }
const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }

export default function SuplementacionPanel({ clienteId }: { clienteId: string }) {
  const { addToast } = useToast()
  const [datos, setDatos] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)
  const [pendiente, setPendiente] = useState<string | null>(null)
  const mutacion = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true)
    setError(false)
    setDatos(null)
    setPendiente(null)
    async function cargar() {
      try {
        const res = await fetch(`/api/clientes/${clienteId}/suplementacion`, { signal: controller.signal, cache: 'no-store' })
        if (!res.ok) throw new Error('No se pudo cargar la suplementación')
        const resultado: Datos = await res.json()
        if (!controller.signal.aborted) setDatos(resultado)
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setCargando(false)
      }
    }
    void cargar()
    return () => {
      controller.abort()
      mutacion.current?.abort()
      mutacion.current = null
    }
  }, [clienteId, intento])

  function editar(ambito: Ambito, id: string, campo: 'dosis' | 'timing' | 'notas', valor: string) {
    setDatos(prev => prev ? { ...prev, [ambito]: prev[ambito].map(r => r.id === id ? { ...r, [campo]: valor } : r) } : prev)
  }

  async function decidir(ambito: Ambito, propuesta: Propuesta, estado: Estado) {
    if (mutacion.current) return
    const controller = new AbortController()
    mutacion.current = controller
    setPendiente(`${ambito}:${propuesta.id}`)
    setDatos(prev => prev ? { ...prev, [ambito]: prev[ambito].map(r => r.id === propuesta.id ? { ...r, estado } : r) } : prev)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/suplementacion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ suplemento_id: propuesta.id, ambito, estado, dosis: propuesta.dosis, timing: propuesta.timing, notas: propuesta.notas ?? '' }),
      })
      if (!res.ok) throw new Error('No se pudo guardar la decisión')
      const guardada: { estado: Estado; dosis: string | null; timing: string | null; notas: string | null } = await res.json()
      if (!controller.signal.aborted) {
        setDatos(prev => prev ? { ...prev, [ambito]: prev[ambito].map(r => r.id === propuesta.id ? {
          ...r, estado: guardada.estado, dosis: guardada.dosis ?? propuesta.dosis, timing: guardada.timing ?? propuesta.timing, notas: guardada.notas,
        } : r) } : prev)
      }
    } catch {
      if (!controller.signal.aborted) {
        setDatos(prev => prev ? { ...prev, [ambito]: prev[ambito].map(r => r.id === propuesta.id ? propuesta : r) } : prev)
        addToast({ type: 'error', title: 'No se pudo guardar la suplementación', message: 'Se ha restaurado el estado anterior. Vuelve a intentarlo.' })
      }
    } finally {
      if (!controller.signal.aborted) {
        mutacion.current = null
        setPendiente(null)
      }
    }
  }

  if (cargando) return (
    <section className="card p-4 sm:p-5 animate-pulse space-y-3" aria-busy="true" aria-label="Cargando suplementación">
      <div className="h-5 w-1/3 rounded" style={{ background: 'var(--border)' }} />
      {BLOQUES.map(({ ambito }) => <div key={ambito} className="h-24 rounded-xl" style={{ background: 'var(--border)' }} />)}
    </section>
  )

  if (error || !datos) return (
    <section className="card p-4 sm:p-5 space-y-3">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Suplementación</h2>
      <p className="text-sm" role="alert" style={{ color: 'var(--text-secondary)' }}>No se pudieron cargar las propuestas de suplementación.</p>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setIntento(i => i + 1)}>Reintentar</button>
    </section>
  )

  return (
    <section className="card overflow-hidden">
      <header className="p-4 sm:p-5 space-y-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}><Pill size={16} style={{ color: 'var(--primary)' }} /> Suplementación</h2>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Contexto: {datos.ctx.peso_kg.toLocaleString('es-ES')} kg
          {datos.ctx.disciplina && ` · Disciplina: ${datos.ctx.disciplina.replaceAll('_', ' ')}`}
          {datos.ctx.fase_competicion && ` · Fase: ${datos.ctx.fase_competicion.replaceAll('_', ' ')}`}
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Propuestas basadas en evidencia (IOC 2018, ISSN, ACSM). Nada llega al cliente hasta que lo apruebes.</p>
      </header>

      <div className="p-4 sm:p-5 space-y-5">
        {datos.avisos.length > 0 && (
          <div className="rounded-xl p-3 flex gap-2" style={{ background: 'var(--bg)', border: '1px solid var(--warning)' }} role="note">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--warning)' }} />
            <ul className="space-y-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {datos.avisos.map((aviso, i) => <li key={i}>{aviso}</li>)}
            </ul>
          </div>
        )}

        {BLOQUES.map(({ ambito, titulo }) => (
          <section key={ambito} className="space-y-2" aria-label={titulo}>
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{titulo}</h3>
            {datos[ambito].length === 0 ? (
              <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>Sin propuestas para el contexto actual</p>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {datos[ambito].map(propuesta => {
                  const guardando = pendiente === `${ambito}:${propuesta.id}`
                  return (
                    <article key={propuesta.id} className="rounded-xl p-3 sm:p-4 space-y-3 min-w-0" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }} aria-busy={guardando}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1.5">
                          <h4 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{propuesta.nombre}</h4>
                          <span className="inline-block text-[11px] rounded-full px-2 py-0.5" style={{ background: 'var(--surface)', color: 'var(--primary)', border: '1px solid var(--border)' }}>Evidencia {EVIDENCIA[propuesta.evidencia]}</span>
                        </div>
                        <span className="text-[11px] rounded-full px-2 py-0.5 shrink-0" style={{ color: COLORES[propuesta.estado], border: `1px solid ${COLORES[propuesta.estado]}` }} aria-live="polite">{ESTADOS[propuesta.estado]}</span>
                      </div>

                      <div className="space-y-2">
                        {(['dosis', 'timing', 'notas'] as const).map(campo => (
                          <label key={campo} className="block text-xs" style={{ color: 'var(--text-secondary)' }}>
                            {campo === 'dosis' ? 'Dosis' : campo === 'timing' ? 'Cuándo tomarlo' : 'Nota opcional'}
                            <input
                              type="text"
                              value={propuesta[campo] ?? ''}
                              maxLength={300}
                              disabled={pendiente !== null}
                              onChange={e => editar(ambito, propuesta.id, campo, e.target.value)}
                              className="block w-full min-w-0 rounded-lg px-2.5 py-2 mt-1 text-xs disabled:opacity-60"
                              style={inputStyle}
                            />
                          </label>
                        ))}
                      </div>

                      <details className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <summary className="cursor-pointer py-1 font-medium">Precauciones y fuentes</summary>
                        <div className="pt-2 space-y-2 break-words">
                          <p className="font-semibold">Precauciones</p>
                          {propuesta.precauciones.length > 0 ? <ul className="list-disc pl-4 space-y-1">{propuesta.precauciones.map((texto, i) => <li key={i}>{texto}</li>)}</ul> : <p>Sin precauciones adicionales.</p>}
                          <p className="font-semibold">Fuentes</p>
                          <ul className="list-disc pl-4 space-y-1">{propuesta.fuentes.map((fuente, i) => <li key={i}>{fuente}</li>)}</ul>
                        </div>
                      </details>

                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="btn-secondary btn-sm disabled:opacity-50" disabled={pendiente !== null} onClick={() => void decidir(ambito, propuesta, 'aprobada')} style={{ color: 'var(--success)' }}>Aprobar</button>
                        <button type="button" className="btn-secondary btn-sm disabled:opacity-50" disabled={pendiente !== null || propuesta.estado === 'descartada'} onClick={() => void decidir(ambito, propuesta, 'descartada')}>Descartar</button>
                        <button type="button" className="btn-secondary btn-sm disabled:opacity-50" disabled={pendiente !== null || propuesta.estado === 'propuesta'} onClick={() => void decidir(ambito, propuesta, 'propuesta')}>Deshacer</button>
                        {guardando && <Loader2 size={15} className="animate-spin" aria-label="Guardando" style={{ color: 'var(--text-muted)' }} />}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}

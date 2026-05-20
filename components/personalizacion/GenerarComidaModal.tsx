'use client'

import { useState } from 'react'
import { X, Sparkles, RefreshCw, Check, ThumbsUp, ThumbsDown } from 'lucide-react'

interface MacrosObjetivo {
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
}

interface ComidaGenerada {
  nombre: string
  ingredientes: { nombre: string; gramos: number }[]
  instrucciones: string
  tiempo_min: number
  macros_estimados: MacrosObjetivo
  tip: string | null
}

interface Props {
  clienteId: string
  tipoComida: string
  macrosObjetivo: MacrosObjetivo
  onAceptar: (comida: ComidaGenerada) => void
  onCerrar: () => void
}

export default function GenerarComidaModal({
  clienteId,
  tipoComida,
  macrosObjetivo,
  onAceptar,
  onCerrar,
}: Props) {
  const [comida, setComida] = useState<ComidaGenerada | null>(null)
  const [generando, setGenerando] = useState(false)
  const [aceptando, setAceptando] = useState(false)
  const [error, setError] = useState('')
  const [fase, setFase] = useState<'inicio' | 'resultado' | 'feedback'>('inicio')
  const [razonRechazo, setRazonRechazo] = useState('')

  const generar = async () => {
    setGenerando(true)
    setError('')
    try {
      const res = await fetch('/api/personalizacion/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          tipo_comida: tipoComida,
          macros_objetivo: macrosObjetivo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComida(data.comida)
      setFase('resultado')
    } catch {
      setError('No se pudo generar la comida. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const enviarFeedback = async (accion: 'aceptada' | 'rechazada', razon?: string) => {
    if (!comida) return
    await fetch('/api/personalizacion/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        accion,
        razon: razon ?? null,
        tipo_comida: tipoComida,
        comida_nombre: comida.nombre,
        comida_ingredientes: comida.ingredientes,
        macros_objetivo: macrosObjetivo,
      }),
    }).catch(e => console.error('[GenerarComidaModal] Error enviando feedback:', e))
  }

  const aceptar = async () => {
    if (!comida) return
    setAceptando(true)
    await enviarFeedback('aceptada')
    onAceptar(comida)
    setAceptando(false)
  }

  const rechazar = async () => {
    await enviarFeedback('rechazada', razonRechazo)
    setRazonRechazo('')
    setComida(null)
    setFase('inicio')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[var(--primary)]" />
            <h2 className="font-semibold text-[var(--text)]">Generar {tipoComida}</h2>
          </div>
          <button onClick={onCerrar} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {/* Macros objetivo */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: 'Kcal', value: macrosObjetivo.kcal, unit: '' },
              { label: 'Prot', value: macrosObjetivo.proteinas, unit: 'g' },
              { label: 'CH', value: macrosObjetivo.carbohidratos, unit: 'g' },
              { label: 'Grasa', value: macrosObjetivo.grasas, unit: 'g' },
            ].map(m => (
              <div key={m.label} className="text-center p-2 rounded-lg bg-[var(--bg)]">
                <div className="text-xs text-[var(--text-muted)]">{m.label}</div>
                <div className="font-semibold text-sm text-[var(--text)]">{m.value}{m.unit}</div>
              </div>
            ))}
          </div>

          {/* Fase inicio */}
          {fase === 'inicio' && (
            <div className="text-center py-4">
              <p className="text-sm text-[var(--text-muted)] mb-4">
                La IA generará una comida adaptada a los gustos y hábitos del cliente, cuadrando con sus macros objetivos.
              </p>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={generar}
                disabled={generando}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {generando ? (
                  <><RefreshCw size={16} className="animate-spin" /> Generando...</>
                ) : (
                  <><Sparkles size={16} /> Generar comida</>
                )}
              </button>
            </div>
          )}

          {/* Fase resultado */}
          {fase === 'resultado' && comida && (
            <div>
              {/* Nombre y tiempo */}
              <div className="mb-3">
                <h3 className="font-semibold text-lg text-[var(--text)]">{comida.nombre}</h3>
                <div className="text-xs text-[var(--text-muted)]">{comida.tiempo_min} min · generado por IA</div>
              </div>

              {/* Macros estimados */}
              <div className="grid grid-cols-4 gap-1.5 mb-4">
                {[
                  { label: 'Kcal', value: comida.macros_estimados.kcal, color: 'text-orange-500' },
                  { label: 'P', value: comida.macros_estimados.proteinas, color: 'text-blue-500' },
                  { label: 'CH', value: comida.macros_estimados.carbohidratos, color: 'text-amber-500' },
                  { label: 'G', value: comida.macros_estimados.grasas, color: 'text-emerald-500' },
                ].map(m => (
                  <div key={m.label} className="text-center p-1.5 rounded-lg bg-[var(--bg)]">
                    <div className={`font-semibold text-sm ${m.color}`}>{m.value}</div>
                    <div className="text-xs text-[var(--text-muted)]">{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Ingredientes */}
              <div className="mb-3">
                <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">Ingredientes</div>
                <div className="space-y-1">
                  {comida.ingredientes.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[var(--text)]">{ing.nombre}</span>
                      <span className="text-[var(--text-muted)]">{ing.gramos}g</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instrucciones */}
              <div className="mb-3 p-3 rounded-xl bg-[var(--bg)]">
                <div className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">Preparación</div>
                <p className="text-sm text-[var(--text)] whitespace-pre-line leading-relaxed">{comida.instrucciones}</p>
              </div>

              {/* Tip */}
              {comida.tip && (
                <div className="mb-4 p-2.5 rounded-lg bg-[var(--primary)]/10 text-sm text-[var(--primary)]">
                  💡 {comida.tip}
                </div>
              )}

              {/* Feedback fase: razón de rechazo inline */}
              {fase === 'resultado' && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={razonRechazo}
                    onChange={e => setRazonRechazo(e.target.value)}
                    placeholder="¿Por qué no te gusta? (opcional)"
                    className="input w-full text-sm"
                  />
                </div>
              )}

              {/* Acciones */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={rechazar}
                  className="flex-1 btn-secondary flex items-center justify-center gap-1.5"
                >
                  <ThumbsDown size={15} /> Otra
                </button>
                <button
                  type="button"
                  onClick={aceptar}
                  disabled={aceptando}
                  className="flex-1 btn-primary flex items-center justify-center gap-1.5"
                >
                  {aceptando ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <><ThumbsUp size={15} /> Usar esta</>
                  )}
                </button>
              </div>

              {/* Regenerar */}
              <button
                type="button"
                onClick={generar}
                disabled={generando}
                className="w-full mt-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center gap-1 py-2"
              >
                <RefreshCw size={13} className={generando ? 'animate-spin' : ''} />
                {generando ? 'Generando...' : 'Generar otra opción'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { X, RefreshCw, ArrowLeftRight } from 'lucide-react'

interface Alimento {
  id: string
  nombre: string
  kcal: number
  proteinas: number
  carbohidratos: number
  grasas: number
  categoria: string | null
}

interface Props {
  alimentoId: string
  alimentoNombre: string
  gramosOriginal: number
  kcalPor100g: number
  protPor100g: number
  clienteId: string
  onElegir: (alternativa: Alimento, gramosAlternativa: number) => void
  onCerrar: () => void
}

export default function AlternativasModal({
  alimentoId,
  alimentoNombre,
  gramosOriginal,
  kcalPor100g,
  protPor100g,
  clienteId,
  onElegir,
  onCerrar,
}: Props) {
  const [alternativas, setAlternativas] = useState<Alimento[]>([])
  const [original, setOriginal] = useState<Alimento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => {
    const kcalPorcion = (kcalPor100g * gramosOriginal) / 100
    const protPorcion = (protPor100g * gramosOriginal) / 100

    fetch(`/api/intercambios?alimento_id=${alimentoId}&kcal=${kcalPorcion}&proteinas=${protPorcion}`)
      .then(r => r.json())
      .then(data => {
        setOriginal(data.original)
        setAlternativas(data.alternativas ?? [])
        setCargando(false)
      })
      .catch(() => setCargando(false))
  }, [alimentoId, kcalPor100g, protPor100g, gramosOriginal])

  const elegir = async (alternativa: Alimento) => {
    setGuardando(alternativa.id)

    // Calcular gramos equivalentes para mantener las kcal
    const gramosAlternativa = alternativa.kcal > 0
      ? Math.round((kcalPor100g * gramosOriginal) / alternativa.kcal)
      : gramosOriginal

    await fetch('/api/intercambios/elegir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente_id: clienteId,
        alimento_original_id: alimentoId,
        alternativa_elegida_id: alternativa.id,
        gramos_original: gramosOriginal,
        gramos_alternativa: gramosAlternativa,
      }),
    }).catch(() => {})

    onElegir(alternativa, gramosAlternativa)
    setGuardando(null)
  }

  const macrosPorcion = (alimento: Alimento, gramos: number) => ({
    kcal: Math.round((alimento.kcal * gramos) / 100),
    prot: Math.round((alimento.proteinas * gramos) / 100),
    carbs: Math.round((alimento.carbohidratos * gramos) / 100),
    grasas: Math.round((alimento.grasas * gramos) / 100),
  })

  const gramosEquiv = (alt: Alimento) =>
    alt.kcal > 0 ? Math.round((kcalPor100g * gramosOriginal) / alt.kcal) : gramosOriginal

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-xl border border-[var(--border)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-[var(--primary)]" />
            <h2 className="font-semibold text-[var(--text)]">Alternativas a</h2>
          </div>
          <button onClick={onCerrar} className="text-[var(--text-muted)] hover:text-[var(--text)]">
            <X size={20} />
          </button>
        </div>

        <div className="p-4">
          {/* Alimento original */}
          {original && (
            <div className="mb-4 p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Sustituyes</div>
              <div className="font-medium text-[var(--text)]">{alimentoNombre}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">
                {gramosOriginal}g · {macrosPorcion(original, gramosOriginal).kcal} kcal · {macrosPorcion(original, gramosOriginal).prot}g P
              </div>
            </div>
          )}

          {cargando ? (
            <div className="flex items-center justify-center py-8 gap-2 text-[var(--text-muted)]">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Buscando alternativas...</span>
            </div>
          ) : alternativas.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] text-sm">
              No se encontraron alternativas similares en la base de datos.
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wide">
                Alternativas equivalentes
              </div>
              {alternativas.map(alt => {
                const gramos = gramosEquiv(alt)
                const macros = macrosPorcion(alt, gramos)
                return (
                  <button
                    key={alt.id}
                    type="button"
                    onClick={() => elegir(alt)}
                    disabled={!!guardando}
                    className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--primary)]/5 transition-all text-left disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[var(--text)] truncate">{alt.nombre}</div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {gramos}g · {macros.kcal} kcal · {macros.prot}g P · {macros.carbs}g C · {macros.grasas}g G
                      </div>
                      {alt.categoria && (
                        <div className="text-xs text-[var(--primary)] mt-0.5">{alt.categoria}</div>
                      )}
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      {guardando === alt.id ? (
                        <RefreshCw size={16} className="animate-spin text-[var(--primary)]" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 flex items-center justify-center">
                          <ArrowLeftRight size={14} className="text-[var(--primary)]" />
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

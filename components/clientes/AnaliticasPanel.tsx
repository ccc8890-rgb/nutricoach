'use client'

import { FormEvent, useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { MARCADORES_ANALITICA, type GrupoAnalitica } from '@/lib/analiticas-marcadores'

type DatosAnalitica = { valores: Record<string, number>; notas: string; fecha?: string }
const GRUPOS: { key: GrupoAnalitica; titulo: string }[] = [
  { key: 'salud', titulo: 'Salud general' },
  { key: 'rendimiento', titulo: 'Rendimiento' },
  { key: 'hormonal', titulo: 'Hormonal' },
]
const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }

export default function AnaliticasPanel({ clienteId }: { clienteId: string }) {
  const { addToast } = useToast()
  const [valores, setValores] = useState<Record<string, string>>({})
  const [originales, setOriginales] = useState<Record<string, number>>({})
  const [notas, setNotas] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setCargando(true)
    setError(false)
    async function cargar() {
      try {
        const res = await fetch(`/api/clientes/${clienteId}/analiticas`, { signal: controller.signal, cache: 'no-store' })
        if (!res.ok) throw new Error()
        const datos: DatosAnalitica = await res.json()
        if (!controller.signal.aborted) {
          setOriginales(datos.valores)
          setValores(Object.fromEntries(Object.entries(datos.valores).map(([clave, valor]) => [clave, String(valor)])))
          setNotas(datos.notas ?? '')
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setCargando(false)
      }
    }
    void cargar()
    return () => controller.abort()
  }, [clienteId, intento])

  async function guardar(event: FormEvent) {
    event.preventDefault()
    const cambios: Record<string, number | null> = {}
    for (const marcador of MARCADORES_ANALITICA) {
      const texto = valores[marcador.key]?.trim() ?? ''
      if (!texto) {
        if (originales[marcador.key] !== undefined) cambios[marcador.key] = null
        continue
      }
      const numero = Number(texto.replace(',', '.'))
      if (!Number.isFinite(numero) || numero <= 0 || numero >= 100000) {
        addToast({ type: 'error', title: 'Revisa los valores', message: `${marcador.label} debe ser un número mayor que 0 y menor que 100.000.` })
        return
      }
      cambios[marcador.key] = numero
    }
    setGuardando(true)
    try {
      const res = await fetch(`/api/clientes/${clienteId}/analiticas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ valores: cambios, notas }),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error)
      setOriginales(datos.valores)
      setValores(Object.fromEntries(Object.entries(datos.valores as Record<string, number>).map(([clave, valor]) => [clave, String(valor)])))
      addToast({ type: 'success', title: 'Analíticas guardadas', message: 'La suplementación ya puede usar vitamina D y ferritina.' })
    } catch (err) {
      addToast({ type: 'error', title: 'No se pudieron guardar las analíticas', message: err instanceof Error ? err.message : 'Vuelve a intentarlo.' })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <div className="h-40 animate-pulse rounded-xl" style={{ background: 'var(--bg)' }} aria-label="Cargando analíticas" />
  if (error) return <div className="space-y-3"><p className="text-sm" role="alert" style={{ color: 'var(--text-secondary)' }}>No se pudieron cargar las analíticas.</p><button type="button" className="btn-secondary btn-sm" onClick={() => setIntento(i => i + 1)}>Reintentar</button></div>

  return (
    <form onSubmit={guardar} className="space-y-5">
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>Introduce solo los resultados disponibles. La unidad y el rango se muestran como referencia del laboratorio.</p>
      {GRUPOS.map(grupo => (
        <fieldset key={grupo.key} className="space-y-2">
          <legend className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{grupo.titulo}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {MARCADORES_ANALITICA.filter(marcador => marcador.grupo === grupo.key).map(marcador => {
              const numero = Number((valores[marcador.key] ?? '').replace(',', '.'))
              const alerta = (marcador.key === 'vitamina_d' || marcador.key === 'ferritina') && Number.isFinite(numero) && numero > 0 && numero < 30
              return (
                <label key={marcador.key} className="rounded-xl p-3 block" style={{ background: 'var(--bg)', border: `1px solid ${alerta ? 'var(--warning)' : 'var(--border)'}` }}>
                  <span className="flex justify-between gap-2 text-xs font-semibold" style={{ color: 'var(--text)' }}><span>{marcador.label}</span><span className="font-normal shrink-0" style={{ color: 'var(--text-muted)' }}>{marcador.unit}</span></span>
                  <span className="block text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>Referencia: {marcador.ref}</span>
                  <input type="number" inputMode="decimal" min="0" max="99999.999" step="any" value={valores[marcador.key] ?? ''} onChange={e => setValores(prev => ({ ...prev, [marcador.key]: e.target.value }))} className="w-full rounded-lg px-2.5 py-2 text-sm" style={inputStyle} aria-label={`${marcador.label} en ${marcador.unit}`} />
                  {alerta && <span className="flex gap-1.5 mt-2 text-[11px] leading-snug" style={{ color: 'var(--warning)' }}><AlertTriangle size={13} className="shrink-0" />Con este valor se propone {marcador.key === 'vitamina_d' ? 'vitamina D' : 'hierro'} en Suplementación</span>}
                </label>
              )
            })}
          </div>
        </fieldset>
      ))}
      <label className="block text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Notas
        <textarea value={notas} onChange={e => setNotas(e.target.value)} maxLength={1000} rows={3} className="block w-full rounded-xl px-3 py-2 mt-1 text-sm resize-y" style={inputStyle} placeholder="Fecha del análisis, contexto clínico u observaciones" />
        <span className="block mt-1 text-right text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{notas.length}/1000</span>
      </label>
      <button type="submit" className="btn-primary btn-sm disabled:opacity-60" disabled={guardando}>{guardando && <Loader2 size={14} className="animate-spin" />} Guardar</button>
    </form>
  )
}

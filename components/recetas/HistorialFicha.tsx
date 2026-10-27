'use client'

import { useState } from 'react'

type Evento = { tipo: string; actor: string; nota: string | null; veredicto: string | null; confianza: number | null; resumen: string | null; created_at: string }

const fecha = (v: string) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v))

function frase(e: Evento): string {
  switch (e.tipo) {
    case 'al_agente': return 'Carlos la pasó al agente'
    case 'devuelta': return `Carlos la devolvió al agente: «${e.nota ?? ''}»`
    case 'volver_a_nueva': return 'Carlos la devolvió a nuevas'
    case 'agente': return `Agente: ${e.veredicto ?? '—'}${e.confianza != null ? ` (${Math.round(e.confianza * 100)} %)` : ''}`
    case 'error': return `El agente no pudo revisarla${e.nota ? `: ${e.nota}` : ''}`
    case 'aprobada': return 'Carlos la aprobó'
    case 'descartada': return 'Carlos la descartó'
    default: return e.tipo
  }
}

/** Línea de tiempo corta de una ficha en el circuito de revisión (se carga al abrirla). */
export default function HistorialFicha({ recetaId }: { recetaId: string }) {
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [error, setError] = useState(false)

  async function alAbrir(abierto: boolean) {
    if (!abierto || eventos) return
    try {
      const res = await fetch(`/api/recetas/${recetaId}/historial`, { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setEventos((await res.json()).eventos ?? [])
    } catch { setError(true) }
  }

  return (
    <details className="mt-2 text-xs" onToggle={e => alAbrir((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer underline decoration-dotted underline-offset-4" style={{ color: 'var(--text-muted)' }}>Historial</summary>
      {error ? <p className="mt-1.5" style={{ color: 'var(--error)' }}>No se pudo cargar el historial.</p>
        : !eventos ? <p className="mt-1.5" style={{ color: 'var(--text-muted)' }}>Cargando…</p>
        : eventos.length === 0 ? <p className="mt-1.5" style={{ color: 'var(--text-muted)' }}>Sin movimientos todavía.</p>
        : <ol className="mt-1.5 space-y-1" style={{ color: 'var(--text-secondary)' }}>
          {eventos.map((e, i) => (
            <li key={i}><span className="mr-2 tabular-nums" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono, monospace)' }}>{fecha(e.created_at)}</span>{frase(e)}{e.tipo === 'agente' && e.resumen ? <span style={{ color: 'var(--text-muted)' }}> · {e.resumen}</span> : null}</li>
          ))}
        </ol>}
    </details>
  )
}

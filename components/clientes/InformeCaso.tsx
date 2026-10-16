'use client'

import { useState } from 'react'
import { Loader2, MessageSquareText } from 'lucide-react'
import type { InformeCaso as Informe } from '@/lib/informe-caso/construir'

// Estructura y contenido; el acabado visual lo pule Codex. Todo el texto sale de lib/informe-caso/construir.ts.
type Pestana = 'mensaje' | 'guion' | 'resumen' | 'pdf'
const PESTANAS: { id: Pestana; texto: string }[] = [
  { id: 'mensaje', texto: 'Mensaje' }, { id: 'guion', texto: 'Guion' }, { id: 'resumen', texto: 'Resumen' }, { id: 'pdf', texto: 'PDF' },
]

async function copiar(texto: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(texto); return true } catch { return false }
}

export function PanelInformeCaso({ informe, clienteId, pestanaInicial = 'mensaje' }: { informe: Informe; clienteId: string; pestanaInicial?: Pestana }) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial)
  const [copiado, setCopiado] = useState(false)
  const textoGuion = informe.guion.map(g => `${g.paso}: ${g.texto}`).join('\n')

  async function pulsarCopiar(texto: string) {
    setCopiado(await copiar(texto))
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="coach-case-report space-y-3 text-sm" style={{ color: 'var(--text)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{informe.situacion.titulo}{informe.plan ? ` · ${informe.plan}` : ''}</p>
      <div className="flex flex-wrap gap-1" role="tablist">
        {PESTANAS.map(p => (
          <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={pestana === p.id ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>{p.texto}</button>
        ))}
      </div>

      {pestana === 'mensaje' && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>{informe.mensaje}</p>
          <button className="btn-secondary btn-sm" onClick={() => pulsarCopiar(informe.mensaje)}>{copiado ? 'Copiado' : 'Copiar'}</button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Revísalo y cámbialo a tu estilo antes de enviarlo. No se envía nada solo.</p>
        </div>
      )}

      {pestana === 'guion' && (
        <div className="space-y-2">
          <ol className="space-y-2">{informe.guion.map((g, i) => <li key={i}><strong>{g.paso}.</strong> {g.texto}</li>)}</ol>
          <p className="text-xs font-semibold">Preguntas para hacerle</p>
          <ul className="list-disc pl-5 text-xs">{informe.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
          <button className="btn-secondary btn-sm" onClick={() => pulsarCopiar(textoGuion)}>{copiado ? 'Copiado' : 'Copiar'}</button>
        </div>
      )}

      {pestana === 'resumen' && (
        <div className="space-y-3">
          <section><p className="text-xs font-semibold">Dónde está</p>
            {informe.situacion.datos.length ? <ul className="list-disc pl-5 text-xs">{informe.situacion.datos.map((d, i) => <li key={i}>{d.etiqueta}: {d.valor}</li>)}</ul> : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos recientes del reloj.</p>}
          </section>
          <section><p className="text-xs font-semibold">Qué cambia</p><ul className="list-disc pl-5 text-xs">{informe.cambios.map((c, i) => <li key={i}>{c}</li>)}</ul></section>
          {informe.porQue.length > 0 && <section><p className="text-xs font-semibold">Por qué</p><ul className="list-disc pl-5 text-xs">{informe.porQue.map((p, i) => <li key={i}>{p.texto} <span style={{ color: 'var(--text-muted)' }}>({p.origen})</span></li>)}</ul></section>}
          {informe.preguntasCoach.length > 0 && <section><p className="text-xs font-semibold">Para decidir tú antes de hablar</p><ul className="list-disc pl-5 text-xs">{informe.preguntasCoach.map((q, i) => <li key={i}>{q}</li>)}</ul></section>}
          <section><p className="text-xs font-semibold">Lo que no sé</p>
            {informe.loQueNoSe.length ? <ul className="list-disc pl-5 text-xs">{informe.loQueNoSe.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nada relevante: hay datos para todo lo anterior.</p>}
          </section>
        </div>
      )}

      {pestana === 'pdf' && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Se abre una página lista para imprimir o guardar como PDF y enviarla.</p>
          <a className="btn-secondary btn-sm inline-block" href={`/api/clientes/${clienteId}/informe-caso?formato=html`} target="_blank" rel="noreferrer">Abrir página para PDF</a>
        </div>
      )}
    </div>
  )
}

export default function InformeCaso({ clienteId }: { clienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [informe, setInforme] = useState<Informe | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function alternar() {
    if (abierto) { setAbierto(false); return }
    setAbierto(true)
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/informe-caso`, { cache: 'no-store' })
      if (!r.ok) throw new Error()
      setInforme(await r.json())
    } catch { setError('No se pudo preparar el informe. Inténtalo de nuevo.') } finally { setCargando(false) }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button className="btn-secondary btn-sm" onClick={alternar} aria-expanded={abierto}>
        {cargando ? <Loader2 size={13} className="animate-spin" /> : <MessageSquareText size={13} />} Preparar conversación
      </button>
      {abierto && (
        <div className="w-full rounded-2xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          {error && <p className="text-xs" role="alert">{error}</p>}
          {informe && <PanelInformeCaso informe={informe} clienteId={clienteId} />}
        </div>
      )}
    </div>
  )
}

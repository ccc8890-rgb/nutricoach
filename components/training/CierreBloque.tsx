'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { VALORACIONES, type Valoracion } from '@/lib/entrenos/marcas'

interface Pregunta { clave: string; etiqueta: string; valoracion: Valoracion | null }
const fetchJson = (u: string) => fetch(u).then(r => (r.ok ? r.json() : { mostrar: false }))

/** Última semana del bloque: cuatro toques sobre cómo fueron las cargas. El siguiente plan parte de esto. Solo aparece si falta por responder. */
export default function CierreBloque() {
  const { data, mutate } = useSWR<{ mostrar: boolean; preguntas?: Pregunta[] }>('/api/cliente/cierre-bloque', fetchJson, { revalidateOnFocus: false })
  const [respuestas, setRespuestas] = useState<Record<string, Valoracion>>({})
  const [enviando, setEnviando] = useState(false)
  const [oculto, setOculto] = useState(false)
  if (!data?.mostrar || oculto) return null

  const pendientes = (data.preguntas ?? []).filter(p => !p.valoracion)
  const listo = pendientes.every(p => respuestas[p.clave])

  async function enviar() {
    setEnviando(true)
    try {
      const res = await fetch('/api/cliente/cierre-bloque', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ respuestas }) })
      if (res.ok) { await mutate(); setOculto(true) }
    } finally { setEnviando(false) }
  }

  return (
    <section className="training-sheet">
      <p className="font-mono text-[10px] font-semibold tracking-[0.14em]" style={{ color: 'var(--text-muted)' }}>CIERRE DE BLOQUE</p>
      <p className="mt-1 font-bold leading-tight" style={{ color: 'var(--text)' }}>¿Cómo fueron las cargas?</p>
      <p className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>Tu siguiente plan parte de esto. Un toque por fila.</p>
      <div className="mt-3 flex flex-col gap-2">
        {pendientes.map(p => (
          <div key={p.clave} className="flex items-center justify-between gap-3">
            <span className="text-sm" style={{ color: 'var(--text)' }}>{p.etiqueta}</span>
            <div className="flex gap-1.5" role="group" aria-label={p.etiqueta}>
              {VALORACIONES.map(v => {
                const activa = respuestas[p.clave] === v.valor
                return (
                  <button
                    key={v.valor}
                    type="button"
                    aria-pressed={activa}
                    onClick={() => setRespuestas(r => ({ ...r, [p.clave]: v.valor }))}
                    className="px-2.5 py-1 text-[12px] font-semibold rounded-lg cursor-pointer"
                    style={{
                      minHeight: '2rem',
                      background: activa ? 'var(--semantic-active)' : 'transparent',
                      color: activa ? 'var(--bg)' : 'var(--text-secondary)',
                      border: `1px solid ${activa ? 'var(--semantic-active)' : 'var(--editorial-rule)'}`,
                    }}
                  >{v.etiqueta}</button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }} onClick={() => setOculto(true)}>Ahora no</button>
        <button type="button" className="btn btn-primary rounded-xl cursor-pointer" disabled={!listo || enviando} onClick={enviar}>{enviando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </section>
  )
}

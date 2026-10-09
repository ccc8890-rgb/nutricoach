'use client'
import { useCallback, useEffect, useState } from 'react'

interface VistaPrevia { sesionNombre: string; actual: string[]; nuevo: string[]; distanciaActualKm: number | null; distanciaNuevaKm: number | null; valido: boolean; error?: string }
interface Decision { sesion: string; cambio: string; razon: string; evidencia: string; confianza: number; vistaPrevia?: VistaPrevia | null; aplicada?: { at: string } | null }
interface Payload {
  resumen?: string
  lecturas?: { titulo: string; detalle: string; dato: string }[]
  decisiones?: Decision[]
  alerta_prioritaria?: string | null
  preguntas_al_coach?: string[]
  alertas_automaticas?: { codigo: string; gravedad: string; texto: string }[]
}
interface Analisis { id: string; estado: string; payload: Payload; comentario_coach: string | null; created_at: string }

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: 'Pendiente de tu revisión', aprobado: 'Útil', aplicado: 'Útil', rechazado: 'No encajó', modificado: 'Útil con cambios', en_revision: 'En revisión',
}
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

export default function AnalisisIA({ clienteId }: { clienteId: string }) {
  const [lista, setLista] = useState<Analisis[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [aplicando, setAplicando] = useState<number | null>(null)

  const leer = useCallback(async () => {
    const r = await fetch(`/api/clientes/${clienteId}/rendimiento/analisis`, { cache: 'no-store' })
    if (r.ok) setLista((await r.json()).analisis)
    else setLista([])
  }, [clienteId])

  useEffect(() => { leer() }, [leer])

  async function generar() {
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/rendimiento/analisis`, { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo generar')
      await leer()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar') } finally { setCargando(false) }
  }

  async function decidir(a: Analisis, decision: 'aprobado' | 'rechazado') {
    setGuardando(true); setError(null)
    try {
      const r = await fetch('/api/agentes/tareas', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarea_id: a.id, decision, comentario_coach: nota.trim() || undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar')
      setNota(''); await leer()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setGuardando(false) }
  }

  async function aplicar(a: Analisis, indice: number, deshacer = false) {
    const d = a.payload.decisiones?.[indice]
    const texto = deshacer
      ? '¿Deshacer el cambio y volver a los pasos anteriores? Se reenviará al reloj.'
      : `¿Aplicar este cambio a «${d?.vistaPrevia?.sesionNombre ?? 'la sesión'}» y enviarlo al reloj?`
    if (!window.confirm(texto)) return
    setAplicando(indice); setError(null); setAviso(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/rendimiento/analisis/aplicar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tareaId: a.id, indice, deshacer }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo aplicar')
      setAviso(j.garmin?.enviado ? `${deshacer ? 'Cambio deshecho' : 'Cambio aplicado'} y enviado al reloj${j.garmin.fecha ? ` para el ${fecha(j.garmin.fecha + 'T12:00:00')}` : ''}.` : `${deshacer ? 'Cambio deshecho' : 'Cambio aplicado'} en el plan. ${j.garmin?.aviso ?? ''}`)
      await leer()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo aplicar') } finally { setAplicando(null) }
  }

  const ultimo = lista?.[0]
  const p = ultimo?.payload
  const pendiente = ultimo && ['pendiente', 'en_revision'].includes(ultimo.estado)

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-accent)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Entrenador IA</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Lee la carga, la evolución y el estado del atleta y propone qué cambiar. No toca el plan: decides tú, y lo que respondas lo aprende para el siguiente análisis.
          </p>
        </div>
        <button onClick={generar} disabled={cargando} className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
          style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
          {cargando ? 'Analizando…' : ultimo ? 'Nuevo análisis' : 'Generar análisis'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs" style={{ color: '#E0557A' }}>{error}</p>}
      {aviso && <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>{aviso}</p>}
      {lista === null && <div className="mt-3 h-16 animate-pulse rounded-lg" style={{ background: 'var(--bg-subtle)' }} />}
      {lista !== null && !ultimo && <p className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>Aún no hay ningún análisis para este atleta.</p>}

      {ultimo && p && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            <span>{fecha(ultimo.created_at)}</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              {ETIQUETA_ESTADO[ultimo.estado] ?? ultimo.estado}
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{p.resumen}</p>

          {p.alerta_prioritaria && (
            <p className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: 'rgba(224,85,122,0.1)', border: '1px solid rgba(224,85,122,0.3)', color: 'var(--text)' }}>
              <strong>Atención:</strong> {p.alerta_prioritaria}
            </p>
          )}

          {!!p.lecturas?.length && (
            <div className="grid gap-2 sm:grid-cols-2">
              {p.lecturas.map((l, i) => (
                <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{l.titulo}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{l.detalle}</p>
                  {l.dato && <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{l.dato}</p>}
                </div>
              ))}
            </div>
          )}

          {!!p.decisiones?.length && (
            <div>
              <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>Qué cambiar</p>
              <ul className="space-y-2">
                {p.decisiones.map((d, i) => (
                  <li key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                    <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{d.sesion}</p>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--text)' }}>{d.cambio}</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{d.razon}</p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.evidencia} · confianza {Math.round(d.confianza * 100)}%</p>
                    {d.vistaPrevia && (
                      <div className="mt-2 rounded-md p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                        <div className="grid gap-3 text-xs sm:grid-cols-2">
                          <div>
                            <p className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Ahora{d.vistaPrevia.distanciaActualKm ? ` · ${d.vistaPrevia.distanciaActualKm} km` : ''}</p>
                            {d.vistaPrevia.actual.map((l, k) => <p key={k} style={{ color: 'var(--text-secondary)' }}>{l}</p>)}
                          </div>
                          <div>
                            <p className="mb-1 font-medium" style={{ color: 'var(--text)' }}>Propuesto{d.vistaPrevia.distanciaNuevaKm ? ` · ${d.vistaPrevia.distanciaNuevaKm} km` : ''}</p>
                            {d.vistaPrevia.nuevo.map((l, k) => <p key={k} style={{ color: 'var(--text)' }}>{l}</p>)}
                          </div>
                        </div>
                        {!d.vistaPrevia.valido && <p className="mt-2 text-xs" style={{ color: '#E0557A' }}>No se puede aplicar: {d.vistaPrevia.error}</p>}
                        {d.vistaPrevia.valido && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {d.aplicada ? (
                              <>
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Aplicado el {fecha(d.aplicada.at)}</span>
                                <button disabled={aplicando === i} onClick={() => aplicar(ultimo, i, true)} className="rounded-md px-2.5 py-1 text-xs disabled:opacity-60" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>Deshacer</button>
                              </>
                            ) : (
                              <button disabled={aplicando === i} onClick={() => aplicar(ultimo, i)} className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-60" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
                                {aplicando === i ? 'Aplicando…' : 'Aplicar al plan y enviar al reloj'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!!p.preguntas_al_coach?.length && (
            <div>
              <p className="mb-1 text-xs font-semibold" style={{ color: 'var(--text)' }}>Preguntas para ti</p>
              <ul className="list-disc space-y-1 pl-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                {p.preguntas_al_coach.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}

          {pendiente ? (
            <div className="space-y-2 border-t pt-3" style={{ borderColor: 'var(--border-light)' }}>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={800}
                placeholder="Tu respuesta a las preguntas o por qué sí/no (la IA la tendrá en cuenta la próxima vez)"
                className="w-full rounded-lg p-2 text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <div className="flex gap-2">
                <button disabled={guardando} onClick={() => decidir(ultimo, 'aprobado')} className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>Me sirve</button>
                <button disabled={guardando} onClick={() => decidir(ultimo, 'rechazado')} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>No encaja</button>
              </div>
            </div>
          ) : ultimo.comentario_coach ? (
            <p className="border-t pt-3 text-xs" style={{ borderColor: 'var(--border-light)', color: 'var(--text-secondary)' }}>Tu nota: {ultimo.comentario_coach}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}

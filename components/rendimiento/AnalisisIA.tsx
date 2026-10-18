'use client'
import { useCallback, useEffect, useState } from 'react'
import { estadoAnalisis, etiquetaDecision, glosarSiglas, porQueResumen, titularDe, TEXTO_ESTADO, TEXTO_ETIQUETA } from '@/lib/rendimiento/presentacion'

interface VistaPrevia { sesionNombre: string; actual: string[]; nuevo: string[]; distanciaActualKm: number | null; distanciaNuevaKm: number | null; valido: boolean; error?: string }
interface EstudioRef { titulo: string; anio: string | null; doi: string | null; nivel: string }
interface Decision {
  sesion: string; cambio: string; razon: string; evidencia: string; confianza: number
  vistaPrevia?: VistaPrevia | null; aplicada?: { at: string } | null
  /** Análisis anteriores no traen estos campos. */
  origen?: 'regla' | 'ia'; riesgo?: 'bajo' | 'medio' | 'alto'; segura?: boolean
  fiabilidad?: { valor: number; nivel: 'alta' | 'media' | 'baja'; motivos: string[] }
  estudios?: EstudioRef[]; avisos?: string[]
}
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
const COLOR_ESTADO = { ok: '#6AAF85', mirar: '#C8A96A', revisar: '#E0557A' } as const
const COLOR_ETIQUETA = { seguro: '#6AAF85', mirar: '#C8A96A', revisar: '#E0557A' } as const
const NIVEL_EVIDENCIA: Record<string, string> = { meta_analisis: 'metaanálisis', revision_sistematica: 'revisión sistemática', rct: 'ensayo aleatorizado', estudio_observacional: 'estudio observacional', opinion_experto: 'consenso o revisión' }
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

  const decisiones = (p?.decisiones ?? []).map((d, i) => ({ d, i }))
  const conBoton = decisiones.filter(({ d }) => d.vistaPrevia)
  const aMano = decisiones.filter(({ d }) => !d.vistaPrevia)
  const sinAplicar = conBoton.filter(({ d }) => d.vistaPrevia?.valido && !d.aplicada).length

  function tarjeta({ d, i }: { d: Decision; i: number }) {
    const etiqueta = etiquetaDecision(d)
    const vp = d.vistaPrevia
    return (
      <li key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{d.sesion}</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ border: `1px solid ${COLOR_ETIQUETA[etiqueta]}`, color: COLOR_ETIQUETA[etiqueta] }}>{TEXTO_ETIQUETA[etiqueta]}</span>
          {d.aplicada && <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ border: '1px solid #6AAF85', color: '#6AAF85' }}>Aplicado el {fecha(d.aplicada.at)}</span>}
        </div>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{glosarSiglas(d.cambio)}</p>
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px]" style={{ color: 'var(--text-muted)' }}>Por qué{porQueResumen(d) ? ` · ${porQueResumen(d)}` : ''}</summary>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{glosarSiglas(d.razon)}</p>
          {d.fiabilidad ? (
            <div className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
              {d.estudios?.length ? (
                <ul className="space-y-0.5">
                  {d.estudios.map((e, k) => (
                    <li key={k}>
                      {e.doi ? <a href={`https://doi.org/${e.doi}`} target="_blank" rel="noreferrer" className="underline">«{e.titulo}»</a> : `«${e.titulo}»`}
                      {e.anio ? ` (${e.anio})` : ''} · {NIVEL_EVIDENCIA[e.nivel] ?? e.nivel}
                    </li>
                  ))}
                </ul>
              ) : <span>Sin estudios que lo respalden: criterio de entrenador.</span>}
              <p className="mt-0.5">Fiabilidad: {d.fiabilidad.motivos.join(' · ')}</p>
              {d.avisos?.map((av, k) => <p key={k} style={{ color: '#C8A96A' }}>{av}</p>)}
            </div>
          ) : (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{d.evidencia} · confianza {Math.round(d.confianza * 100)}%</p>
          )}
        </details>
        {vp && (
          <div className="mt-2 rounded-md p-2.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>Sesión «{vp.sesionNombre}»</p>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <div>
                <p className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>Ahora{vp.distanciaActualKm ? ` · ${vp.distanciaActualKm} km` : ''}</p>
                {vp.actual.map((l, k) => <p key={k} style={{ color: 'var(--text-secondary)' }}>{l}</p>)}
              </div>
              <div>
                <p className="mb-1 font-medium" style={{ color: 'var(--text)' }}>Quedaría así{vp.distanciaNuevaKm ? ` · ${vp.distanciaNuevaKm} km` : ''}</p>
                {vp.nuevo.map((l, k) => <p key={k} style={{ color: 'var(--text)' }}>{l}</p>)}
              </div>
            </div>
            {!vp.valido && <p className="mt-2 text-xs" style={{ color: '#E0557A' }}>No se puede aplicar: {vp.error}</p>}
            {vp.valido && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border-light)' }}>
                {d.aplicada ? (
                  <>
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ya está en el plan y en el reloj.</span>
                    <button disabled={aplicando === i} onClick={() => aplicar(ultimo!, i, true)} className="rounded-md px-2.5 py-1 text-xs disabled:opacity-60" style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      {aplicando === i ? 'Deshaciendo…' : 'Deshacer'}
                    </button>
                  </>
                ) : (
                  <>
                    <button disabled={aplicando === i} onClick={() => aplicar(ultimo!, i)} className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60" style={{ background: 'var(--text)', color: 'var(--bg)' }}>
                      {aplicando === i ? 'Aplicando…' : 'Aplicar al plan y enviar al reloj'}
                    </button>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Te pide confirmación y se puede deshacer.</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </li>
    )
  }

  let n = 0
  const paso = (titulo: string, ayuda: string | null, hijos: React.ReactNode) => {
    n += 1
    return (
      <div className="rounded-xl p-3" style={{ border: '1px solid var(--border-light)' }}>
        <div className="mb-2 flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--text)', color: 'var(--bg)' }}>{n}</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</p>
            {ayuda && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ayuda}</p>}
          </div>
        </div>
        {hijos}
      </div>
    )
  }

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border-accent)' }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Entrenador IA</h3>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            Lee la carga, la evolución y el estado del atleta y propone qué cambiar. Nada se toca solo: tú decides qué se aplica.
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
            <span>Análisis del {fecha(ultimo.created_at)}</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              {ETIQUETA_ESTADO[ultimo.estado] ?? ultimo.estado}
            </span>
            {pendiente && decisiones.length > 0 && (
              <span>{sinAplicar > 0 ? `${sinAplicar} cambio${sinAplicar > 1 ? 's' : ''} listo${sinAplicar > 1 ? 's' : ''} para aplicar` : 'Nada pendiente de aplicar con botón'}{aMano.length > 0 ? ` · ${aMano.length} para hacer a mano` : ''}</span>
            )}
          </div>

          {paso('Qué está pasando', 'Lo que ve la IA en los datos del atleta.', (
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2">
                <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ border: `1px solid ${COLOR_ESTADO[estadoAnalisis(p)]}`, color: COLOR_ESTADO[estadoAnalisis(p)] }}>{TEXTO_ESTADO[estadoAnalisis(p)]}</span>
                <p className="text-sm font-medium leading-relaxed" style={{ color: 'var(--text)' }}>{glosarSiglas(titularDe(p.resumen) || p.resumen || '')}</p>
              </div>
              {p.resumen && p.resumen.trim() !== titularDe(p.resumen) && (
                <details>
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>Ver el análisis completo</summary>
                  <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{glosarSiglas(p.resumen)}</p>
                </details>
              )}
              {p.alerta_prioritaria && (
                <p className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={{ background: 'rgba(224,85,122,0.1)', border: '1px solid rgba(224,85,122,0.3)', color: 'var(--text)' }}>
                  <strong>Atención:</strong> {p.alerta_prioritaria}
                </p>
              )}
              {!!p.lecturas?.length && (
                <details>
                  <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>Datos que lo explican ({p.lecturas.length})</summary>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {p.lecturas.map((l, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{l.titulo}</p>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{l.detalle}</p>
                        {l.dato && <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{l.dato}</p>}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ))}

          {decisiones.length > 0 && paso('Qué propone cambiar', 'Revisa cada propuesta; solo se aplica lo que tú pulses.', (
            <div className="space-y-3">
              {conBoton.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>Se aplican con un botón <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· cambian la sesión en el plan y la envían al reloj</span></p>
                  <ul className="space-y-2">{conBoton.map(tarjeta)}</ul>
                </div>
              )}
              {aMano.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--text)' }}>Para hacer tú en el plan <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· consejos o cambios de día que no se pueden aplicar con un botón</span></p>
                  <ul className="space-y-2">{aMano.map(tarjeta)}</ul>
                </div>
              )}
            </div>
          ))}

          {!!p.preguntas_al_coach?.length && paso('Preguntas para ti', 'Respóndelas en la nota del último paso: la IA las tendrá en cuenta.', (
            <ul className="list-disc space-y-1 pl-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              {p.preguntas_al_coach.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          ))}

          {pendiente ? paso('Valora el análisis', 'No cambia el plan: solo enseña a la IA qué te sirve. Hazlo cuando hayas aplicado lo que quieras.', (
            <div className="space-y-2">
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} maxLength={800}
                placeholder="Tu respuesta a las preguntas o por qué sí/no (opcional)"
                className="w-full rounded-lg p-2 text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <div className="flex gap-2">
                <button disabled={guardando} onClick={() => decidir(ultimo, 'aprobado')} className="rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>Me sirve</button>
                <button disabled={guardando} onClick={() => decidir(ultimo, 'rechazado')} className="rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>No encaja</button>
              </div>
            </div>
          )) : ultimo.comentario_coach ? (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tu nota: {ultimo.comentario_coach}</p>
          ) : null}
        </div>
      )}
    </section>
  )
}

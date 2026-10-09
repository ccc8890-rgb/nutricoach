'use client'
import { useMemo, useState } from 'react'

interface Clave { tipo: string; titulo: string; descripcion: string; lineas: string[]; distanciaKm: number }
interface Semana { n: number; lunes: string; fase: string; descarga: boolean; tssObjetivo: number; kmObjetivo: number; tiradaKm: number; claves: Clave[] }
interface Respuesta {
  plan: {
    semanas: Semana[]
    viabilidad: { nivel: 'realista' | 'ambicioso' | 'poco_realista'; vdotNecesario: number; vdotActual: number; brecha: number; semanasDisponibles: number; tiempoPrevistoHoy_s: number; texto: string }
    ritmoCarrera_s_km: number
    avisos: string[]
  }
  base: { vdot: number; cargaSemanalActual: number; kmSemanaActual: number; tiradaMaxKm: number }
}

const DISTANCIAS = [{ m: 5000, t: '5 km' }, { m: 10000, t: '10 km' }, { m: 21097, t: 'Media maratón' }, { m: 42195, t: 'Maratón' }]
const FASES: Record<string, string> = { base: 'Base', construccion: 'Construcción', especifica: 'Específica', taper: 'Puesta a punto', carrera: 'Carrera' }
const COLOR_FASE: Record<string, string> = { base: '#8A9AB8', construccion: '#5B8DEF', especifica: '#C8A96A', taper: '#6AAF85', carrera: '#E0557A' }
const COLOR_VIAB = { realista: '#6AAF85', ambicioso: '#C8A96A', poco_realista: '#E0557A' }
const TEXTO_VIAB = { realista: 'Realista', ambicioso: 'Ambicioso', poco_realista: 'Poco realista' }

const mmss = (s: number) => `${s >= 3600 ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor((s % 3600) / 60)).padStart(s >= 3600 ? 2 : 1, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`
const corto = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }

function parsearTiempo(txt: string): number | null {
  const p = txt.trim().split(':').map(Number)
  if (p.some(n => !Number.isFinite(n) || n < 0) || p.length < 2 || p.length > 3) return null
  const s = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
  return s > 0 ? s : null
}

/** Domingo a 10 semanas vista: un objetivo de ejemplo para probar el simulador. */
function fechaEjemplo(): string {
  const d = new Date(Date.now() + 70 * 86_400_000)
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7))
  return d.toISOString().slice(0, 10)
}

export default function PlanObjetivo({ clienteId }: { clienteId: string }) {
  const [distancia, setDistancia] = useState(10000)
  const [fecha, setFecha] = useState(fechaEjemplo)
  const [tiempo, setTiempo] = useState('44:00')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<Respuesta | null>(null)
  const [abierta, setAbierta] = useState<number | null>(null)

  async function calcular() {
    const s = parsearTiempo(tiempo)
    if (!s) { setError('Escribe el tiempo como mm:ss o h:mm:ss'); return }
    setCargando(true); setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/rendimiento/plan-objetivo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distancia_m: distancia, tiempo_s: s, fecha }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo calcular')
      setRes(j); setAbierta(0)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo calcular') } finally { setCargando(false) }
  }

  const maxTss = useMemo(() => Math.max(1, ...(res?.plan.semanas.map(s => s.tssObjetivo) ?? [1])), [res])
  const v = res?.plan.viabilidad

  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Plan hacia un objetivo (simulador)</h3>
      <p className="mb-3 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
        Prueba una carrera y mira si es realista, qué fases tendría y cuánta carga cada semana. Es solo una simulación: no guarda nada ni cambia el plan.
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Distancia
          <select value={distancia} onChange={e => setDistancia(Number(e.target.value))} className="mt-1 w-full rounded-lg p-2 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {DISTANCIAS.map(d => <option key={d.m} value={d.m}>{d.t}</option>)}
          </select>
        </label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Fecha de la carrera
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="mt-1 w-full rounded-lg p-2 text-sm" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </label>
        <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Tiempo objetivo
          <input value={tiempo} onChange={e => setTiempo(e.target.value)} placeholder="44:00" className="mt-1 w-full rounded-lg p-2 text-sm tabular-nums" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        </label>
        <div className="flex items-end">
          <button onClick={calcular} disabled={cargando} className="w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
            {cargando ? 'Calculando…' : 'Calcular plan'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs" style={{ color: '#E0557A' }}>{error}</p>}

      {res && v && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: `1px solid ${COLOR_VIAB[v.nivel]}` }}>
            <p className="text-sm font-semibold" style={{ color: COLOR_VIAB[v.nivel] }}>{TEXTO_VIAB[v.nivel]}</p>
            <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{v.texto}</p>
            <p className="mt-1 text-[11px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
              Ritmo de carrera {mmss(res.plan.ritmoCarrera_s_km)}/km · VDOT necesario {v.vdotNecesario} · VDOT actual {v.vdotActual} · parte de {res.base.cargaSemanalActual} TSS y {res.base.kmSemanaActual} km/semana
            </p>
          </div>
          {res.plan.avisos.map((a, i) => <p key={i} className="text-xs" style={{ color: '#C8A96A' }}>⚠ {a}</p>)}

          <ul className="space-y-1.5">
            {res.plan.semanas.map((s, i) => (
              <li key={s.n} className="rounded-lg" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                <button onClick={() => setAbierta(abierta === i ? null : i)} className="flex w-full items-center gap-3 p-2.5 text-left">
                  <span className="w-6 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>S{s.n}</span>
                  <span className="w-12 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{corto(s.lunes)}</span>
                  <span className="w-28 text-xs font-medium" style={{ color: COLOR_FASE[s.fase] }}>{FASES[s.fase]}{s.descarga ? ' · descarga' : ''}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--border-light)' }}>
                    <span className="block h-full rounded-full" style={{ width: `${(s.tssObjetivo / maxTss) * 100}%`, background: COLOR_FASE[s.fase] }} />
                  </span>
                  <span className="w-28 text-right text-xs tabular-nums" style={{ color: 'var(--text)' }}>{s.tssObjetivo} TSS · {s.kmObjetivo} km</span>
                </button>
                {abierta === i && (
                  <div className="space-y-2 border-t p-3" style={{ borderColor: 'var(--border-light)' }}>
                    {s.claves.map(c => (
                      <div key={c.tipo + c.titulo}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{c.titulo} <span className="font-normal tabular-nums" style={{ color: 'var(--text-muted)' }}>· {c.distanciaKm} km</span></p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.descripcion}</p>
                        <ul className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.lineas.map((l, k) => <li key={k}>{l}</li>)}</ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

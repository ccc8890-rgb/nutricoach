'use client'
import { useEffect, useMemo, useState } from 'react'
import Grafica, { type Fila } from './Grafica'
import AnalisisIA from './AnalisisIA'
import type { PanelRendimiento as Panel } from '@/lib/rendimiento/panel'
import type { UmbralesAtleta } from '@/lib/rendimiento/carga'
import type { ResumenEjecucion } from '@/lib/rendimiento/ejecucion'

type Respuesta = Panel & { umbrales: UmbralesAtleta; ejecucion: ResumenEjecucion; hoy: string }

const COLOR = { forma: '#5B8DEF', fatiga: '#E0557A', fresc: '#6AAF85', carga: '#8A9AB8', ambar: '#C8A96A' }
const ZONAS_FC = ['#7B818A', '#6AAF85', '#C8A96A', '#E08A4E', '#E0557A']
const RANGOS = [{ d: 42, t: '6 sem' }, { d: 90, t: '3 meses' }, { d: 180, t: '6 meses' }, { d: 365, t: '1 año' }]

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const fechaCorta = (f: string) => { const d = new Date(`${f}T12:00:00Z`); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}` }
const tipoLegible: Record<string, string> = {
  running: 'Carrera', track_running: 'Pista', treadmill_running: 'Cinta', trail_running: 'Trail',
  strength_training: 'Fuerza', cycling: 'Ciclismo', indoor_rowing: 'Remo', hiking: 'Senderismo', walking: 'Caminar',
}

function Tarjeta({ titulo, valor, pie, color }: { titulo: string; valor: string; pie?: string; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{titulo}</p>
      <p className="mt-0.5 text-2xl font-semibold tabular-nums" style={{ color: color ?? 'var(--text)' }}>{valor}</p>
      {pie && <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{pie}</p>}
    </div>
  )
}

function Bloque({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{titulo}</h3>
      {nota && <p className="mb-2 mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{nota}</p>}
      {children}
    </section>
  )
}

export default function PanelRendimiento({ clienteId }: { clienteId: string }) {
  const [dias, setDias] = useState(90)
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    setError(null)
    fetch(`/api/clientes/${clienteId}/rendimiento?dias=${dias}`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Error al cargar'); return r.json() })
      .then(j => { if (vivo) setDatos(j) })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar') })
    return () => { vivo = false }
  }, [clienteId, dias])

  const pmc = useMemo<Fila[]>(() => (datos?.serie ?? []).map(p => ({ fecha: p.fecha, ctl: p.ctl, atl: p.atl, tss: p.tss, tsb: p.tsb })), [datos])
  const semanas = useMemo<Fila[]>(() => (datos?.semanas ?? []).map(s => ({ fecha: s.semana, tss: s.tss })), [datos])
  const bien = useMemo<Fila[]>(() => (datos?.bienestar ?? []).map(b => ({ fecha: b.fecha, rhr: b.rhr, readiness: b.readiness, bb: b.body_battery_max })), [datos])
  const parciales = useMemo<Fila[]>(() => (datos?.parciales ?? []).map(p => ({ fecha: p.fecha, s1000: p.s1000, s5000: p.s5000 })), [datos])
  const ef = useMemo<Fila[]>(() => (datos?.eficiencia ?? []).map(p => ({ fecha: p.fecha, ef: p.valor })), [datos])
  const vo2 = useMemo<Fila[]>(() => (datos?.vo2max ?? []).map(p => ({ fecha: p.fecha, vo2: p.valor })), [datos])

  if (error) return <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!datos) return <div className="h-64 animate-pulse rounded-2xl" style={{ background: 'var(--surface)' }} />
  if (!datos.resumen || !datos.entrenos.length) {
    return <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Aún no hay entrenos de Garmin o Strava para este atleta.</p>
  }

  const r = datos.resumen
  const u = datos.umbrales
  const colorTsb = r.tsb < -30 ? COLOR.fatiga : r.tsb < -10 ? COLOR.ambar : COLOR.fresc
  const semanaActual = datos.semanas[datos.semanas.length - 1]
  const avisoRampa = r.rampa7 > 8
  const avisoMonotonia = r.monotonia !== null && r.monotonia > 2

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Datos de Garmin · carga estimada por ritmo y pulso (TSS)</p>
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {RANGOS.map(x => (
            <button key={x.d} onClick={() => setDias(x.d)} className="rounded-md px-2.5 py-1 text-xs"
              style={{ background: dias === x.d ? 'var(--surface-elevated)' : 'transparent', color: dias === x.d ? 'var(--text)' : 'var(--text-muted)' }}>
              {x.t}
            </button>
          ))}
        </div>
      </div>

      <AnalisisIA clienteId={clienteId} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Tarjeta titulo="Forma (CTL)" valor={String(r.ctl)} pie="Carga media de 6 semanas" color={COLOR.forma} />
        <Tarjeta titulo="Fatiga (ATL)" valor={String(r.atl)} pie="Carga media de 7 días" color={COLOR.fatiga} />
        <Tarjeta titulo="Frescura (TSB)" valor={(r.tsb > 0 ? '+' : '') + r.tsb} pie={r.textoEstado} color={colorTsb} />
        <Tarjeta titulo="Subida de forma" valor={(r.rampa7 > 0 ? '+' : '') + r.rampa7} pie={avisoRampa ? 'Sube deprisa (>8/sem)' : 'Cambio en 7 días'} color={avisoRampa ? COLOR.fatiga : undefined} />
        <Tarjeta titulo="Carga 7 días" valor={String(Math.round(r.carga7d))} pie={`${Math.round(r.carga28d)} en 28 días`} />
        <Tarjeta titulo="Monotonía" valor={r.monotonia === null ? '—' : String(r.monotonia)} pie={avisoMonotonia ? 'Poca variación entre días' : 'Variación de carga (Foster)'} color={avisoMonotonia ? COLOR.ambar : undefined} />
      </div>

      <Bloque titulo="Plan vs realizado" nota={datos.ejecucion.planNombre ? `Sesiones de carrera estructuradas de «${datos.ejecucion.planNombre}», semana a semana. El color de cada repetición dice si salió en el ritmo previsto.` : undefined}>
        {datos.ejecucion.sesiones.filter(x => x.estado !== 'pendiente').length === 0 ? (
          <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Todavía no hay sesiones estructuradas que comparar.</p>
        ) : (
          <ul className="space-y-2">
            {datos.ejecucion.sesiones.filter(x => x.estado !== 'pendiente').map(x => {
              const c = x.cumplimiento
              const etiqueta = x.estado === 'saltada' ? 'No realizada' : x.estado === 'otro_dia' ? `Otro día (${fechaCorta(x.fechaReal!)})` : c ? { cumplida: 'Cumplida', parcial: 'Parcial', no_cumplida: 'No cumplida' }[c.estado] : 'Hecha'
              const color = x.estado === 'saltada' || c?.estado === 'no_cumplida' ? COLOR.fatiga : c?.estado === 'parcial' ? COLOR.ambar : COLOR.fresc
              return (
                <li key={x.sesionId + x.semana} className="rounded-lg p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm" style={{ color: 'var(--text)' }}><span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>{fechaCorta(x.fechaPrevista)}</span> · {x.nombre.replace(/^Carrera:\s*/, '')}</p>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color, border: `1px solid ${color}` }}>{etiqueta}</span>
                  </div>
                  {c && <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{c.resumen}</p>}
                  {c?.tramos && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.tramos.map((t, i) => <span key={i} className="rounded-md px-1.5 py-0.5 text-[11px] tabular-nums" style={{ border: '1px solid var(--border-strong)', color: 'var(--text)' }}>{mmss(t)}</span>)}
                    </div>
                  )}
                  {c && c.reps.length > 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.reps.map(r => (
                        <span key={r.n} className="rounded-md px-1.5 py-0.5 text-[11px] tabular-nums" title={r.objetivo ? `Previsto ${mmss(r.objetivo.min)}–${mmss(r.objetivo.max)}` : undefined}
                          style={{ border: `1px solid ${r.estado === 'en_rango' || r.estado === 'sin_objetivo' ? COLOR.fresc : r.estado === 'rapida' ? COLOR.forma : COLOR.ambar}`, color: 'var(--text)' }}>
                          {mmss(r.ritmo_s_km)}
                        </span>
                      ))}
                    </div>
                  )}
                  {!c && x.estado !== 'saltada' && <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>El reloj no marcó repeticiones (carrera libre): no se puede comparar con lo previsto.</p>}
                </li>
              )
            })}
          </ul>
        )}
      </Bloque>

      <Bloque titulo="Forma, fatiga y frescura" nota="La línea azul es la forma que acumulas; la rosa, el cansancio reciente. Cuando la rosa pasa a la azul vas cargado; con la azul por encima llegas fresco.">
        <Grafica datos={pmc} alto={190}
          series={[{ key: 'tss', label: 'Carga del día', color: COLOR.carga, tipo: 'barras' }, { key: 'ctl', label: 'Forma', color: COLOR.forma }, { key: 'atl', label: 'Fatiga', color: COLOR.fatiga }]}
          formato={v => String(Math.round(v))} />
        <div className="mt-3">
          <p className="mb-1 text-xs" style={{ color: 'var(--text-muted)' }}>Frescura (forma − fatiga). Entre −10 y −30 se construye forma; por debajo de −30 hay riesgo.</p>
          <Grafica datos={pmc} alto={120} referencia={0}
            zonas={[{ desde: -200, hasta: -30, color: COLOR.fatiga }, { desde: -30, hasta: -10, color: COLOR.ambar }, { desde: 5, hasta: 25, color: COLOR.fresc }]}
            series={[{ key: 'tsb', label: 'Frescura', color: COLOR.fresc, tipo: 'linea' }]} formato={v => String(Math.round(v))} />
        </div>
      </Bloque>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Carga por semana" nota={semanaActual ? `Esta semana: ${semanaActual.tss} TSS · ${semanaActual.km} km · ${semanaActual.sesiones} sesiones` : undefined}>
          <Grafica datos={semanas} alto={150} series={[{ key: 'tss', label: 'TSS semanal', color: COLOR.forma, tipo: 'barras' }]} formato={v => String(Math.round(v))} />
        </Bloque>
        <Bloque titulo="Batería corporal" nota="El máximo que alcanzas cada día: indica cuánto recuperas por la noche. Si baja días seguidos, falta descanso.">
          <Grafica datos={bien} alto={150} series={[{ key: 'bb', label: 'Máximo del día', color: COLOR.fresc }]} formato={v => String(Math.round(v))} />
        </Bloque>
        <Bloque titulo="Pulso en reposo" nota="Si sube varios días seguidos suele indicar fatiga, enfermedad o estrés.">
          <Grafica datos={bien} alto={150} series={[{ key: 'rhr', label: 'ppm', color: COLOR.fatiga }]} formato={v => String(Math.round(v))} />
        </Bloque>
        <Bloque titulo="Preparación de Garmin" nota="Puntuación de 0 a 100 que estima lo preparado que estás para entrenar duro.">
          <Grafica datos={bien} alto={150} series={[{ key: 'readiness', label: 'Preparación', color: COLOR.ambar }]} formato={v => String(Math.round(v))} />
        </Bloque>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Eficiencia aeróbica" nota="Metros por minuto por cada latido en carreras continuas de 25+ min. Si sube, corres más rápido con el mismo pulso.">
          <Grafica datos={ef} alto={150} series={[{ key: 'ef', label: 'm/min por ppm', color: COLOR.forma }]} formato={v => v.toFixed(2)} />
        </Bloque>
        <Bloque titulo="Mejores parciales" nota="El kilómetro y los 5 km más rápidos de cada salida. Más bajo = más rápido.">
          <Grafica datos={parciales} alto={150}
            series={[{ key: 's1000', label: '1 km', color: COLOR.fatiga }]} formato={v => mmss(v)} />
          <div className="mt-2" />
          <Grafica datos={parciales} alto={120} series={[{ key: 's5000', label: '5 km', color: COLOR.ambar }]} formato={v => mmss(v)} />
        </Bloque>
        <Bloque titulo="VO₂max según Garmin" nota="Estimación del reloj tras cada carrera. Tiende a sobrestimar unos puntos frente a una prueba de laboratorio.">
          <Grafica datos={vo2} alto={150} series={[{ key: 'vo2', label: 'VO₂max', color: COLOR.fresc }]} formato={v => String(Math.round(v))} />
        </Bloque>
        <Bloque titulo="Umbrales del atleta" nota="Lo que mide Garmin y usa el cálculo de carga. Cambian con el tiempo.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Pulso en el umbral</dt><dd className="font-semibold tabular-nums">{u.fcUmbral ? `${u.fcUmbral} ppm` : '—'}</dd></div>
            <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Ritmo en el umbral</dt><dd className="font-semibold tabular-nums">{u.velUmbralMs ? `${mmss(1000 / u.velUmbralMs)}/km` : '—'}</dd></div>
            <div><dt className="text-xs" style={{ color: 'var(--text-muted)' }}>Pulso máximo visto</dt><dd className="font-semibold tabular-nums">{u.fcMax ? `${u.fcMax} ppm` : '—'}</dd></div>
          </dl>
        </Bloque>
      </div>

      <Bloque titulo="Entrenos recientes" nota="La barra de color es el tiempo en cada zona de pulso (de suave a máximo).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="py-1.5 pr-3 font-medium">Fecha</th><th className="pr-3 font-medium">Sesión</th><th className="pr-3 font-medium">Tiempo</th>
                <th className="pr-3 font-medium">Km</th><th className="pr-3 font-medium">Ritmo</th><th className="pr-3 font-medium">Pulso</th>
                <th className="pr-3 font-medium">TSS</th><th className="font-medium">Zonas</th>
              </tr>
            </thead>
            <tbody>
              {datos.entrenos.map((e, i) => {
                const z = e.tiempo_zona_fc
                const tot = z ? z.reduce((a, b) => a + b, 0) : 0
                const carrera = !!e.tipo && /run/.test(e.tipo)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td className="py-1.5 pr-3 tabular-nums">{fechaCorta(e.fecha)}</td>
                    <td className="pr-3"><span style={{ color: 'var(--text)' }}>{e.nombre ?? '—'}</span> <span style={{ color: 'var(--text-muted)' }}>· {tipoLegible[e.tipo ?? ''] ?? e.tipo}</span></td>
                    <td className="pr-3 tabular-nums">{e.duracion_s ? `${Math.round(e.duracion_s / 60)} min` : '—'}</td>
                    <td className="pr-3 tabular-nums">{e.distancia_m && e.distancia_m > 0 ? (e.distancia_m / 1000).toFixed(1) : '—'}</td>
                    <td className="pr-3 tabular-nums">{carrera && e.ritmo_medio_s_km ? mmss(e.ritmo_medio_s_km) : '—'}</td>
                    <td className="pr-3 tabular-nums">{e.fc_media ?? '—'}</td>
                    <td className="pr-3 font-semibold tabular-nums">{e.tss !== null ? Math.round(e.tss) : '—'}</td>
                    <td className="w-28">
                      {z && tot > 0 ? (
                        <div className="flex h-2 w-28 overflow-hidden rounded-full">
                          {z.map((s, k) => <div key={k} style={{ width: `${(s / tot) * 100}%`, background: ZONAS_FC[k] }} />)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Bloque>
    </div>
  )
}

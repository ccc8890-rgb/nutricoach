'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import ZonasVdot from './ZonasVdot'
import PlanObjetivo from './PlanObjetivo'
import DerivaCardiaca from './DerivaCardiaca'
import DistribucionIntensidad from './DistribucionIntensidad'
import TecnicaCarrera from './TecnicaCarrera'
import EntrenosTabla from './EntrenosTabla'
import SubirActividadFit from './SubirActividadFit'
import ResumenDeporte from './ResumenDeporte'
import { Bloque, COLOR, Pestanas, fechaCorta, mmss, type DatosPanel } from './comun'
import { useEstadoUrl } from '@/lib/useEstadoUrl'

const TABS = [
  { key: 'resumen', titulo: 'Resumen' },
  { key: 'plan', titulo: 'Plan y ejecución' },
  { key: 'forma', titulo: 'Forma física' },
  { key: 'tecnica', titulo: 'Técnica' },
  { key: 'entrenos', titulo: 'Entrenos' },
] as const
type Tab = (typeof TABS)[number]['key']
const CLAVES = TABS.map(t => t.key)

/** Todo el análisis de carrera: plan vs realizado, forma física, técnica y entrenos. */
export default function RunningRendimiento({ clienteId, datos, onActualizar }: { clienteId: string; datos: DatosPanel; onActualizar: () => void }) {
  const [tab, setTab] = useEstadoUrl<Tab>('rend', 'resumen', CLAVES)
  const parciales = useMemo<Fila[]>(() => datos.parciales.map(p => ({ fecha: p.fecha, s1000: p.s1000, s5000: p.s5000 })), [datos])
  const ef = useMemo<Fila[]>(() => datos.eficiencia.map(p => ({ fecha: p.fecha, ef: p.valor })), [datos])
  const vo2 = useMemo<Fila[]>(() => datos.vo2max.map(p => ({ fecha: p.fecha, vo2: p.valor })), [datos])
  const running = datos.deportes.find(d => d.deporte === 'running')!
  const u = datos.umbrales
  const sesiones = datos.ejecucion.sesiones.filter(x => x.estado !== 'pendiente')

  return (
    <div className="space-y-4">
      <Pestanas items={TABS} valor={tab} onChange={setTab} etiqueta="Secciones de running" />

      {tab === 'resumen' && <ResumenDeporte resumen={running} nombre="Running" conKm />}

      {tab === 'plan' && (
        <div className="space-y-4">
          <Bloque titulo="Plan vs realizado" nota={datos.ejecucion.planNombre ? `Sesiones de carrera estructuradas de «${datos.ejecucion.planNombre}», semana a semana. El color de cada repetición dice si salió en el ritmo previsto.` : undefined}>
            {sesiones.length === 0 ? (
              <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Todavía no hay sesiones estructuradas que comparar.</p>
            ) : (
              <ul className="space-y-2">
                {sesiones.map(x => {
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

          <PlanObjetivo clienteId={clienteId} />
        </div>
      )}

      {tab === 'forma' && (
        <div className="space-y-4">
          <DistribucionIntensidad intensidad={datos.intensidad} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Bloque titulo="Eficiencia aeróbica" nota="Metros por minuto por cada latido en carreras continuas de 25+ min. Si sube, corres más rápido con el mismo pulso.">
              <Grafica datos={ef} alto={150} series={[{ key: 'ef', label: 'm/min por ppm', color: COLOR.forma }]} formato={v => v.toFixed(2)} />
            </Bloque>
            <Bloque titulo="Mejores parciales" nota="El kilómetro y los 5 km más rápidos de cada salida. Más bajo = más rápido.">
              <Grafica datos={parciales} alto={150} series={[{ key: 's1000', label: '1 km', color: COLOR.fatiga }]} formato={v => mmss(v)} />
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

          <DerivaCardiaca deriva={datos.deriva} />

          <ZonasVdot clienteId={clienteId} />
        </div>
      )}

      {tab === 'tecnica' && <TecnicaCarrera tecnica={datos.tecnica} />}

      {tab === 'entrenos' && (
        <div className="space-y-4">
          <SubirActividadFit clienteId={clienteId} onSubido={onActualizar} />
          <EntrenosTabla entrenos={running.entrenos} titulo="Entrenos de carrera recientes" />
        </div>
      )}
    </div>
  )
}

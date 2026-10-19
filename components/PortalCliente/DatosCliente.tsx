'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Grafica, { type Fila } from '@/components/rendimiento/Grafica'
import { MetricRail, TechnicalReadout } from '@/components/PortalCliente/editorial'
import type { DatosCliente as Datos, Tendencia } from '@/lib/rendimiento/datos-cliente'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
// Mismos tonos que --semantic-* (los SVG de la gráfica necesitan el valor literal).
const COLOR = { metal: '#AEB4BC', verde: '#6AAF85', ambar: '#C8A96A', rojo: '#B86A6A' }
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const DEPORTE: Record<string, string> = { running: 'Carrera', ciclismo: 'Bici', natacion: 'Natación', fuerza: 'Fuerza', otros: 'Otro' }

const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}` : `${min} min`)
const fechaCorta = (f: string) => {
  const d = new Date(`${f}T12:00:00Z`)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '').toUpperCase()
}

function Bloque({ n, titulo, ayuda, children }: { n: string; titulo: string; ayuda: string; children: ReactNode }) {
  return (
    <section className="datos-bloque">
      <header className="datos-bloque__head">
        <span>{n}</span>
        <h2>{titulo}</h2>
      </header>
      <div className="datos-bloque__body">{children}</div>
      <details className="datos-bloque__ayuda">
        <summary>¿Qué es esto?</summary>
        <p>{ayuda}</p>
      </details>
    </section>
  )
}

/** Medidor semicircular fino, tipo instrumento. */
function Arco({ valor, color }: { valor: number; color: string }) {
  const r = 52
  const largo = Math.PI * r
  const p = Math.min(100, Math.max(0, valor)) / 100
  return (
    <svg viewBox="0 0 120 70" className="datos-arco" role="img" aria-label={`Recuperación ${valor} de 100`}>
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="var(--editorial-rule)" strokeWidth="3" strokeLinecap="butt" />
      <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${largo * p} ${largo}`} />
      {[0, 25, 50, 75, 100].map(t => {
        const a = Math.PI * (1 - t / 100)
        const x1 = 60 + Math.cos(a) * 58, y1 = 62 - Math.sin(a) * 58
        const x2 = 60 + Math.cos(a) * 63, y2 = 62 - Math.sin(a) * 63
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-muted)" strokeWidth="0.8" />
      })}
    </svg>
  )
}

function MiniTendencia({ titulo, t, unidad, color }: { titulo: string; t: Tendencia; unidad: string; color: string }) {
  const filas = useMemo<Fila[]>(() => t.puntos.map(p => ({ fecha: p.fecha, v: p.valor })), [t])
  const lectura = t.posicion === 'dentro' ? 'dentro de tu rango habitual' : t.posicion === 'sobre' ? 'por encima de tu rango habitual' : t.posicion === 'bajo' ? 'por debajo de tu rango habitual' : 'aún sin rango habitual (faltan días)'
  return (
    <div className="datos-mini">
      <p><b>{titulo}: {t.actual}{unidad ? ` ${unidad}` : ''}</b> · {lectura}</p>
      <Grafica datos={filas} alto={90} banda={t.normal} series={[{ key: 'v', label: titulo, color }]} formato={v => `${Math.round(v)}${unidad ? ` ${unidad}` : ''}`} />
    </div>
  )
}

/** Pestaña «Datos»: recuperación, semana, forma, sueño, intensidad y progreso, con lo que el reloj y los entrenos realmente miden. */
export default function DatosCliente({ codigo, ultimoPeso, cambioPeso, onVerProgreso, onAjustes }: {
  codigo: string
  ultimoPeso: number | null
  cambioPeso: number | null
  onVerProgreso: () => void
  onAjustes: () => void
}) {
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/cliente/${encodeURIComponent(codigo)}/datos`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (vivo) setDatos(d) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [codigo])

  const semanas = useMemo<Fila[]>(() => (datos?.carga?.semanas ?? []).map(s => ({ fecha: s.semana, tss: s.tss })), [datos])
  const sueno = useMemo<Fila[]>(() => (datos?.sueno?.noches ?? []).map(n => ({ fecha: n.fecha, h: n.horas })), [datos])
  const forma = useMemo<Fila[]>(() => (datos?.forma?.serie ?? []).map(p => ({ fecha: p.fecha, ctl: p.ctl, atl: p.atl })), [datos])
  const bateria = useMemo<Fila[]>(() => (datos?.bienestar.bateria ?? []).map(p => ({ fecha: p.fecha, v: p.valor })), [datos])
  const estres = useMemo<Fila[]>(() => (datos?.bienestar.estres ?? []).map(p => ({ fecha: p.fecha, v: p.valor })), [datos])
  const vo2 = useMemo<Fila[]>(() => (datos?.vo2max?.puntos ?? []).map(p => ({ fecha: p.fecha, v: p.valor })), [datos])

  if (error) return <p className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>No se pudieron cargar tus datos. Inténtalo de nuevo en un momento.</p>
  if (!datos) return <div className="h-40 animate-pulse" style={{ background: 'var(--editorial-panel)' }} />

  const r = datos.recuperacion
  const b = datos.baseAerobica
  const colorNivel = r ? { baja: COLOR.ambar, moderada: COLOR.metal, alta: COLOR.verde }[r.nivel] : COLOR.metal
  const maxMin = Math.max(60, ...datos.semanaDias.map(d => d.minutos))
  const totalSemana = datos.semanaDias.reduce((a, d) => a + d.minutos, 0)
  const sesionesSemana = datos.semanaDias.reduce((a, d) => a + d.sesiones, 0)
  const f = datos.forma?.resumen
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <div className="datos-cliente">
      {!datos.tieneReloj && (
        <div className="datos-aviso">
          <p className="editorial-kicker">Sin reloj conectado</p>
          <p>Con tu reloj verás aquí tu recuperación, tu pulso en reposo y cómo mejora tu entrenamiento.</p>
          <button className="editorial-action" onClick={onAjustes}><span>Conectar en Ajustes</span></button>
        </div>
      )}

      {r && (
        <Bloque n={num()} titulo="Recuperación" ayuda="Es la puntuación de «preparación para entrenar» de tu Garmin (0 a 100). Combina cómo has dormido, cuánto has entrenado, tu variabilidad cardiaca (HRV) y tu estrés. Alta: puedes apretar. Baja: mejor suave o descansar. Es una guía del reloj, no un diagnóstico.">
          <div className="datos-hero">
            <div className="datos-hero__gauge">
              <Arco valor={r.puntuacion} color={colorNivel} />
              <data style={{ color: colorNivel }}>{r.puntuacion}</data>
            </div>
            <div>
              <p className="datos-hero__nivel">{{ baja: 'Recuperación baja', moderada: 'Recuperación moderada', alta: 'Recuperación alta' }[r.nivel]}</p>
              {r.motivo && <p className="datos-hero__motivo">{r.motivo}</p>}
            </div>
          </div>
          <MetricRail>
            {r.pulsoReposo != null && <TechnicalReadout label="Pulso reposo" value={r.pulsoReposo} unit="ppm" />}
            {r.hrvSemanal != null && <TechnicalReadout label="HRV semanal" value={r.hrvSemanal} unit="ms" />}
            {r.bateriaMax != null && <TechnicalReadout label="Batería" value={r.bateriaMax} unit="máx" />}
            {r.estres != null && <TechnicalReadout label="Estrés" value={r.estres} unit="medio" />}
          </MetricRail>
          <div className="datos-tendencias">
            {datos.tendencias.preparacion && <MiniTendencia titulo="Preparación" t={datos.tendencias.preparacion} unidad="" color={COLOR.metal} />}
            {datos.tendencias.pulsoReposo && <MiniTendencia titulo="Pulso en reposo" t={datos.tendencias.pulsoReposo} unidad="ppm" color={COLOR.rojo} />}
          </div>
          {bateria.length >= 3 && (
            <div className="datos-mini">
              <p><b>Batería corporal</b> · máximo de cada día</p>
              <Grafica datos={bateria} alto={90} series={[{ key: 'v', label: 'Batería', color: COLOR.verde, tipo: 'area' }]} formato={v => `${Math.round(v)}`} />
            </div>
          )}
          {estres.length >= 3 && (
            <div className="datos-mini">
              <p><b>Estrés</b> · media de cada día (más bajo, mejor)</p>
              <Grafica datos={estres} alto={90} series={[{ key: 'v', label: 'Estrés', color: COLOR.ambar }]} formato={v => `${Math.round(v)}`} />
            </div>
          )}
        </Bloque>
      )}

      <Bloque n={num()} titulo="Esta semana" ayuda="Minutos de entrenamiento de cada día, de lunes a domingo, con todo lo que ha registrado tu reloj o la app.">
        <div className="datos-semana" role="img" aria-label={`Esta semana: ${horas(totalSemana)} en ${sesionesSemana} sesiones`}>
          {datos.semanaDias.map((d, i) => {
            const esHoy = d.fecha === datos.hoy
            return (
              <div key={d.fecha} className={`datos-semana__dia${esHoy ? ' is-hoy' : ''}`}>
                <span className="datos-semana__min">{d.minutos > 0 ? d.minutos : ''}</span>
                <div className="datos-semana__barra"><span style={{ height: `${(d.minutos / maxMin) * 100}%` }} /></div>
                <span className="datos-semana__letra">{DIAS[i]}</span>
              </div>
            )
          })}
        </div>
        <MetricRail>
          <TechnicalReadout label="Tiempo" value={horas(totalSemana)} />
          <TechnicalReadout label="Sesiones" value={sesionesSemana} />
          {datos.carga?.semanaActual && datos.carga.semanaActual.km > 0 && <TechnicalReadout label="Carrera" value={datos.carga.semanaActual.km} unit="km" />}
        </MetricRail>
      </Bloque>

      {f && forma.length > 1 && (
        <Bloque n={num()} titulo="Forma y fatiga" ayuda="Forma es lo que tu cuerpo ha acumulado de entrenar durante semanas (sube despacio). Fatiga es el cansancio de los últimos días (sube y baja rápido). Frescura = forma menos fatiga: positiva, vas descansado; muy negativa, vas cargado. Lo habitual en plena preparación es estar ligeramente negativo.">
          <p className="datos-estado">{datos.carga?.estado ?? ''}</p>
          <MetricRail>
            <TechnicalReadout label="Forma" value={Math.round(f.ctl)} detail="últimas semanas" />
            <TechnicalReadout label="Fatiga" value={Math.round(f.atl)} detail="últimos días" />
            <TechnicalReadout label="Frescura" value={`${f.tsb > 0 ? '+' : ''}${Math.round(f.tsb)}`} detail={f.tsb > 5 ? 'descansado' : f.tsb < -15 ? 'cargado' : 'equilibrado'} />
          </MetricRail>
          <Grafica datos={forma} alto={150} series={[
            { key: 'ctl', label: 'Forma', color: COLOR.metal, tipo: 'area' },
            { key: 'atl', label: 'Fatiga', color: COLOR.rojo },
          ]} formato={v => `${Math.round(v)}`} />
          <p className="datos-leyenda"><i style={{ background: COLOR.metal }} /> Forma <i style={{ background: COLOR.rojo }} /> Fatiga · 60 días</p>
        </Bloque>
      )}

      {datos.carga && semanas.length > 1 && (
        <Bloque n={num()} titulo="Carga semanal" ayuda="Cada sesión suma un «estrés de entrenamiento» según su duración e intensidad. La barra es el total de cada semana. Lo sano es subir poco a poco y bajar una semana de cada tres o cuatro.">
          <Grafica datos={semanas} alto={110} series={[{ key: 'tss', label: 'Estrés de entrenamiento', color: COLOR.verde, tipo: 'barras' }]} formato={v => `${Math.round(v)}`} />
        </Bloque>
      )}

      {datos.sueno && (
        <Bloque n={num()} titulo="Sueño" ayuda="Horas dormidas según tu reloj en las últimas noches. Para que se registre, llévalo puesto al dormir. Lo recomendable para quien entrena es dormir entre 7 y 9 horas.">
          <MetricRail>
            <TechnicalReadout label="Media" value={datos.sueno.mediaHoras} unit="h" detail={`últimas ${datos.sueno.noches.length} noches`} />
          </MetricRail>
          <Grafica datos={sueno} alto={100} referencia={7} series={[{ key: 'h', label: 'Horas', color: COLOR.metal, tipo: 'barras' }]} formato={v => `${v.toFixed(1)} h`} />
        </Bloque>
      )}

      {datos.intensidad && (
        <Bloque n={num()} titulo="Intensidad" ayuda="Cómo se reparte tu tiempo de carrera de los últimos 28 días. Lo que usan los corredores de resistencia es alrededor de un 80 % suave y el resto duro: así se recupera bien y se mejora.">
          <div className="datos-intensidad" role="img" aria-label={`Suave ${datos.intensidad.pctSuave} %, media ${datos.intensidad.pctMedia} %, dura ${datos.intensidad.pctDura} %`}>
            <span style={{ width: `${datos.intensidad.pctSuave}%`, background: COLOR.verde }} />
            <span style={{ width: `${datos.intensidad.pctMedia}%`, background: COLOR.ambar }} />
            <span style={{ width: `${datos.intensidad.pctDura}%`, background: COLOR.rojo }} />
          </div>
          <MetricRail>
            <TechnicalReadout label="Suave" value={datos.intensidad.pctSuave} unit="%" />
            <TechnicalReadout label="Media" value={datos.intensidad.pctMedia} unit="%" />
            <TechnicalReadout label="Dura" value={datos.intensidad.pctDura} unit="%" />
          </MetricRail>
        </Bloque>
      )}

      {b.valoracion !== 'sin_datos' && b.reciente && b.previa && b.fcRef && b.cambioSeg !== null && (
        <Bloque n={num()} titulo="Tu base aeróbica" ayuda="Compara tus rodajes suaves de las últimas 4 semanas con los de las 4 anteriores. Si a igual pulso corres más rápido, tu cuerpo es más eficiente: es la mejor señal de que el entrenamiento funciona. Un cambio pequeño es normal por el calor, el sueño o el terreno; fíjate en la tendencia de varias semanas.">
          <MetricRail>
            <TechnicalReadout label="Pulso de referencia" value={b.fcRef} unit="ppm" />
            <TechnicalReadout label="Ritmo a ese pulso" value={mmss(b.reciente.ritmoRef)} unit="/km" />
          </MetricRail>
          <p className="datos-estado" style={{ color: b.valoracion === 'mejora' ? COLOR.verde : b.valoracion === 'retrocede' ? COLOR.ambar : undefined }}>
            {b.valoracion === 'mejora' ? `Mejoras: ${Math.abs(Math.round(b.cambioSeg))} s/km más rápido que hace un mes con el mismo pulso.`
              : b.valoracion === 'retrocede' ? `Ahora mismo vas ${Math.abs(Math.round(b.cambioSeg))} s/km más lento con el mismo pulso. Puede ser cansancio o calor; tu coach lo tiene en cuenta.`
              : 'Estable respecto al mes pasado.'}
          </p>
        </Bloque>
      )}

      {datos.vo2max && vo2.length >= 2 && (
        <Bloque n={num()} titulo="VO₂ máx" ayuda="Estimación de tu reloj de cuánto oxígeno puede usar tu cuerpo al máximo esfuerzo. Es una estimación: sube con el entrenamiento constante, pero fluctúa unas décimas de una sesión a otra.">
          <MetricRail>
            <TechnicalReadout label="Actual" value={datos.vo2max.actual} unit="ml/kg/min" />
          </MetricRail>
          <Grafica datos={vo2} alto={90} series={[{ key: 'v', label: 'VO₂ máx', color: COLOR.verde }]} formato={v => v.toFixed(1)} />
        </Bloque>
      )}

      {datos.ultimosEntrenos.length > 0 && (
        <Bloque n={num()} titulo="Últimas sesiones" ayuda="Tus entrenos más recientes registrados por el reloj o la app. «Carga» es el estrés de entrenamiento de esa sesión.">
          <ul className="datos-sesiones">
            {datos.ultimosEntrenos.map((e, i) => (
              <li key={`${e.fecha}-${i}`}>
                <div>
                  <p className="datos-sesiones__fecha">{fechaCorta(e.fecha)} · {DEPORTE[e.deporte] ?? 'Otro'}</p>
                  <p className="datos-sesiones__nombre">{e.nombre}</p>
                </div>
                <p className="datos-sesiones__datos">
                  {horas(e.minutos)}{e.km ? ` · ${e.km} km` : ''}{e.fcMedia ? ` · ${e.fcMedia} ppm` : ''}{e.carga ? ` · carga ${e.carga}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Bloque>
      )}

      {ultimoPeso != null && (
        <Bloque n={num()} titulo="Cuerpo" ayuda="Tu último peso registrado y el cambio desde el inicio. El peso varía varios cientos de gramos de un día a otro; mira la tendencia de semanas, no el dato de hoy.">
          <MetricRail>
            <TechnicalReadout label="Peso" value={ultimoPeso} unit="kg" detail={cambioPeso !== null ? `${cambioPeso > 0 ? '+' : ''}${cambioPeso.toFixed(1)} kg desde el inicio` : undefined} />
          </MetricRail>
          <button className="editorial-action" onClick={onVerProgreso}><span>Ver mi progreso</span><span aria-hidden="true">↗</span></button>
        </Bloque>
      )}
    </div>
  )
}

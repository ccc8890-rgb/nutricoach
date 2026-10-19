'use client'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Grafica, { type Fila } from '@/components/rendimiento/Grafica'
import ResumenDeporte from '@/components/rendimiento/ResumenDeporte'
import BaseAerobica from '@/components/rendimiento/BaseAerobica'
import DistribucionIntensidad from '@/components/rendimiento/DistribucionIntensidad'
import DerivaCardiaca from '@/components/rendimiento/DerivaCardiaca'
import TecnicaCarrera from '@/components/rendimiento/TecnicaCarrera'
import EntrenosTabla from '@/components/rendimiento/EntrenosTabla'
import { COLOR, ZONAS_FC, fechaCorta, mmss, type DatosPanel } from '@/components/rendimiento/comun'
import { IndustrialTabs, MetricRail, TechnicalReadout } from '@/components/PortalCliente/editorial'
import { NOMBRE_DEPORTE, type Deporte } from '@/lib/rendimiento/deportes'

interface Sesion {
  fecha: string; nombre: string | null; tipo: string | null; deporte: Deporte
  min: number; km: number | null; ritmo: number | null; fc: number | null; tss: number | null
  pot: number | null; potNorm: number | null; zonas: number[] | null
}
type Datos = DatosPanel & { sesiones: Sesion[] }
type Vista = 'general' | 'running' | 'fuerza' | 'ciclismo' | 'natacion'

const RANGOS = [{ d: 42, t: '6 sem' }, { d: 90, t: '3 meses' }, { d: 180, t: '6 meses' }, { d: 365, t: '1 año' }]
const COLOR_DEP: Record<string, string> = { running: '#5B8DEF', fuerza: '#C8A96A', ciclismo: '#6AAF85', natacion: '#8A9AB8', otros: '#7B818A' }

const horas = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} min`)
const suma = (v: number[]) => v.reduce((a, b) => a + b, 0)
const dia = (f: string) => Math.round(new Date(`${f}T12:00:00Z`).getTime() / 86_400_000)

function Bloque({ n, titulo, nota, children }: { n?: string; titulo: string; nota?: string; children: ReactNode }) {
  return (
    <section className="datos-bloque">
      <header className="datos-bloque__head">
        <span>{n ?? '·'}</span>
        <h2>{titulo}</h2>
      </header>
      <div className="datos-bloque__body">
        {nota && <p className="datos-nota">{nota}</p>}
        {children}
      </div>
    </section>
  )
}

/** Mapa de actividad tipo contribuciones: 18 semanas, una celda por día, intensidad = carga (TSS) del día. */
function MapaActividad({ sesiones, hoy }: { sesiones: Sesion[]; hoy: string }) {
  const { columnas, max, total, activos } = useMemo(() => {
    const porDia = new Map<string, { tss: number; min: number; n: number }>()
    for (const s of sesiones) {
      const x = porDia.get(s.fecha) ?? { tss: 0, min: 0, n: 0 }
      x.tss += s.tss ?? 0; x.min += s.min; x.n += 1
      porDia.set(s.fecha, x)
    }
    const hoyD = new Date(`${hoy}T12:00:00Z`)
    const offsetLunes = (hoyD.getUTCDay() + 6) % 7
    const inicio = hoyD.getTime() - (offsetLunes + 17 * 7) * 86_400_000
    const cols: { fecha: string; v: number; min: number; n: number; futuro: boolean }[][] = []
    for (let c = 0; c < 18; c++) {
      const col = []
      for (let r = 0; r < 7; r++) {
        const fecha = new Date(inicio + (c * 7 + r) * 86_400_000).toISOString().slice(0, 10)
        const x = porDia.get(fecha)
        col.push({ fecha, v: x?.tss ?? 0, min: x?.min ?? 0, n: x?.n ?? 0, futuro: fecha > hoy })
      }
      cols.push(col)
    }
    const todos = cols.flat()
    return { columnas: cols, max: Math.max(40, ...todos.map(x => x.v)), total: todos.reduce((a, x) => a + x.n, 0), activos: todos.filter(x => x.n > 0).length }
  }, [sesiones, hoy])

  return (
    <div>
      <div className="datos-mapa" role="img" aria-label={`${total} sesiones en 18 semanas, ${activos} días activos`}>
        {columnas.map((col, i) => (
          <div key={i} className="datos-mapa__col">
            {col.map(c => (
              <i key={c.fecha} className={c.futuro ? 'is-futuro' : undefined}
                style={c.n > 0 ? { opacity: 0.28 + 0.72 * Math.min(1, (c.v || 20) / max), background: 'var(--metal-bright)' } : undefined}
                title={c.n > 0 ? `${fechaCorta(c.fecha)} · ${c.n} ses. · ${horas(c.min)} · carga ${Math.round(c.v)}` : fechaCorta(c.fecha)} />
            ))}
          </div>
        ))}
      </div>
      <p className="datos-leyenda"><span>{activos} días activos</span><span>·</span><span>{total} sesiones</span><span>·</span><span>18 semanas</span></p>
    </div>
  )
}

/** Tiempo acumulado en cada zona de pulso de las sesiones dadas. */
function ZonasAcumuladas({ sesiones }: { sesiones: Sesion[] }) {
  const z = [0, 0, 0, 0, 0]
  for (const s of sesiones) s.zonas?.forEach((v, i) => { if (i < 5) z[i] += v })
  const tot = suma(z)
  if (tot <= 0) return <p className="datos-nota">Sin datos de zonas de pulso en este periodo.</p>
  return (
    <div>
      <div className="datos-zonas" role="img" aria-label="Tiempo por zona de pulso">
        {z.map((v, i) => <span key={i} style={{ width: `${(v / tot) * 100}%`, background: ZONAS_FC[i] }} />)}
      </div>
      <MetricRail>
        {z.map((v, i) => <TechnicalReadout key={i} label={`Z${i + 1}`} value={Math.round((v / tot) * 100)} unit="%" detail={horas(v / 60)} />)}
      </MetricRail>
    </div>
  )
}

function Sesiones({ sesiones }: { sesiones: Sesion[] }) {
  if (!sesiones.length) return <p className="datos-nota">Todavía no hay sesiones.</p>
  return (
    <ul className="datos-sesiones">
      {sesiones.map((e, i) => (
        <li key={`${e.fecha}-${i}`}>
          <div>
            <p className="datos-sesiones__fecha"><i style={{ background: COLOR_DEP[e.deporte] }} />{fechaCorta(e.fecha)} · {NOMBRE_DEPORTE[e.deporte].toUpperCase()}</p>
            <p className="datos-sesiones__nombre">{e.nombre ?? 'Sesión'}</p>
          </div>
          <p className="datos-sesiones__datos">
            {horas(e.min)}{e.km ? ` · ${e.km} km` : ''}{e.deporte === 'running' && e.ritmo ? ` · ${mmss(e.ritmo)}/km` : ''}{e.pot ? ` · ${e.pot} W` : ''}{e.fc ? ` · ${e.fc} ppm` : ''}{e.tss ? ` · carga ${e.tss}` : ''}
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Pestaña «Datos»: rendimiento de entrenamiento, general y por deporte. */
export default function DatosCliente({ codigo, onAjustes }: {
  codigo: string
  ultimoPeso?: number | null
  cambioPeso?: number | null
  onVerProgreso?: () => void
  onAjustes: () => void
}) {
  const [dias, setDias] = useState(90)
  const [vista, setVista] = useState<Vista>('general')
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let vivo = true
    setError(false)
    fetch(`/api/cliente/${encodeURIComponent(codigo)}/rendimiento?dias=${dias}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (vivo) setDatos(d) })
      .catch(() => { if (vivo) setError(true) })
    return () => { vivo = false }
  }, [codigo, dias])

  const s = datos?.sesiones
  const desde = useMemo(() => (datos ? new Date(dia(datos.hoy) * 86_400_000 - dias * 86_400_000).toISOString().slice(0, 10) : ''), [datos, dias])
  const enRango = useMemo(() => (s ?? []).filter(x => x.fecha >= desde), [s, desde])
  const pmc = useMemo<Fila[]>(() => (datos?.serie ?? []).map(p => ({ fecha: p.fecha, ctl: p.ctl, atl: p.atl, tss: p.tss, tsb: p.tsb })), [datos])
  const semanas = useMemo<Fila[]>(() => (datos?.semanas ?? []).map(x => ({ fecha: x.semana, tss: x.tss, min: x.minutos })), [datos])
  const parciales = useMemo<Fila[]>(() => (datos?.parciales ?? []).map(p => ({ fecha: p.fecha, s1000: p.s1000, s5000: p.s5000 })), [datos])
  const ef = useMemo<Fila[]>(() => (datos?.eficiencia ?? []).map(p => ({ fecha: p.fecha, ef: p.valor })), [datos])
  const vo2 = useMemo<Fila[]>(() => (datos?.vo2max ?? []).map(p => ({ fecha: p.fecha, vo2: p.valor })), [datos])

  if (error) return <p className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>No se pudieron cargar tus datos. Inténtalo de nuevo en un momento.</p>
  if (!datos) return <div className="h-48 animate-pulse" style={{ background: 'var(--editorial-panel)' }} />
  if (!datos.resumen || !datos.entrenos.length) {
    return (
      <div className="datos-aviso">
        <p className="editorial-kicker">Sin entrenos todavía</p>
        <p>Cuando tu reloj (Garmin o Strava) registre entrenos verás aquí tu rendimiento, tu carga y la evolución por deporte.</p>
        <button className="editorial-action" onClick={onAjustes}><span>Conectar mi reloj</span></button>
      </div>
    )
  }

  const r = datos.resumen
  const conDatos = datos.deportes.filter(d => d.deporte === 'running' || d.sesiones > 0).map(d => d.deporte)
  const tabs = [{ key: 'general' as Vista, label: 'General' }, ...conDatos.map(d => ({ key: d as Vista, label: NOMBRE_DEPORTE[d] }))]
  const v: Vista = tabs.some(t => t.key === vista) ? vista : 'general'

  const colorTsb = r.tsb < -30 ? COLOR.fatiga : r.tsb < -10 ? COLOR.ambar : COLOR.fresc
  const ult28 = (s ?? []).filter(x => dia(datos.hoy) - dia(x.fecha) < 28)
  const minPorDeporte = (['running', 'fuerza', 'ciclismo', 'natacion', 'otros'] as Deporte[])
    .map(d => ({ d, min: suma(ult28.filter(x => x.deporte === d).map(x => x.min)) })).filter(x => x.min > 0)
  const min28 = suma(minPorDeporte.map(x => x.min))
  const semanaActual = datos.semanas[datos.semanas.length - 1]
  const deporteSel = v === 'general' ? null : datos.deportes.find(d => d.deporte === v)
  const sesDep = v === 'general' ? enRango : enRango.filter(x => x.deporte === v)
  const filasSes = (f: (x: Sesion) => number | null, key: string): Fila[] => sesDep.map(x => ({ fecha: x.fecha, [key]: f(x) }))

  const mejor = (k: 's1000' | 's5000') => { const vals = datos.parciales.map(p => p[k]).filter((x): x is number => !!x); return vals.length ? Math.min(...vals) : null }
  const sesRun = enRango.filter(x => x.deporte === 'running')
  const tiradaMax = sesRun.reduce((m, x) => Math.max(m, x.km ?? 0), 0)

  return (
    <div className="datos-cliente datos-rend coach-performance-panel">
      <div className="datos-controles">
        <IndustrialTabs items={tabs} activeKey={v} onChange={setVista} ariaLabel="Deporte" />
        <div className="datos-rango" role="group" aria-label="Periodo">
          {RANGOS.map(x => (
            <button key={x.d} type="button" className={dias === x.d ? 'is-active' : ''} onClick={() => setDias(x.d)}>{x.t}</button>
          ))}
        </div>
      </div>

      {v === 'general' && (
        <>
          <Bloque n="01" titulo="Estado de forma" nota={r.textoEstado}>
            <MetricRail>
              <TechnicalReadout label="Forma" value={Math.round(r.ctl)} detail="carga de 6 semanas" />
              <TechnicalReadout label="Fatiga" value={Math.round(r.atl)} detail="carga de 7 días" />
              <TechnicalReadout label="Frescura" value={`${r.tsb > 0 ? '+' : ''}${Math.round(r.tsb)}`} detail={r.tsb > 5 ? 'descansado' : r.tsb < -30 ? 'muy cargado' : r.tsb < -10 ? 'construyendo' : 'equilibrado'} />
              <TechnicalReadout label="Subida" value={`${r.rampa7 > 0 ? '+' : ''}${r.rampa7}`} detail={r.rampa7 > 8 ? 'sube deprisa' : 'forma en 7 días'} />
            </MetricRail>
            <Grafica datos={pmc} alto={190}
              series={[{ key: 'tss', label: 'Carga del día', color: COLOR.carga, tipo: 'barras' }, { key: 'ctl', label: 'Forma', color: COLOR.forma }, { key: 'atl', label: 'Fatiga', color: COLOR.fatiga }]}
              formato={x => String(Math.round(x))} />
            <p className="datos-nota" style={{ color: colorTsb }}>Frescura (forma − fatiga): entre −10 y −30 se construye forma; por debajo de −30 hay riesgo.</p>
            <Grafica datos={pmc} alto={110} referencia={0}
              zonas={[{ desde: -200, hasta: -30, color: COLOR.fatiga }, { desde: -30, hasta: -10, color: COLOR.ambar }, { desde: 5, hasta: 25, color: COLOR.fresc }]}
              series={[{ key: 'tsb', label: 'Frescura', color: COLOR.fresc }]} formato={x => String(Math.round(x))} />
          </Bloque>

          <Bloque n="02" titulo="Mapa de actividad" nota="Una celda por día; más claro = más carga de entrenamiento.">
            <MapaActividad sesiones={s ?? []} hoy={datos.hoy} />
          </Bloque>

          <Bloque n="03" titulo="Reparto por deporte" nota="Tiempo entrenado en los últimos 28 días.">
            <div className="datos-zonas" role="img" aria-label="Reparto del tiempo por deporte">
              {minPorDeporte.map(x => <span key={x.d} style={{ width: `${(x.min / min28) * 100}%`, background: COLOR_DEP[x.d] }} />)}
            </div>
            <MetricRail>
              {minPorDeporte.map(x => <TechnicalReadout key={x.d} label={NOMBRE_DEPORTE[x.d]} value={Math.round((x.min / min28) * 100)} unit="%" detail={horas(x.min)} />)}
            </MetricRail>
          </Bloque>

          <Bloque n="04" titulo="Carga semanal" nota={semanaActual ? `Esta semana: ${semanaActual.tss} de carga · ${horas(semanaActual.minutos)} · ${semanaActual.sesiones} sesiones` : undefined}>
            <Grafica datos={semanas} alto={140} series={[{ key: 'tss', label: 'Carga semanal', color: COLOR.forma, tipo: 'barras' }]} formato={x => String(Math.round(x))} />
            <MetricRail>
              <TechnicalReadout label="Carga 7 días" value={Math.round(r.carga7d)} />
              <TechnicalReadout label="Carga 28 días" value={Math.round(r.carga28d)} />
              <TechnicalReadout label="Monotonía" value={r.monotonia === null ? '—' : r.monotonia} detail={r.monotonia !== null && r.monotonia > 2 ? 'poca variación' : 'variación de carga'} />
            </MetricRail>
          </Bloque>

          <Bloque n="05" titulo="Zonas de pulso" nota="Tiempo acumulado en cada zona en el periodo elegido (de suave a máximo).">
            <ZonasAcumuladas sesiones={enRango} />
          </Bloque>

          <Bloque n="06" titulo="Intensidad" nota="Reparto suave / medio / duro de tu carrera. Lo habitual en resistencia es ~80 % suave.">
            <DistribucionIntensidad intensidad={datos.intensidad} />
          </Bloque>

          <Bloque n="07" titulo="Últimas sesiones">
            <Sesiones sesiones={[...(s ?? [])].reverse().slice(0, 8)} />
          </Bloque>
        </>
      )}

      {v === 'running' && deporteSel && (
        <>
          <Bloque n="01" titulo="Resumen de carrera">
            <ResumenDeporte resumen={deporteSel} nombre="Running" conKm />
          </Bloque>

          <Bloque n="02" titulo="Marcas" nota="Tus mejores datos en el periodo.">
            <MetricRail>
              <TechnicalReadout label="Mejor 1 km" value={mejor('s1000') ? mmss(mejor('s1000')!) : '—'} unit="/km" />
              <TechnicalReadout label="Mejor 5 km" value={mejor('s5000') ? mmss(mejor('s5000')!) : '—'} />
              <TechnicalReadout label="Salida más larga" value={tiradaMax || '—'} unit={tiradaMax ? 'km' : undefined} />
              <TechnicalReadout label="VO₂ máx" value={datos.vo2max.length ? Math.round(datos.vo2max[datos.vo2max.length - 1].valor) : '—'} />
            </MetricRail>
          </Bloque>

          <Bloque n="03" titulo="Ritmo, distancia y pulso por salida" nota="Cada punto es una salida. Más bajo en ritmo = más rápido.">
            <Grafica datos={filasSes(x => x.ritmo, 'ritmo')} alto={140} series={[{ key: 'ritmo', label: 'Ritmo medio', color: COLOR.forma }]} formato={x => `${mmss(x)}/km`} />
            <div className="datos-sep" />
            <Grafica datos={filasSes(x => x.km, 'km')} alto={110} series={[{ key: 'km', label: 'Distancia', color: COLOR.fresc, tipo: 'barras' }]} formato={x => `${x.toFixed(1)} km`} />
            <div className="datos-sep" />
            <Grafica datos={filasSes(x => x.fc, 'fc')} alto={110} series={[{ key: 'fc', label: 'Pulso medio', color: COLOR.fatiga }]} formato={x => `${Math.round(x)} ppm`} />
          </Bloque>

          <Bloque n="04" titulo="Forma aeróbica">
            <BaseAerobica base={datos.baseAerobica} />
            <div className="datos-sep" />
            <p className="datos-nota">Eficiencia: metros por minuto por cada latido en carreras continuas. Si sube, corres más rápido con el mismo pulso.</p>
            <Grafica datos={ef} alto={130} series={[{ key: 'ef', label: 'm/min por ppm', color: COLOR.forma }]} formato={x => x.toFixed(2)} />
            <div className="datos-sep" />
            <p className="datos-nota">VO₂ máx según tu reloj.</p>
            <Grafica datos={vo2} alto={110} series={[{ key: 'vo2', label: 'VO₂ máx', color: COLOR.fresc }]} formato={x => String(Math.round(x))} />
          </Bloque>

          <Bloque n="05" titulo="Mejores parciales" nota="El kilómetro y los 5 km más rápidos de cada salida.">
            <Grafica datos={parciales} alto={130} series={[{ key: 's1000', label: '1 km', color: COLOR.fatiga }]} formato={x => mmss(x)} />
            <div className="datos-sep" />
            <Grafica datos={parciales} alto={110} series={[{ key: 's5000', label: '5 km', color: COLOR.ambar }]} formato={x => mmss(x)} />
          </Bloque>

          <Bloque n="06" titulo="Deriva cardiaca y técnica">
            <DerivaCardiaca deriva={datos.deriva} />
            <div className="datos-sep" />
            <TecnicaCarrera tecnica={datos.tecnica} />
          </Bloque>

          <Bloque n="07" titulo="Zonas de pulso">
            <ZonasAcumuladas sesiones={sesDep} />
          </Bloque>

          <Bloque n="08" titulo="Entrenos de carrera">
            <EntrenosTabla entrenos={deporteSel.entrenos} titulo="Últimos entrenos" />
          </Bloque>
        </>
      )}

      {v !== 'general' && v !== 'running' && deporteSel && (
        <>
          <Bloque n="01" titulo={`Resumen de ${NOMBRE_DEPORTE[v].toLowerCase()}`}>
            <ResumenDeporte resumen={deporteSel} nombre={NOMBRE_DEPORTE[v]} conKm={v !== 'fuerza'} />
          </Bloque>

          <Bloque n="02" titulo="Cada sesión" nota="Evolución sesión a sesión en el periodo elegido.">
            <Grafica datos={filasSes(x => x.min, 'min')} alto={120} series={[{ key: 'min', label: 'Duración', color: COLOR_DEP[v], tipo: 'barras' }]} formato={x => `${Math.round(x)} min`} />
            <div className="datos-sep" />
            <Grafica datos={filasSes(x => x.tss, 'tss')} alto={110} series={[{ key: 'tss', label: 'Carga', color: COLOR.forma, tipo: 'barras' }]} formato={x => String(Math.round(x))} />
            <div className="datos-sep" />
            <Grafica datos={filasSes(x => x.fc, 'fc')} alto={110} series={[{ key: 'fc', label: 'Pulso medio', color: COLOR.fatiga }]} formato={x => `${Math.round(x)} ppm`} />
          </Bloque>

          {v === 'ciclismo' && sesDep.some(x => x.pot) && (
            <Bloque n="03" titulo="Potencia" nota="Potencia media y normalizada de cada salida.">
              <Grafica datos={sesDep.map(x => ({ fecha: x.fecha, pot: x.pot, norm: x.potNorm }))} alto={150}
                series={[{ key: 'pot', label: 'Media', color: COLOR.forma }, { key: 'norm', label: 'Normalizada', color: COLOR.ambar }]} formato={x => `${Math.round(x)} W`} />
            </Bloque>
          )}

          {(v === 'ciclismo' || v === 'natacion') && sesDep.some(x => x.km) && (
            <Bloque n="04" titulo="Distancia" nota="Kilómetros de cada sesión.">
              <Grafica datos={filasSes(x => x.km, 'km')} alto={120} series={[{ key: 'km', label: 'Distancia', color: COLOR.fresc, tipo: 'barras' }]} formato={x => `${x.toFixed(1)} km`} />
            </Bloque>
          )}

          {v === 'natacion' && sesDep.some(x => x.km && x.min) && (
            <Bloque n="05" titulo="Ritmo por 100 m" nota="Tiempo medio cada 100 m. Más bajo = más rápido.">
              <Grafica datos={sesDep.filter(x => x.km && x.min).map(x => ({ fecha: x.fecha, r100: (x.min * 60) / ((x.km as number) * 10) }))} alto={120}
                series={[{ key: 'r100', label: 'Ritmo /100 m', color: COLOR.forma }]} formato={x => mmss(x)} />
            </Bloque>
          )}

          <Bloque n="06" titulo="Zonas de pulso">
            <ZonasAcumuladas sesiones={sesDep} />
          </Bloque>

          <Bloque n="07" titulo="Últimas sesiones">
            <EntrenosTabla entrenos={deporteSel.entrenos} titulo="Entrenos recientes" />
          </Bloque>
        </>
      )}
    </div>
  )
}

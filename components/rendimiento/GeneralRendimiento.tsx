'use client'
import { useMemo } from 'react'
import Grafica, { type Fila } from './Grafica'
import AnalisisIA from './AnalisisIA'
import EntrenosTabla from './EntrenosTabla'
import SubirActividadFit from './SubirActividadFit'
import SeguimientoResultados from './SeguimientoResultados'
import { Bloque, COLOR, Pestanas, Tarjeta, type DatosPanel } from './comun'
import { useEstadoUrl } from '@/lib/useEstadoUrl'

const TABS = [
  { key: 'resumen', titulo: 'Resumen' },
  { key: 'carga', titulo: 'Carga y recuperación' },
  { key: 'seguimiento', titulo: 'Seguimiento' },
  { key: 'entrenos', titulo: 'Entrenos' },
] as const
type Tab = (typeof TABS)[number]['key']
const CLAVES = TABS.map(t => t.key)

/** Vista global del atleta: carga de todos los deportes sumada y su recuperación. */
export default function GeneralRendimiento({ clienteId, datos, onActualizar }: { clienteId: string; datos: DatosPanel; onActualizar: () => void }) {
  const [tab, setTab] = useEstadoUrl<Tab>('rend', 'resumen', CLAVES)
  const pmc = useMemo<Fila[]>(() => datos.serie.map(p => ({ fecha: p.fecha, ctl: p.ctl, atl: p.atl, tss: p.tss, tsb: p.tsb })), [datos])
  const semanas = useMemo<Fila[]>(() => datos.semanas.map(s => ({ fecha: s.semana, tss: s.tss })), [datos])
  const bien = useMemo<Fila[]>(() => datos.bienestar.map(b => ({ fecha: b.fecha, rhr: b.rhr, readiness: b.readiness, bb: b.body_battery_max })), [datos])

  const r = datos.resumen!
  const colorTsb = r.tsb < -30 ? COLOR.fatiga : r.tsb < -10 ? COLOR.ambar : COLOR.fresc
  const semanaActual = datos.semanas[datos.semanas.length - 1]
  const avisoRampa = r.rampa7 > 8
  const avisoMonotonia = r.monotonia !== null && r.monotonia > 2

  return (
    <div className="space-y-4">
      <Pestanas items={TABS} valor={tab} onChange={setTab} etiqueta="Secciones de la vista general" />

      {tab === 'resumen' && (
        <div className="space-y-4">
          <AnalisisIA clienteId={clienteId} />

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Tarjeta titulo="Forma (CTL)" valor={String(r.ctl)} pie="Carga media de 6 semanas" color={COLOR.forma} />
            <Tarjeta titulo="Fatiga (ATL)" valor={String(r.atl)} pie="Carga media de 7 días" color={COLOR.fatiga} />
            <Tarjeta titulo="Frescura (TSB)" valor={(r.tsb > 0 ? '+' : '') + r.tsb} pie={r.textoEstado} color={colorTsb} />
            <Tarjeta titulo="Subida de forma" valor={(r.rampa7 > 0 ? '+' : '') + r.rampa7} pie={avisoRampa ? 'Sube deprisa (>8/sem)' : 'Cambio en 7 días'} color={avisoRampa ? COLOR.fatiga : undefined} />
            <Tarjeta titulo="Carga 7 días" valor={String(Math.round(r.carga7d))} pie={`${Math.round(r.carga28d)} en 28 días`} />
            <Tarjeta titulo="Monotonía" valor={r.monotonia === null ? '—' : String(r.monotonia)} pie={avisoMonotonia ? 'Poca variación entre días' : 'Variación de carga (Foster)'} color={avisoMonotonia ? COLOR.ambar : undefined} />
          </div>

          <Bloque titulo="Forma, fatiga y frescura" nota="Suma todos los deportes. La línea azul es la forma que acumulas; la rosa, el cansancio reciente. Cuando la rosa pasa a la azul vas cargado; con la azul por encima llegas fresco.">
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
        </div>
      )}

      {tab === 'carga' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Bloque titulo="Carga por semana" nota={semanaActual ? `Todos los deportes. Esta semana: ${semanaActual.tss} TSS · ${semanaActual.km} km de carrera · ${semanaActual.sesiones} sesiones` : undefined}>
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
      )}

      {tab === 'seguimiento' && <SeguimientoResultados clienteId={clienteId} />}

      {tab === 'entrenos' && (
        <div className="space-y-4">
          <SubirActividadFit clienteId={clienteId} onSubido={onActualizar} />
          <EntrenosTabla entrenos={datos.entrenos} titulo="Entrenos recientes (todos los deportes)" />
        </div>
      )}
    </div>
  )
}

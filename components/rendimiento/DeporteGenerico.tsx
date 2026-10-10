'use client'
import EntrenosTabla from './EntrenosTabla'
import ResumenDeporte from './ResumenDeporte'
import SubirActividadFit from './SubirActividadFit'
import { Pestanas, type DatosPanel } from './comun'
import { useEstadoUrl } from '@/lib/useEstadoUrl'
import { NOMBRE_DEPORTE, type DeporteConPanel } from '@/lib/rendimiento/deportes'

const TABS = [
  { key: 'resumen', titulo: 'Resumen' },
  { key: 'entrenos', titulo: 'Entrenos' },
] as const
type Tab = (typeof TABS)[number]['key']
const CLAVES = TABS.map(t => t.key)

/** Lo que se analizará de cada deporte cuando se construya su apartado específico. */
const PROXIMAMENTE: Record<Exclude<DeporteConPanel, 'running'>, string> = {
  ciclismo: 'potencia y FTP, curva de potencia, TSS por potencia, cadencia y eficiencia (vatios por latido).',
  natacion: 'ritmo por 100 m, SWOLF y brazadas por largo, distancia por sesión y ritmo crítico de nado (CSS).',
  fuerza: 'volumen por grupo muscular, tonelaje, RPE por sesión y progresión de cargas en los básicos.',
}

/** Apartado de un deporte sin análisis propio todavía: resumen de carga y lista de sesiones. */
export default function DeporteGenerico({ clienteId, deporte, datos, onActualizar }: { clienteId: string; deporte: Exclude<DeporteConPanel, 'running'>; datos: DatosPanel; onActualizar: () => void }) {
  const [tab, setTab] = useEstadoUrl<Tab>('rend', 'resumen', CLAVES)
  const resumen = datos.deportes.find(d => d.deporte === deporte)!
  const nombre = NOMBRE_DEPORTE[deporte]

  return (
    <div className="space-y-4">
      <Pestanas items={TABS} valor={tab} onChange={setTab} etiqueta={`Secciones de ${nombre.toLowerCase()}`} />

      {tab === 'resumen' && (
        <div className="space-y-4">
          <ResumenDeporte resumen={resumen} nombre={nombre} conKm={deporte !== 'fuerza'} />
          <p className="rounded-xl p-3 text-xs" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            El análisis específico de {nombre.toLowerCase()} se añadirá aquí: {PROXIMAMENTE[deporte]}
          </p>
        </div>
      )}

      {tab === 'entrenos' && (
        <div className="space-y-4">
          <SubirActividadFit clienteId={clienteId} onSubido={onActualizar} />
          <EntrenosTabla entrenos={resumen.entrenos} titulo={`Entrenos de ${nombre.toLowerCase()} recientes`} />
        </div>
      )}
    </div>
  )
}

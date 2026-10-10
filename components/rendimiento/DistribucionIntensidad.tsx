'use client'
import { Bloque, COLOR, fechaCorta } from './comun'
import type { DistribucionIntensidad as Distribucion, ResumenIntensidad, ValoracionIntensidad } from '@/lib/rendimiento/intensidad'

const COLOR_SUAVE = COLOR.fresc
const COLOR_MEDIA = COLOR.ambar
const COLOR_DURA = COLOR.fatiga

const LECTURA: Record<ValoracionIntensidad, { titulo: string; texto: string; color: string }> = {
  sin_datos: { titulo: 'Sin datos suficientes', texto: 'Hace falta al menos 1 hora de carrera con pulso en la ventana para calcular el reparto.', color: COLOR.carga },
  bien: { titulo: 'Base sólida', texto: 'La mayor parte del tiempo es fácil: ese es el reparto que usan los corredores de resistencia (alrededor del 80 % suave).', color: COLOR.fresc },
  zona_gris: { titulo: 'Demasiado en zona media', texto: 'Mucho tiempo en la zona 3: ni suficientemente fácil para recuperar ni suficientemente duro para estimular. Conviene pasar parte a suave y parte a series.', color: COLOR.ambar },
  muy_duro: { titulo: 'Demasiado intenso', texto: 'Casi todo el tiempo está en zonas 4-5. Sin una base fácil, el cuerpo acumula fatiga y la mejora se estanca.', color: COLOR.fatiga },
  mejorable: { titulo: 'Mejorable', texto: 'Hay algo de base fácil, pero por debajo del 75 % recomendado.', color: COLOR.ambar },
}

function Barra({ suave, media, dura, alto = 'h-3' }: { suave: number; media: number; dura: number; alto?: string }) {
  const total = suave + media + dura
  if (total <= 0) return <div className={`${alto} w-full rounded-full`} style={{ background: 'var(--bg-subtle)' }} />
  return (
    <div className={`flex ${alto} w-full overflow-hidden rounded-full`} style={{ background: 'var(--bg-subtle)' }}>
      <div style={{ width: `${(suave / total) * 100}%`, background: COLOR_SUAVE }} />
      <div style={{ width: `${(media / total) * 100}%`, background: COLOR_MEDIA }} />
      <div style={{ width: `${(dura / total) * 100}%`, background: COLOR_DURA }} />
    </div>
  )
}

function Ventana({ titulo, r }: { titulo: string; r: ResumenIntensidad }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{titulo}</p>
      {r.valoracion === 'sin_datos' ? (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Sin datos suficientes ({r.minutos} min con pulso)</p>
      ) : (
        <>
          <div className="mt-2"><Barra suave={r.pctSuave} media={r.pctMedia} dura={r.pctDura} alto="h-4" /></div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
            <span style={{ color: COLOR_SUAVE }}>Suave {r.pctSuave} %</span>
            <span style={{ color: COLOR_MEDIA }}>Media {r.pctMedia} %</span>
            <span style={{ color: COLOR_DURA }}>Dura {r.pctDura} %</span>
          </div>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>{Math.round(r.minutos / 60 * 10) / 10} h de carrera con pulso</p>
        </>
      )}
    </div>
  )
}

/** Cuánto del tiempo corriendo es suave, medio o duro (zonas de pulso de Garmin): el reparto 80/20 de los corredores de resistencia. */
export default function DistribucionIntensidad({ intensidad }: { intensidad: Distribucion }) {
  const { reciente, previo, semanas } = intensidad
  const lectura = LECTURA[reciente.valoracion]

  return (
    <Bloque titulo="Distribución de intensidad" nota="Suave = zonas 1-2 de Garmin, media = zona 3, dura = zonas 4-5. En corredores de resistencia suele funcionar alrededor de un 80 % suave y un 20 % duro, con poco en medio.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Ventana titulo="Últimas 4 semanas" r={reciente} />
        <Ventana titulo="Las 8 semanas anteriores" r={previo} />
      </div>

      <div className="mt-3 rounded-xl p-3" style={{ border: `1px solid ${lectura.color}` }}>
        <p className="text-sm font-semibold" style={{ color: lectura.color }}>{lectura.titulo}</p>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{lectura.texto}</p>
        {reciente.valoracion !== 'sin_datos' && reciente.valoracion !== 'bien' && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Ojo: las zonas dependen de cómo tenga Garmin configurado el pulso máximo. Si los rodajes tranquilos caen en zona 4, comprueba los límites de zona del reloj antes de concluir que el atleta corre demasiado fuerte.
          </p>
        )}
      </div>

      <p className="mb-1.5 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>Por semana (últimas 12). La línea vertical marca el 75 % suave.</p>
      <ul className="space-y-1.5">
        {[...semanas].reverse().map(s => {
          const total = s.suave + s.media + s.dura
          const pct = total > 0 ? Math.round((s.suave / total) * 100) : null
          return (
            <li key={s.semana} className="flex items-center gap-3 text-[11px]">
              <span className="w-10 shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>{fechaCorta(s.semana)}</span>
              <div className="relative flex-1">
                <Barra suave={s.suave} media={s.media} dura={s.dura} />
                <span className="pointer-events-none absolute inset-y-0" style={{ left: '75%', borderLeft: '1px dashed var(--text-muted)' }} />
              </div>
              <span className="w-24 shrink-0 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {pct === null ? 'sin carrera' : `${pct} % suave · ${Math.round(total / 60)} min`}
              </span>
            </li>
          )
        })}
      </ul>
    </Bloque>
  )
}

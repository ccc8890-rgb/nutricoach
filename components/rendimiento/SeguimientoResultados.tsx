'use client'
import { useEffect, useState } from 'react'
import { Bloque, COLOR, Tarjeta, fechaCorta } from './comun'
import { CLAVES_METRICA, METRICAS, VENTANA_DIAS, type ClaveMetrica, type Evaluacion, type Lectura, type Veredicto } from '@/lib/rendimiento/seguimiento'
import type { Intervencion } from '@/lib/rendimiento/intervenciones'

type Respuesta = {
  hoy: string
  fcUmbral: number | null
  lineaBase: { desde: string; hasta: string; indicadores: Record<ClaveMetrica, number | null> }
  intervenciones: (Intervencion & { evaluacion: Evaluacion })[]
}

const VEREDICTO: Record<Veredicto, { texto: string; color: string }> = {
  pendiente: { texto: 'Pronto para juzgar', color: COLOR.carga },
  sin_datos: { texto: 'Sin datos suficientes', color: COLOR.carga },
  funciona: { texto: 'Está funcionando', color: COLOR.fresc },
  no_se_nota: { texto: 'No se nota cambio', color: COLOR.ambar },
  empeora: { texto: 'Va a peor', color: COLOR.fatiga },
}
const COLOR_LECTURA: Record<Lectura, string> = {
  mejora: COLOR.fresc, empeora: COLOR.fatiga, igual: COLOR.carga, sube: COLOR.forma, baja: COLOR.forma, sin_datos: COLOR.carga,
}
const TEXTO_LECTURA: Record<Lectura, string> = { mejora: 'Mejora', empeora: 'Empeora', igual: 'Igual', sube: 'Sube', baja: 'Baja', sin_datos: '—' }
const TIPO: Record<Intervencion['tipo'], string> = { cambio_sesion: 'Cambio de sesión', semana_plan: 'Semana del plan' }

const fmt = (clave: ClaveMetrica, v: number | null) => (v === null ? '—' : `${v.toFixed(METRICAS[clave].decimales)}`)

/** Qué pasó con el atleta tras cada cambio aplicado al plan: indicadores de las 4 semanas anteriores frente a las posteriores. */
export default function SeguimientoResultados({ clienteId }: { clienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes/${clienteId}/rendimiento/seguimiento`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Error al cargar'); return r.json() })
      .then(j => { if (vivo) setDatos(j) })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar') })
    return () => { vivo = false }
  }, [clienteId])

  if (error) return <p className="py-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!datos) return <div className="h-48 animate-pulse rounded-2xl" style={{ background: 'var(--surface)' }} />

  const b = datos.lineaBase.indicadores

  return (
    <div className="space-y-4">
      <Bloque titulo="Línea base de hoy" nota={`Últimas 4 semanas (del ${fechaCorta(datos.lineaBase.desde)} al ${fechaCorta(datos.lineaBase.hasta)}). Es la referencia con la que se compararán los próximos cambios.`}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CLAVES_METRICA.map(c => (
            <Tarjeta key={c} titulo={METRICAS[c].nombre} valor={fmt(c, b[c])} pie={METRICAS[c].unidad} />
          ))}
        </div>
        {datos.fcUmbral === null && (
          <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>Sin el pulso de umbral del atleta no se puede calcular el tiempo suave.</p>
        )}
      </Bloque>

      <Bloque titulo="Cambios aplicados y su resultado" nota={`Cada cambio que se aplica al plan (una decisión del entrenador IA o una semana del plan hacia la carrera) se compara ${VENTANA_DIAS} días antes frente a ${VENTANA_DIAS} días después con los datos del reloj.`}>
        {datos.intervenciones.length === 0 ? (
          <p className="py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Todavía no se ha aplicado ningún cambio al plan. Cuando apliques una decisión del entrenador IA desde Resumen, o una semana del plan hacia la carrera, aparecerá aquí y se irá evaluando sola a medida que entrene el atleta.
          </p>
        ) : (
          <ul className="space-y-3">
            {datos.intervenciones.map(i => {
              const ev = i.evaluacion
              const v = VEREDICTO[ev.veredicto]
              const faltan = Math.max(0, VENTANA_DIAS - ev.dias)
              return (
                <li key={i.id} className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{i.titulo}</p>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{TIPO[i.tipo]} · aplicado el {fechaCorta(i.fecha)} · hace {ev.dias} días</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: v.color, border: `1px solid ${v.color}` }}>{v.texto}</span>
                  </div>
                  {i.descripcion && <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{i.descripcion}</p>}
                  {i.objetivo && (
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Buscaba mejorar: <strong>{METRICAS[i.objetivo.clave].nombre.toLowerCase()}</strong>{i.objetivo.direccion ? ` (${i.objetivo.direccion === 'sube' ? 'que suba' : 'que baje'})` : ''}
                    </p>
                  )}
                  {ev.estado !== 'evaluable' && (
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      {ev.estado === 'en_curso' ? `Es pronto: ` : 'Resultado parcial: '}faltan {faltan} días para tener las 4 semanas completas.
                    </p>
                  )}

                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                      <thead><tr style={{ color: 'var(--text-muted)' }}><th className="py-1 pr-3 font-medium">Indicador</th><th className="pr-3 font-medium">Antes</th><th className="pr-3 font-medium">Después</th><th className="font-medium">Cambio</th></tr></thead>
                      <tbody>
                        {ev.metricas.map(m => (
                          <tr key={m.clave} style={{ borderTop: '1px solid var(--border-light)', fontWeight: m.esObjetivo ? 600 : 400 }}>
                            <td className="py-1 pr-3" style={{ color: 'var(--text)' }}>{m.nombre}{m.esObjetivo ? ' ★' : ''} <span style={{ color: 'var(--text-muted)' }}>({m.unidad})</span></td>
                            <td className="pr-3 tabular-nums">{fmt(m.clave, m.antes)}</td>
                            <td className="pr-3 tabular-nums">{fmt(m.clave, m.despues)}</td>
                            <td style={{ color: COLOR_LECTURA[m.lectura] }}>
                              {m.delta !== null && <span className="tabular-nums">{m.delta > 0 ? '+' : ''}{fmt(m.clave, m.delta)} · </span>}{TEXTO_LECTURA[m.lectura]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Es un antes y después, no una prueba de que el cambio sea la causa: el calor, el descanso, una carrera o una semana de descarga también mueven estas cifras. ★ marca el indicador que el cambio buscaba mejorar. Con menos de 2 carreras con datos en una ventana, la deriva y la eficiencia salen sin datos.
        </p>
      </Bloque>
    </div>
  )
}

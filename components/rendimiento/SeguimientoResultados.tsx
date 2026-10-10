'use client'
import { useCallback, useEffect, useState } from 'react'
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
const TIPO: Record<Intervencion['tipo'], string> = { cambio_sesion: 'Cambio de sesión', semana_plan: 'Semana del plan', hito: 'Cambio anotado' }

const fmt = (clave: ClaveMetrica, v: number | null) => (v === null ? '—' : `${v.toFixed(METRICAS[clave].decimales)}`)

/** Qué pasó con el atleta tras cada cambio aplicado al plan: indicadores de las 4 semanas anteriores frente a las posteriores. */
const CAMPO = { background: 'var(--surface)', border: '1px solid var(--border-strong)', color: 'var(--text)' }

/** Formulario para anotar un cambio de entrenamiento (fecha, qué se hizo y qué se espera mejorar). */
function AnotarCambio({ clienteId, hoy, onGuardado }: { clienteId: string; hoy: string; onGuardado: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoy)
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [metrica, setMetrica] = useState<'' | ClaveMetrica>('')
  const [direccion, setDireccion] = useState<'sube' | 'baja'>('sube')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const conDireccion = metrica === 'carga_semana' || metrica === 'km_semana'

  async function guardar() {
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch(`/api/clientes/${clienteId}/rendimiento/hitos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, titulo, descripcion, metrica_objetivo: metrica || undefined, direccion: conDireccion ? direccion : undefined }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'No se pudo guardar el cambio.')
      setTitulo(''); setDescripcion(''); setMetrica(''); setAbierto(false)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el cambio.')
    } finally {
      setEnviando(false)
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="rounded-lg px-3 py-2 text-sm font-medium" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
        + Anotar un cambio
      </button>
    )
  }
  return (
    <div className="space-y-2 rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-light)' }}>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Anota un cambio que no pasa por el plan (más rodajes fáciles, material nuevo, vuelta tras una lesión…). Se medirá igual que los demás.</p>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Desde cuándo
          <input type="date" value={fecha} max={hoy} onChange={e => setFecha(e.target.value)} className="mt-0.5 w-full rounded-md px-2 py-1.5 text-sm" style={CAMPO} />
        </label>
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Qué cambia
          <input value={titulo} maxLength={100} onChange={e => setTitulo(e.target.value)} placeholder="Ej.: rodajes a ritmo conversacional" className="mt-0.5 w-full rounded-md px-2 py-1.5 text-sm" style={CAMPO} />
        </label>
      </div>
      <label className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Detalle (opcional)
        <textarea value={descripcion} maxLength={400} rows={2} onChange={e => setDescripcion(e.target.value)} className="mt-0.5 w-full rounded-md px-2 py-1.5 text-sm" style={CAMPO} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Qué esperas mejorar (opcional)
          <select value={metrica} onChange={e => setMetrica(e.target.value as '' | ClaveMetrica)} className="mt-0.5 w-full rounded-md px-2 py-1.5 text-sm" style={CAMPO}>
            <option value="">Nada concreto: juzgar por el conjunto</option>
            {CLAVES_METRICA.map(c => <option key={c} value={c}>{METRICAS[c].nombre}</option>)}
          </select>
        </label>
        {conDireccion && (
          <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>En qué sentido
            <select value={direccion} onChange={e => setDireccion(e.target.value as 'sube' | 'baja')} className="mt-0.5 w-full rounded-md px-2 py-1.5 text-sm" style={CAMPO}>
              <option value="sube">Que suba</option>
              <option value="baja">Que baje</option>
            </select>
          </label>
        )}
      </div>
      {error && <p className="text-xs" style={{ color: COLOR.fatiga }} role="alert">{error}</p>}
      <div className="flex gap-2">
        <button onClick={() => void guardar()} disabled={enviando || !titulo.trim()} className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60" style={{ background: 'var(--surface-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text)' }}>
          {enviando ? 'Guardando…' : 'Guardar cambio'}
        </button>
        <button onClick={() => { setAbierto(false); setError(null) }} className="rounded-lg px-3 py-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>Cancelar</button>
      </div>
    </div>
  )
}

export default function SeguimientoResultados({ clienteId }: { clienteId: string }) {
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const cargar = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    let vivo = true
    fetch(`/api/clientes/${clienteId}/rendimiento/seguimiento`, { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Error al cargar'); return r.json() })
      .then(j => { if (vivo) { setDatos(j); setError(null) } })
      .catch(e => { if (vivo) setError(e instanceof Error ? e.message : 'Error al cargar') })
    return () => { vivo = false }
  }, [clienteId, version])

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
        <div className="mb-3"><AnotarCambio clienteId={clienteId} hoy={datos.hoy} onGuardado={cargar} /></div>
        {datos.intervenciones.length === 0 ? (
          <p className="py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Todavía no hay ningún cambio registrado. Cuando apliques una decisión del entrenador IA, una semana del plan hacia la carrera, o anotes un cambio tú, aparecerá aquí y se irá evaluando solo a medida que entrene el atleta.
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
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ color: v.color, border: `1px solid ${v.color}` }}>{v.texto}</span>
                      {i.tipo === 'hito' && (
                        <button onClick={async () => { if (!window.confirm('¿Quitar este cambio anotado?')) return; await fetch(`/api/clientes/${clienteId}/rendimiento/hitos?id=${encodeURIComponent(i.id)}`, { method: 'DELETE' }); cargar() }}
                          className="text-[11px] underline" style={{ color: 'var(--text-muted)' }}>Quitar</button>
                      )}
                    </div>
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

'use client'
import { useEffect, useState } from 'react'
import { Trophy, Zap, ChevronDown, ChevronUp } from 'lucide-react'

interface PREntry {
  ejercicio_id: string
  ejercicio_nombre: string
  grupo_muscular: string
  peso_max_kg: number
  reps_en_pr: number
  volumen_pr: number
  fecha: string
}

interface EjercicioLog {
  id: string
  ejercicio_id: string
  ejercicio_nombre: string
  grupo_muscular: string
  sets_ejecutados: { set_num: number; reps?: number; peso_kg?: number }[]
}

interface SesionDia {
  fecha: string
  duracion_sesion_s: number | null
  esfuerzo_percibido: number | null
  ejercicios: EjercicioLog[]
}

const RPE_LABEL: Record<number, string> = {
  1: 'Muy ligero', 2: 'Ligero', 3: 'Ligero', 4: 'Moderado', 5: 'Moderado',
  6: 'Algo intenso', 7: 'Intenso', 8: 'Muy intenso', 9: 'Casi máximo', 10: 'Máximo',
}

function rpeColor(rpe: number): string {
  if (rpe <= 4) return 'rgba(34,197,94,0.8)'
  if (rpe <= 6) return 'rgba(234,179,8,0.9)'
  if (rpe <= 8) return 'rgba(249,115,22,0.9)'
  return 'rgba(239,68,68,0.9)'
}

function formatFecha(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}

function formatDuracion(s: number): string {
  const min = Math.round(s / 60)
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`
}

export default function HistorialEntreno({ clienteId }: { clienteId: string }) {
  const [prs, setPrs] = useState<PREntry[]>([])
  const [sesiones, setSesiones] = useState<SesionDia[]>([])
  const [loading, setLoading] = useState(true)
  const [diasFiltro, setDiasFiltro] = useState(60)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    fetch(`/api/clientes/${clienteId}/historial-entreno?dias=${diasFiltro}`)
      .then(r => r.json())
      .then(d => {
        setPrs(d.prs ?? [])
        setSesiones(d.sesiones ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [clienteId, diasFiltro])

  function toggleSesion(fecha: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(fecha) ? next.delete(fecha) : next.add(fecha)
      return next
    })
  }

  if (loading) return (
    <div className="flex flex-col gap-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: 'rgba(128,128,128,0.08)' }} />
      ))}
    </div>
  )

  const totalSets = sesiones.reduce((acc, s) => acc + s.ejercicios.reduce((a, e) => a + e.sets_ejecutados.length, 0), 0)
  const totalSesiones = sesiones.length

  return (
    <div className="flex flex-col gap-6">
      {/* Filter + summary strip */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {[30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDiasFiltro(d)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
              style={diasFiltro === d
                ? { background: 'rgba(168,85,247,0.2)', color: 'rgb(192,132,252)', border: '1px solid rgba(168,85,247,0.4)' }
                : { background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)', border: '1px solid transparent' }
              }
            >
              {d}d
            </button>
          ))}
        </div>
        {totalSesiones > 0 && (
          <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span><strong style={{ color: 'var(--text)' }}>{totalSesiones}</strong> sesiones</span>
            <span><strong style={{ color: 'var(--text)' }}>{totalSets}</strong> sets totales</span>
          </div>
        )}
      </div>

      {/* PRs */}
      {prs.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={15} style={{ color: 'rgb(201,169,110)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Records personales</h3>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {prs.map(pr => (
              <div
                key={pr.ejercicio_id}
                className="rounded-xl px-3.5 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold mb-1.5 leading-tight" style={{ color: 'var(--text)' }}>
                  {pr.ejercicio_nombre}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-bold tabular-nums" style={{ color: 'rgb(201,169,110)' }}>
                    {pr.peso_max_kg}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>kg</span>
                  <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                    × {pr.reps_en_pr} reps
                  </span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {formatFecha(pr.fecha)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Session log */}
      {sesiones.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} style={{ color: 'rgb(168,85,247)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Sesiones recientes</h3>
          </div>
          <div className="flex flex-col gap-2">
            {sesiones.map(sesion => {
              const isOpen = expanded.has(sesion.fecha)
              const totalVol = sesion.ejercicios.reduce((acc, ej) => {
                return acc + ej.sets_ejecutados.reduce((s, set) => {
                  return s + ((set.peso_kg ?? 0) * (set.reps ?? 0))
                }, 0)
              }, 0)

              return (
                <div
                  key={sesion.fecha}
                  className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  {/* Row header */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 text-left"
                    onClick={() => toggleSesion(sesion.fecha)}
                  >
                    {/* Date badge */}
                    <div
                      className="flex-shrink-0 text-center w-10"
                    >
                      <p className="text-[11px] font-semibold uppercase leading-none" style={{ color: 'var(--text-muted)' }}>
                        {new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                      </p>
                      <p className="text-xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
                        {new Date(sesion.fecha + 'T12:00:00').getDate()}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium capitalize" style={{ color: 'var(--text)' }}>
                        {new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long' })}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {sesion.ejercicios.length} ej.
                        </span>
                        {sesion.duracion_sesion_s && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            · {formatDuracion(sesion.duracion_sesion_s)}
                          </span>
                        )}
                        {totalVol > 0 && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            · {Math.round(totalVol)} kg vol.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {sesion.esfuerzo_percibido && (
                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            background: rpeColor(sesion.esfuerzo_percibido).replace('0.8', '0.12').replace('0.9', '0.12'),
                            color: rpeColor(sesion.esfuerzo_percibido),
                          }}
                        >
                          RPE {sesion.esfuerzo_percibido}
                        </span>
                      )}
                      {isOpen
                        ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
                      }
                    </div>
                  </button>

                  {/* Expanded: exercise breakdown */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid var(--border)' }}>
                      {sesion.ejercicios.map(ej => {
                        const setsConPeso = ej.sets_ejecutados.filter(s => s.peso_kg)
                        const maxPeso = setsConPeso.length
                          ? Math.max(...setsConPeso.map(s => s.peso_kg!))
                          : null

                        return (
                          <div
                            key={ej.id}
                            className="px-4 py-3 flex items-start gap-3"
                            style={{ borderBottom: '1px solid var(--border)' }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                                  {ej.ejercicio_nombre}
                                </p>
                                {ej.grupo_muscular && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(128,128,128,0.1)', color: 'var(--text-muted)' }}>
                                    {ej.grupo_muscular}
                                  </span>
                                )}
                              </div>
                              {/* Sets inline */}
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {ej.sets_ejecutados.map((s, si) => (
                                  <span
                                    key={si}
                                    className="text-[11px] px-2 py-0.5 rounded-md font-medium"
                                    style={{ background: 'rgba(168,85,247,0.08)', color: 'rgb(168,85,247)' }}
                                  >
                                    {s.reps ?? '?'}{s.peso_kg ? `×${s.peso_kg}kg` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {maxPeso && (
                              <div className="text-right flex-shrink-0">
                                <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>{maxPeso} kg</p>
                                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>máx</p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-xl text-center py-12" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Zap size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Sin sesiones registradas</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Aparecerán aquí cuando el cliente complete sesiones desde la app
          </p>
        </div>
      )}
    </div>
  )
}

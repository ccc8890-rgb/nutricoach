'use client'

import { useEffect, useState } from 'react'
import { Activity, ChevronDown, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react'

interface SesionReciente {
    fecha: string
    tipo_actividad: string
    duracion_min: number
    rpe: number
    tls_diario: number
    notas: string | null
}

export interface TLSData {
    tls_semana_actual: number
    num_sesiones: number
    tls_promedio_4sem: number
    umbral: number
    porcentaje_umbral: number
    semaforo: 'bajo' | 'normal' | 'alto' | 'muy_alto'
    sesiones_recientes: SesionReciente[] | null
}

const TIPO_LABELS: Record<string, string> = {
    running: 'Running',
    gym: 'Gym',
    hyrox: 'Hyrox',
    crossfit: 'CrossFit',
    ciclismo: 'Ciclismo',
    natacion: 'Natación',
    trail: 'Trail',
    yoga: 'Yoga',
    otro: 'Otro',
}

const ESTADO_LABEL: Record<TLSData['semaforo'], string> = {
    bajo: 'Carga baja',
    normal: 'Carga en rango',
    alto: 'Carga alta',
    muy_alto: 'Revisar recuperación',
}

interface TLSGaugeProps {
    codigo: string
    onRegistrar: () => void
}

export function TLSPanel({ data, onRegistrar }: { data: TLSData; onRegistrar: () => void }) {
    const [expandido, setExpandido] = useState(false)
    const pct = Math.min(Math.max(data.porcentaje_umbral, 0), 130)
    const progress = pct / 130
    const tendencia = data.tls_semana_actual > data.tls_promedio_4sem * 1.1
        ? 'up'
        : data.tls_semana_actual < data.tls_promedio_4sem * 0.9
            ? 'down'
            : 'stable'

    return (
        <section className={`tls-instrument is-${data.semaforo}`} aria-labelledby="tls-title">
            <header className="tls-instrument__header">
                <div>
                    <p className="editorial-kicker">03 / LOAD</p>
                    <h2 id="tls-title">Carga semanal</h2>
                </div>
                <button type="button" onClick={onRegistrar} className="tls-instrument__register">
                    Registrar sesión <span aria-hidden="true">↗</span>
                </button>
            </header>

            <div className="tls-instrument__readout">
                <div className="tls-instrument__primary">
                    <output>{data.tls_semana_actual}</output>
                    <span>PTS / SEM</span>
                </div>
                <dl className="tls-instrument__telemetry">
                    <div><dt>Media 4 sem</dt><dd>{data.tls_promedio_4sem}</dd></div>
                    <div><dt>Umbral</dt><dd>{data.umbral}</dd></div>
                    <div><dt>Sesiones</dt><dd>{data.num_sesiones}</dd></div>
                    <div>
                        <dt>Tendencia</dt>
                        <dd aria-label={tendencia === 'up' ? 'Subiendo' : tendencia === 'down' ? 'Bajando' : 'Estable'}>
                            {tendencia === 'up' ? <TrendingUp size={14} /> : tendencia === 'down' ? <TrendingDown size={14} /> : <Minus size={14} />}
                        </dd>
                    </div>
                </dl>
            </div>

            <div
                className="tls-instrument__progress"
                role="progressbar"
                aria-label="Carga respecto al umbral"
                aria-valuemin={0}
                aria-valuemax={130}
                aria-valuenow={pct}
            >
                <span style={{ transform: `scaleX(${progress})` }} />
                <i aria-hidden="true" />
            </div>

            <div className="tls-instrument__status">
                <span>{ESTADO_LABEL[data.semaforo]}</span>
                <samp>{pct}% DEL RANGO</samp>
            </div>

            {data.sesiones_recientes && data.sesiones_recientes.length > 0 ? (
                <div className="tls-instrument__history">
                    <button type="button" onClick={() => setExpandido(value => !value)} aria-expanded={expandido}>
                        <span>Últimas sesiones</span>
                        {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandido ? (
                        <div>
                            {data.sesiones_recientes.map((sesion, index) => (
                                <article key={`${sesion.fecha}-${index}`}>
                                    <span>{String(index + 1).padStart(2, '0')}</span>
                                    <div>
                                        <strong>{TIPO_LABELS[sesion.tipo_actividad] ?? sesion.tipo_actividad}</strong>
                                        <small>{new Date(sesion.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · {sesion.duracion_min} min · RPE {sesion.rpe}</small>
                                    </div>
                                    <samp>{sesion.tls_diario} PTS</samp>
                                </article>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </section>
    )
}

export default function TLSGauge({ codigo, onRegistrar }: TLSGaugeProps) {
    const [data, setData] = useState<TLSData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/cliente/${codigo}/registrar-entreno`)
            .then(response => response.json())
            .then(payload => { setData(payload); setLoading(false) })
            .catch(() => setLoading(false))
    }, [codigo])

    if (loading) {
        return (
            <div className="tls-instrument tls-instrument--loading" aria-label="Cargando carga de entrenamiento">
                <div /><div /><div />
            </div>
        )
    }

    if (!data || data.tls_semana_actual === undefined) {
        return (
            <section className="tls-instrument tls-instrument--empty">
                <Activity size={18} aria-hidden="true" />
                <div>
                    <p className="editorial-kicker">03 / LOAD</p>
                    <h2>Sin carga registrada</h2>
                    <p>Registra tu primera sesión para activar esta lectura.</p>
                </div>
                <button type="button" onClick={onRegistrar}>Registrar sesión ↗</button>
            </section>
        )
    }

    return <TLSPanel data={data} onRegistrar={onRegistrar} />
}

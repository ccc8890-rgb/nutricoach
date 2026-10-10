'use client'

import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'

const TIPO_FUNDAMENTO: Record<string, string> = { estudio: 'Estudio', libro: 'Libro de entrenador', criterio: 'Criterio' }

export default function PropuestaPlanEntreno({ payload }: { payload: PayloadPlanEntrenoIA }) {
  const sesiones = ((payload.plan?.sesiones as { nombre?: string; dia_semana?: string | null }[]) ?? [])
  const semana1 = payload.macrociclo?.semanas?.[0]
  const hallazgos = payload.validacion?.hallazgos ?? []
  const fundamentos = payload.macrociclo?.fundamentos ?? []
  return (
    <div className="space-y-3 text-sm" style={{ color: 'var(--text)' }}>
      <p><strong>{payload.nombre_plan}</strong>{payload.duracion_semanas ? ` · ${payload.duracion_semanas} semanas` : ''}</p>
      {semana1 && <p style={{ color: 'var(--text-muted)' }}>Esqueleto del motor, semana 1 ({semana1.fase}): {semana1.salidas} sesiones de carrera, {semana1.minutos} min, tirada de {semana1.tiradaMin} min.</p>}
      <ul className="space-y-1">{sesiones.map((s, i) => <li key={i}>{s.dia_semana ? `${s.dia_semana} · ` : ''}{s.nombre}</li>)}</ul>
      {hallazgos.length > 0 && (
        <div><p className="font-semibold">Avisos del validador</p><ul className="space-y-1">{hallazgos.map((h, i) => <li key={i}>{h.nivel === 'error' ? '⛔' : '⚠️'} {h.texto}</li>)}</ul></div>
      )}
      {payload.macrociclo?.datosFaltantes?.length ? <p style={{ color: 'var(--text-muted)' }}>Datos que faltan: {payload.macrociclo.datosFaltantes.join('; ')}.</p> : null}
      {fundamentos.length > 0 && (
        <div><p className="font-semibold">De dónde sale cada regla</p><ul className="space-y-1">{fundamentos.map((f, i) => <li key={i}><span className="font-medium">[{TIPO_FUNDAMENTO[f.tipo] ?? f.tipo}]</span> {f.regla} — <span style={{ color: 'var(--text-muted)' }}>{f.fuente}</span></li>)}</ul></div>
      )}
    </div>
  )
}

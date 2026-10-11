'use client'

import { resumirPropuesta, TEXTO_ESTADO, type EstadoPresentacion } from '@/lib/rendimiento/presentacion'
import type { PayloadPlanEntrenoIA } from '@/lib/entrenos/planificar-con-ia'
import type { EvidenciaPlan } from '@/lib/entrenos/evidencia-plan'

// Estructura y contenido de la propuesta de plan; el acabado visual lo pule Codex (ver docs/10-10-2026_traspaso-codex-presentacion.md).
const COLOR_ESTADO: Record<EstadoPresentacion, string> = { ok: '#6AAF85', mirar: '#C8A96A', revisar: '#E0557A' }

export default function PropuestaPlanEntreno({ payload }: { payload: PayloadPlanEntrenoIA }) {
  const r = resumirPropuesta(payload)
  const evidencia = ((payload.plan as Record<string, unknown> | undefined)?._evidencia ?? null) as EvidenciaPlan | null
  return (
    <div className="space-y-3 text-sm" style={{ color: 'var(--text)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ border: `1px solid ${COLOR_ESTADO[r.estado]}`, color: COLOR_ESTADO[r.estado] }}>{TEXTO_ESTADO[r.estado]}</span>
        <p className="font-semibold">{r.titular}</p>
      </div>

      <section>
        <p className="text-xs font-semibold">Qué cambia</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {r.queCambia.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </section>

      <section>
        <p className="text-xs font-semibold">La semana</p>
        <ul className="mt-1 space-y-0.5 text-xs">
          {r.semana.map((s, i) => (
            <li key={i}>
              {s.dia && <span className="font-medium capitalize">{s.dia} · </span>}{s.nombre}
              {s.detalle && <span style={{ color: 'var(--text-muted)' }}> · {s.detalle}</span>}
            </li>
          ))}
        </ul>
      </section>

      {evidencia && evidencia.decisiones.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer select-none font-semibold">Por qué este plan ({evidencia.decisiones.filter(d => d.tipo === 'estudio').length} decisiones con estudios · {evidencia.estudiosCitados.length} estudios)</summary>
          <ul className="mt-2 space-y-2">
            {evidencia.decisiones.map((d, i) => (
              <li key={i}>
                <p className="font-medium">{d.decision}</p>
                {d.motivo && <p style={{ color: 'var(--text-secondary)' }}>{d.motivo}</p>}
                {d.estudios.length > 0
                  ? <ul className="mt-0.5 list-disc pl-5" style={{ color: 'var(--text-muted)' }}>
                      {d.estudios.map((e, j) => (
                        <li key={j}>{e.doi ? <a href={`https://doi.org/${e.doi}`} target="_blank" rel="noreferrer" className="underline">{e.titulo}</a> : e.titulo}{e.anio ? ` (${e.anio})` : ''}</li>
                      ))}
                    </ul>
                  : <p style={{ color: 'var(--text-muted)' }}>Criterio de entrenador (sin estudio de la base que lo respalde directamente).</p>}
              </li>
            ))}
          </ul>
          {(evidencia.clavesInventadas > 0 || evidencia.autoresNoVerificables.length > 0) && (
            <p className="mt-2" style={{ color: COLOR_ESTADO.mirar }}>
              Aviso: el modelo citó {evidencia.clavesInventadas > 0 ? `${evidencia.clavesInventadas} clave(s) que no existían (descartadas)` : ''}{evidencia.clavesInventadas > 0 && evidencia.autoresNoVerificables.length > 0 ? ' y ' : ''}{evidencia.autoresNoVerificables.length > 0 ? `autores que no están en la base (${evidencia.autoresNoVerificables.join(', ')})` : ''}. Revisa esas partes.
            </p>
          )}
        </details>
      )}

      {r.revisar.length > 0 && (
        <section>
          <p className="text-xs font-semibold">Revisar antes de aprobar</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {r.revisar.map((h, i) => <li key={i}>{h.grave ? '⛔' : '⚠️'} {h.texto}</li>)}
          </ul>
        </section>
      )}

      {r.faltan.length > 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Faltan datos para afinar: {r.faltan.join('; ')}.</p>}

      {r.fundamentos.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs" style={{ color: 'var(--text-muted)' }}>Por qué · {r.fundamentos.length} reglas con su origen</summary>
          <ul className="mt-1 space-y-1 text-xs">
            {r.fundamentos.map((f, i) => (
              <li key={i}>
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ border: '1px solid var(--border-strong)', color: 'var(--text-secondary)' }}>{f.tipo}</span>{' '}
                {f.regla} — <span style={{ color: 'var(--text-muted)' }}>{f.fuente}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

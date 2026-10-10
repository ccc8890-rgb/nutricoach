'use client'
import { Bloque, ZONAS_FC, fechaCorta, mmss, tipoLegible } from './comun'
import { esCarrera } from '@/lib/rendimiento/carga'
import type { EntrenoPanel } from '@/lib/rendimiento/panel'

/** Tabla de entrenos recientes (de cualquier deporte). El ritmo solo se muestra en carrera. */
export default function EntrenosTabla({ entrenos, titulo = 'Entrenos recientes' }: { entrenos: EntrenoPanel[]; titulo?: string }) {
  return (
    <Bloque titulo={titulo} nota="La barra de color es el tiempo en cada zona de pulso (de suave a máximo).">
      {entrenos.length === 0 ? (
        <p className="py-3 text-xs" style={{ color: 'var(--text-muted)' }}>Todavía no hay entrenos de este deporte.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }}>
                <th className="py-1.5 pr-3 font-medium">Fecha</th><th className="pr-3 font-medium">Sesión</th><th className="pr-3 font-medium">Tiempo</th>
                <th className="pr-3 font-medium">Km</th><th className="pr-3 font-medium">Ritmo</th><th className="pr-3 font-medium">Pulso</th>
                <th className="pr-3 font-medium">TSS</th><th className="font-medium">Zonas</th>
              </tr>
            </thead>
            <tbody>
              {entrenos.map((e, i) => {
                const z = e.tiempo_zona_fc
                const tot = z ? z.reduce((a, b) => a + b, 0) : 0
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                    <td className="py-1.5 pr-3 tabular-nums">{fechaCorta(e.fecha)}</td>
                    <td className="pr-3"><span style={{ color: 'var(--text)' }}>{e.nombre ?? '—'}</span> <span style={{ color: 'var(--text-muted)' }}>· {tipoLegible[e.tipo ?? ''] ?? e.tipo}</span></td>
                    <td className="pr-3 tabular-nums">{e.duracion_s ? `${Math.round(e.duracion_s / 60)} min` : '—'}</td>
                    <td className="pr-3 tabular-nums">{e.distancia_m && e.distancia_m > 0 ? (e.distancia_m / 1000).toFixed(1) : '—'}</td>
                    <td className="pr-3 tabular-nums">{esCarrera(e.tipo) && e.ritmo_medio_s_km ? mmss(e.ritmo_medio_s_km) : '—'}</td>
                    <td className="pr-3 tabular-nums">{e.fc_media ?? '—'}</td>
                    <td className="pr-3 font-semibold tabular-nums">{e.tss !== null ? Math.round(e.tss) : '—'}</td>
                    <td className="w-28">
                      {z && tot > 0 ? (
                        <div className="flex h-2 w-28 overflow-hidden rounded-full">
                          {z.map((s, k) => <div key={k} style={{ width: `${(s / tot) * 100}%`, background: ZONAS_FC[k] }} />)}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Bloque>
  )
}

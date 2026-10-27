'use client'

import PanelEstudio from '@/components/recetas/PanelEstudio'
import { resumenParametros, type ParametrosTecnica } from '@/lib/tecnicas'

export type TecnicaCliente = {
  id: string; nombre: string; familia: string | null; descripcion: string | null; principio: string | null; pasos: string | null
  errores_tipicos: string | null; variantes: string | null; seguridad: string | null; origen: string | null; parametros: ParametrosTecnica | null
}

const mono = { fontFamily: 'var(--font-mono, monospace)' } as const

function Bloque({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null
  return (
    <div className="pt-3">
      <p className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ ...mono, color: 'var(--text-muted)' }}>{titulo}</p>
      <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--text)' }}>{texto}</p>
    </div>
  )
}

/** Capa profesional de la receta para clientes con acceso profesional: Estudio y técnicas que usa. */
export default function EstudioCliente({ estudio, factor, tecnicas }: { estudio: unknown; factor: number; tecnicas: TecnicaCliente[] }) {
  return (
    <div className="flex flex-col gap-3">
      <PanelEstudio estudio={estudio} factor={factor} />
      {tecnicas.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ ...mono, color: 'var(--text-muted)' }}>Técnicas que usa</p>
          {tecnicas.map(t => {
            const resumen = resumenParametros(t.parametros)
            return (
              <details key={t.id} className="px-4 py-3" style={{ border: '1px solid var(--border)' }}>
                <summary className="cursor-pointer text-base" style={{ color: 'var(--text)' }}>
                  {t.nombre}
                  {resumen && <span className="block text-xs mt-0.5" style={{ ...mono, color: 'var(--text-secondary)' }}>{resumen}</span>}
                </summary>
                <Bloque titulo="Qué es" texto={t.descripcion} />
                <Bloque titulo="Principio" texto={t.principio} />
                <Bloque titulo="Paso a paso" texto={t.pasos} />
                <Bloque titulo="Errores típicos" texto={t.errores_tipicos} />
                <Bloque titulo="Variantes" texto={t.variantes} />
                <Bloque titulo="Seguridad" texto={t.seguridad} />
                <Bloque titulo="Origen" texto={t.origen} />
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}

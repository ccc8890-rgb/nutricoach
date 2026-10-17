import { ASPECTOS_IDS, TAG_CORREGIR } from '@/lib/recetas/correcciones'

// Reportar una receta: la saca del circuito (en_revision) con la etiqueta «Corregir» y deja constancia del origen.
export const TAG_REPORTE_CLIENTE = 'Reporte cliente'

export const ORIGENES_REPORTE = [
  { id: 'propio', label: 'Lo he visto yo' },
  { id: 'cliente', label: 'Lo ha reportado un cliente' },
] as const

export type OrigenReporte = (typeof ORIGENES_REPORTE)[number]['id']
export type ReporteValido = { aspectos: string[]; nota: string; origen: OrigenReporte }

export function validarReporte(e: { aspectos: unknown; nota: unknown; origen: unknown }):
  { ok: true; reporte: ReporteValido } | { ok: false; error: string } {
  const origen = ORIGENES_REPORTE.find(o => o.id === e.origen)?.id
  if (!origen) return { ok: false, error: 'Origen no válido' }
  const aspectos = Array.isArray(e.aspectos)
    ? e.aspectos.filter((x): x is string => typeof x === 'string' && ASPECTOS_IDS.includes(x))
    : []
  const nota = typeof e.nota === 'string' ? e.nota.trim().slice(0, 600) : ''
  if (aspectos.length === 0 && !nota) return { ok: false, error: 'Indica qué está mal (o escribe una nota)' }
  return { ok: true, reporte: { aspectos, nota, origen } }
}

export function aplicarReporte(
  receta: { estado: string | null; tags: string[] | null; notas_coach: string | null },
  r: ReporteValido,
  hoy: Date,
): { estado: string; tags: string[]; notas_coach: string; yaMarcada: boolean } | null {
  if (receta.estado === 'descartada') return null
  const previos = receta.tags ?? []
  const tags = [...new Set([...previos, TAG_CORREGIR, ...(r.origen === 'cliente' ? [TAG_REPORTE_CLIENTE] : [])])]
  const linea = `[${hoy.toLocaleDateString('es-ES')}] A corregir: ${r.aspectos.join(', ') || 'otro'}${r.nota ? ` — ${r.nota}` : ''}`
  return {
    estado: receta.estado === 'aprobada' ? 'en_revision' : (receta.estado ?? 'en_revision'),
    tags,
    notas_coach: (receta.notas_coach ?? '').split('\n').includes(linea) ? (receta.notas_coach ?? '') : [receta.notas_coach, linea].filter(Boolean).join('\n'),
    yaMarcada: previos.includes(TAG_CORREGIR),
  }
}

export function quitarMarcasReporte(tags: string[] | null): string[] {
  return (tags ?? []).filter(t => t !== TAG_CORREGIR && t !== TAG_REPORTE_CLIENTE)
}

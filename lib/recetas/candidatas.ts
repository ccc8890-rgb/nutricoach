// Recetas aprobadas que el control de calidad sugiere revisar. Solo sugiere: nunca se reportan solas.
export type RecetaParaCandidata = {
  id: string
  nombre: string
  estado: string | null
  score_calidad: number | null
  quality_issues: { bloqueantes?: unknown[]; avisos?: unknown[] } | null
}

export const UMBRAL_SCORE_CANDIDATA = 70

export function seleccionarCandidatas(recetas: RecetaParaCandidata[], limite = 60): { id: string; nombre: string; motivos: string[] }[] {
  return recetas
    .filter(r => r.estado === 'aprobada')
    .map(r => {
      const bloqueantes = (r.quality_issues?.bloqueantes ?? []).map(b => (typeof b === 'string' ? b : (b as { codigo?: string })?.codigo ?? 'bloqueante'))
      return { id: r.id, nombre: r.nombre, motivos: bloqueantes, score: r.score_calidad }
    })
    .filter(r => r.motivos.length > 0 || (r.score !== null && r.score < UMBRAL_SCORE_CANDIDATA))
    .sort((a, b) => b.motivos.length - a.motivos.length || (a.score ?? 100) - (b.score ?? 100))
    .slice(0, limite)
    .map(({ id, nombre, motivos }) => ({ id, nombre, motivos }))
}

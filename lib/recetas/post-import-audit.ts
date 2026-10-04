import { auditarRecetaProfesional } from './auditoria'

type Srv = Parameters<typeof auditarRecetaProfesional>[0]

export interface ResultadoAuditoriaLote {
  id: string
  score: number
  aprobable: boolean
  estado_sugerido: string
  bloqueantes: string[]
}

// Punto único de auditoría para cualquier camino que cree o cambie de estado recetas (importación por lote, scripts,
// aprobación): calcula score y clasificación, los guarda y deja el evento en recetas_auditoria. Un fallo en una receta
// no detiene a las demás.
export async function auditarLoteRecetas(
  srv: Srv,
  ids: string[],
  origen: string,
  evento = 'post_importacion',
): Promise<ResultadoAuditoriaLote[]> {
  const resultados: ResultadoAuditoriaLote[] = []
  for (const id of ids) {
    try {
      const a = await auditarRecetaProfesional(srv, id, evento, origen)
      resultados.push({ id, score: a.score.score, aprobable: a.resumen.aprobable, estado_sugerido: a.resumen.estado_sugerido, bloqueantes: a.score.bloqueantes })
    } catch (e) {
      console.error(`Auditoría de ${id} falló:`, e instanceof Error ? e.message : e)
    }
  }
  return resultados
}

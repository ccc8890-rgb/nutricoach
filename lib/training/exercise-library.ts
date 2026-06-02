import { calcularEjercicioQuality } from './workspace'

export interface ExerciseLibraryInput {
  id: string
  nombre: string
  grupo_muscular?: string | null
  tipo?: string | null
  foto_url?: string | null
  video_url?: string | null
  dificultad_nivel?: number | null
  equipamiento?: string[] | null
  musculos_secundarios?: string[] | null
}

export interface ExercisePriorityItem {
  id: string
  nombre: string
  score: number
  reason: string
}

export interface ExerciseLibraryQueue {
  total: number
  completos: number
  assetReadinessPct: number
  prioritarios: ExercisePriorityItem[]
}

function reasonFor(input: ExerciseLibraryInput) {
  const missing = [
    !input.foto_url ? 'sin foto' : null,
    !input.video_url ? 'sin vídeo' : null,
    !input.dificultad_nivel ? 'sin dificultad' : null,
    (input.equipamiento?.length ?? 0) === 0 ? 'sin equipamiento' : null,
  ].filter((item): item is string => Boolean(item))

  if (missing.length === 0) return 'Revisar detalles secundarios'
  const visible = missing.slice(0, 3)
  const reason = visible.length > 1
    ? `${visible.slice(0, -1).join(', ')} y ${visible.at(-1)}`
    : visible[0]
  return reason.replace(/^./, c => c.toUpperCase())
}

export function crearExerciseLibraryQueue(ejercicios: ExerciseLibraryInput[]): ExerciseLibraryQueue {
  const total = ejercicios.length
  const scored = ejercicios.map(ejercicio => {
    const quality = calcularEjercicioQuality(ejercicio)
    return {
      id: ejercicio.id,
      nombre: ejercicio.nombre,
      score: quality.score,
      status: quality.status,
      reason: reasonFor(ejercicio),
    }
  })

  const completos = scored.filter(item => item.status === 'completo').length

  return {
    total,
    completos,
    assetReadinessPct: total ? Math.round((completos / total) * 100) : 0,
    prioritarios: scored
      .filter(item => item.status !== 'completo')
      .sort((a, b) => a.score - b.score || a.nombre.localeCompare(b.nombre))
      .slice(0, 5)
      .map(({ id, nombre, score, reason }) => ({ id, nombre, score, reason })),
  }
}

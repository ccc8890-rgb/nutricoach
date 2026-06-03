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

export interface ExerciseLibraryBatchPlan {
  focus: string
  batchSize: number
  estimatedMinutes: number
  exerciseIds: string[]
  note: string
}

export interface ExerciseLibraryCoachGroup {
  grupo: string
  total: number
  listos: number
  pendientes: number
  readinessPct: number
  primaryGap: string
  ids: string[]
}

const GAP_PRIORITY: Record<string, number> = {
  'Sin vídeo': 1,
  'Sin foto': 2,
  'Sin equipamiento': 3,
  'Sin dificultad': 4,
  'Sin músculos secundarios': 5,
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

export function crearExerciseLibraryBatchPlan(ejercicios: ExerciseLibraryInput[]): ExerciseLibraryBatchPlan {
  const queue = crearExerciseLibraryQueue(ejercicios)
  const batch = queue.prioritarios.slice(0, 3)
  const batchInputs = batch
    .map(item => ejercicios.find(ejercicio => ejercicio.id === item.id))
    .filter((item): item is ExerciseLibraryInput => Boolean(item))

  const missingFoto = batchInputs.filter(item => !item.foto_url).length
  const missingVideo = batchInputs.filter(item => !item.video_url).length
  const missingMeta = batchInputs.filter(item => !item.dificultad_nivel || (item.equipamiento?.length ?? 0) === 0).length

  let focus = 'Metadatos'
  if (missingFoto > 0 && missingVideo > 0) focus = 'Vídeo y foto'
  else if (missingVideo > 0) focus = 'Vídeo'
  else if (missingFoto > 0) focus = 'Foto'

  const batchSize = batchInputs.length
  const estimatedMinutes = batchSize > 0
    ? Math.round((missingFoto * 4) + (missingVideo * 7) + (missingMeta * 3) + 1)
    : 0

  return {
    focus,
    batchSize,
    estimatedMinutes,
    exerciseIds: batchInputs.map(item => item.id),
    note: batchSize > 0
      ? `Completa ${batchSize} ejercicios prioritarios para subir readiness sin revisar toda la biblioteca.`
      : 'La vista actual no tiene ejercicios prioritarios pendientes.',
  }
}

export function crearExerciseLibraryCoachGroups(ejercicios: ExerciseLibraryInput[]): ExerciseLibraryCoachGroup[] {
  const map = new Map<string, ExerciseLibraryInput[]>()

  for (const ejercicio of ejercicios) {
    const grupo = ejercicio.grupo_muscular?.trim() || 'Sin grupo'
    const current = map.get(grupo) ?? []
    current.push(ejercicio)
    map.set(grupo, current)
  }

  return Array.from(map.entries())
    .map(([grupo, items]) => {
      const scored = items.map(item => ({
        item,
        quality: calcularEjercicioQuality(item),
      }))
      const listos = scored.filter(row => row.quality.status === 'completo').length
      const gaps = scored
        .flatMap(row => row.quality.gaps)
        .reduce<Record<string, number>>((acc, gap) => {
          acc[gap] = (acc[gap] ?? 0) + 1
          return acc
        }, {})
      const primaryGap = Object.entries(gaps)
        .sort((a, b) => (GAP_PRIORITY[a[0]] ?? 99) - (GAP_PRIORITY[b[0]] ?? 99) || b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? 'Listo para asignar'

      return {
        grupo,
        total: items.length,
        listos,
        pendientes: items.length - listos,
        readinessPct: items.length ? Math.round((listos / items.length) * 100) : 0,
        primaryGap,
        ids: items.map(item => item.id),
      }
    })
    .sort((a, b) => b.total - a.total || a.grupo.localeCompare(b.grupo))
}

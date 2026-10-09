function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildExerciseChecklistKey(sessionId: string, date = new Date()) {
  return `nutricoach:exercise-checklist:${sessionId}:${localDateKey(date)}`
}

export function parseExerciseChecklist(raw: string | null, validIds: string[]) {
  if (!raw) return new Set<string>()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set<string>()
    const valid = new Set(validIds)
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && valid.has(id)))
  } catch {
    return new Set<string>()
  }
}

export function toggleExerciseChecklist(current: Set<string>, exerciseId: string) {
  const next = new Set(current)
  if (next.has(exerciseId)) next.delete(exerciseId)
  else next.add(exerciseId)
  return next
}

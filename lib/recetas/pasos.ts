export interface PasoReceta { number: number; content: string; title?: string; grupo?: string }

/** Pasos de una receta. Una línea «## Bizcocho» abre una fase; los pasos que siguen pertenecen a ella. */
export function parsePasos(text: string | null | undefined): PasoReceta[] {
  if (!text) return []
  let grupo: string | undefined
  const lines: { l: string; grupo?: string }[] = []
  for (const raw of text.split('\n')) {
    const h = raw.match(/^\s*#{2,3}\s+(.+?)\s*$/)
    if (h) { grupo = h[1]; continue }
    if (raw.trim()) lines.push({ l: raw, grupo })
  }
  const numbered = lines.filter(x => /^\s*(?:Paso\s*)?\d+[.)\-:]/.test(x.l))
  if (numbered.length >= 2) {
    return numbered.map((x, i) => {
      const clean = x.l.replace(/^\s*(?:Paso\s*)?\d+[.)\-:]\s*/, '').trim()
      const colonIdx = clean.indexOf(':')
      if (colonIdx > 0 && colonIdx < 40) {
        return { number: i + 1, title: clean.slice(0, colonIdx).trim(), content: clean.slice(colonIdx + 1).trim(), grupo: x.grupo }
      }
      return { number: i + 1, content: clean, grupo: x.grupo }
    })
  }
  return lines.map((x, i) => ({ number: i + 1, content: x.l.trim(), grupo: x.grupo }))
}

/** Ordena los ingredientes por fases en el orden en que se cocinan (el de los pasos). */
export function ordenarPorFases<T extends { grupo?: string | null }>(items: T[], pasos: PasoReceta[]): T[] {
  const orden = [...new Set(pasos.map(p => p.grupo).filter(Boolean))] as string[]
  if (orden.length < 2) return items
  const pos = (g?: string | null) => { const i = g ? orden.indexOf(g) : -1; return i < 0 ? orden.length : i }
  return [...items].sort((a, b) => pos(a.grupo) - pos(b.grupo))
}

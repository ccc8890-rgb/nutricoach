// lib/rendimiento/evidencia.ts
// Estudios de la base de conocimiento que puede citar el entrenador IA de rendimiento.
// El modelo solo ve estos estudios (con clave [K#]); al guardar la decisión, cada clave se sustituye por el título real,
// así no puede atribuir una idea a un trabajo que no está en la base ni inventar referencias.
import type { SupabaseClient } from '@supabase/supabase-js'

export interface FilaEstudio {
  titulo: string
  fuente: string | null
  doi: string | null
  nivel_evidencia: string | null
  puntos_clave: unknown
  resumen: string | null
  tags: string[] | null
  verificado?: boolean | null
}

export interface EstudioCitable {
  clave: string
  titulo: string
  fuente: string
  anio: string | null
  nivel: string
  doi: string | null
  aporta: string
}

/** Temas de ciencia del entrenamiento que usa el análisis (etiquetas de la base). */
export const TAGS_ENTRENAMIENTO = [
  'distribucion_intensidad', 'polarizado', 'economia_carrera', 'tecnica_carrera', 'durabilidad', 'carga_entrenamiento', 'acwr',
  'tapering', 'progresion_volumen', 'tirada_larga', 'fuerza_resistencia', 'monitorizacion', 'hrv', 'maraton', 'corredor_popular', 'intervalos',
] as const

/** Categorías que no son de entrenamiento (nutrición, patologías…): no se ofrecen al entrenador de rendimiento. */
const EXCLUIDAS = '(suplementacion,proteina,metabolismo,patologia,hidratacion,composicion_corporal,competicion)'

const PESO_NIVEL: Record<string, number> = { meta_analisis: 5, revision_sistematica: 4, rct: 3, estudio_observacional: 2, opinion_experto: 1 }
const NOMBRE_NIVEL: Record<string, string> = {
  meta_analisis: 'metaanálisis', revision_sistematica: 'revisión sistemática', rct: 'ensayo aleatorizado', estudio_observacional: 'estudio observacional', opinion_experto: 'consenso o revisión narrativa',
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const anioDe = (fuente: string | null) => fuente?.match(/\b(19|20)\d{2}\b/)?.[0] ?? null
const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t)

const PREFIJO_USO = 'Uso en NutriCoach:'

function usoDe(f: FilaEstudio): string | null {
  const claves = Array.isArray(f.puntos_clave) ? (f.puntos_clave as unknown[]).filter((x): x is string => typeof x === 'string') : []
  return claves.find(c => c.startsWith(PREFIJO_USO))?.slice(PREFIJO_USO.length).trim() || null
}

/** Estudios cargados por los scripts de carga curada: localizados en PubMed por DOI y con su abstract real. */
const esCurado = (f: FilaEstudio) => usoDe(f) !== null

/**
 * Solo se pueden citar estudios con DOI (comprobables): las entradas antiguas escritas a mano, sin DOI, pueden traer
 * afirmaciones sin verificar. Quita duplicados (mismo DOI o título), ordena por calidad de evidencia y reciente, y asigna claves K1, K2…
 */
export function elegirEstudios(filas: FilaEstudio[], limite = 14): EstudioCitable[] {
  const vistos = new Set<string>()
  const unicas = filas.filter(f => {
    if (!f.doi) return false
    const k = f.doi ? `doi:${f.doi.toLowerCase()}` : `t:${norm(f.titulo)}`
    const t = `t:${norm(f.titulo)}`
    if (vistos.has(k) || vistos.has(t)) return false
    vistos.add(k); vistos.add(t)
    return true
  })
  return unicas
    .sort((a, b) =>
      Number(esCurado(b)) - Number(esCurado(a)) ||
      Number(!!b.verificado) - Number(!!a.verificado) ||
      (PESO_NIVEL[b.nivel_evidencia ?? ''] ?? 0) - (PESO_NIVEL[a.nivel_evidencia ?? ''] ?? 0) ||
      (anioDe(b.fuente) ?? '0').localeCompare(anioDe(a.fuente) ?? '0'))
    .slice(0, limite)
    .map((f, i) => ({
      clave: `K${i + 1}`,
      titulo: f.titulo.trim(),
      fuente: (f.fuente ?? '').trim(),
      anio: anioDe(f.fuente),
      nivel: NOMBRE_NIVEL[f.nivel_evidencia ?? ''] ?? 'sin clasificar',
      doi: f.doi,
      // Solo se muestra lo que aporta un estudio curado: en los antiguos es una afirmación escrita a mano sin verificar.
      aporta: recortar(usoDe(f) ?? '', 170),
    }))
}

export function textoEstudios(estudios: EstudioCitable[]): string {
  if (!estudios.length) return ''
  const lineas = estudios.map(e => `[${e.clave}] ${recortar(e.titulo, 130)}${e.anio ? ` (${e.anio})` : ''} · ${e.nivel}${e.aporta ? ` · ${e.aporta}` : ''}`)
  return `ESTUDIOS DISPONIBLES (base de conocimiento del coach; en "evidencia" cita SOLO por su clave [K#] los que apoyen de verdad la decisión; son abstracts, no conclusiones tuyas):\n${lineas.join('\n')}`
}

/** Sustituye cada [K#] por el título real del estudio. Una clave que no existe se elimina (el modelo no puede inventar referencias). */
export function resolverCitas(texto: string, estudios: EstudioCitable[]): string {
  const porClave = new Map(estudios.map(e => [e.clave.toUpperCase(), e]))
  return texto
    .replace(/\[?\bK(\d{1,2})\b\]?/gi, (_, n: string) => {
      const e = porClave.get(`K${n}`)
      return e ? `«${recortar(e.titulo, 90)}»${e.anio ? ` (${e.anio})` : ''}` : ''
    })
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .trim()
}

/** Lee de la base los estudios de ciencia del entrenamiento (activos), con las 3 consultas de cobertura. */
export async function estudiosParaAnalisis(db: SupabaseClient, limite = 14): Promise<EstudioCitable[]> {
  const campos = 'titulo,fuente,doi,nivel_evidencia,puntos_clave,resumen,tags,verificado'
  const etiquetas = TAGS_ENTRENAMIENTO.map(t => `"${t}"`).join(',')
  const [porTags, porCategoria] = await Promise.all([
    db.from('knowledge_base').select(campos).eq('activo', true).not('doi', 'is', null).neq('disciplina', 'nutricion').not('categoria', 'in', EXCLUIDAS).or(`tags.ov.{${etiquetas}}`).limit(80),
    db.from('knowledge_base').select(campos).eq('activo', true).not('doi', 'is', null).in('disciplina', ['running', 'hibrido']).in('categoria', ['intensidad', 'periodizacion', 'volumen', 'resistencia']).limit(60),
  ])
  if (porTags.error && porCategoria.error) return []
  return elegirEstudios([...(porTags.data ?? []), ...(porCategoria.data ?? [])] as FilaEstudio[], limite)
}

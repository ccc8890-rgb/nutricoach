// lib/entrenos/biblioteca-categorias.ts
// Agrupa las plantillas de entrenamiento (sport_modality / tipo) en pocas categorías para elegir una sesión base.

export const CATEGORIAS_SESION = ['Running', 'Híbrido', 'Fuerza', 'Cardio', 'Funcional', 'Otros'] as const
export type CategoriaSesion = (typeof CATEGORIAS_SESION)[number]

export function categoriaDePlantilla(sportModality: string | null | undefined, tipo: string | null | undefined): CategoriaSesion {
  const m = (sportModality ?? tipo ?? '').toLowerCase()
  if (m === 'running') return 'Running'
  if (m === 'hibrido' || m === 'hyrox') return 'Híbrido'
  if (['gym_estetica', 'gym_fuerza', 'gimnasio', 'calistenia', 'fuerza'].includes(m)) return 'Fuerza'
  if (['cardio', 'ciclismo', 'natacion'].includes(m)) return 'Cardio'
  if (['funcional', 'mixto'].includes(m)) return 'Funcional'
  return 'Otros'
}

// Flujo «marcar para corregir»: el coach señala qué está mal al revisar y luego se le da una pasada de IA (supervisada).
export const TAG_CORREGIR = 'Corregir'

export const ASPECTOS_CORRECCION = [
  { id: 'titulo', label: 'Título' },
  { id: 'textos', label: 'Descripción y consejos' },
  { id: 'pasos', label: 'Pasos' },
  { id: 'ingredientes', label: 'Ingredientes / enlaces' },
  { id: 'gramos', label: 'Gramos' },
  { id: 'raciones_kcal', label: 'Raciones y kcal' },
  { id: 'foto', label: 'Foto' },
  { id: 'otro', label: 'Otro' },
] as const

export type AspectoCorreccion = (typeof ASPECTOS_CORRECCION)[number]['id']

export const ASPECTOS_IDS: string[] = ASPECTOS_CORRECCION.map(a => a.id)

// Flujo «marcar para corregir»: el coach señala qué está mal al revisar y el motor (scripts/corregir-marcadas-motor.ts) lo atiende en su siguiente pasada.
export const TAG_CORREGIR = 'Corregir'

export const GRUPOS_CORRECCION = ['Textos', 'Ingredientes', 'Datos', 'Foto'] as const
export type GrupoCorreccion = (typeof GRUPOS_CORRECCION)[number]

export const ASPECTOS_CORRECCION = [
  { id: 'titulo', label: 'Título', grupo: 'Textos' },
  { id: 'textos', label: 'Descripción y consejos', grupo: 'Textos' },
  { id: 'pasos', label: 'Pasos', grupo: 'Textos' },
  { id: 'enlaces', label: 'Ingrediente mal vinculado a la BD', grupo: 'Ingredientes' },
  { id: 'alimento_falta', label: 'Falta un alimento en la BD', grupo: 'Ingredientes' },
  { id: 'gramos', label: 'Cantidades / gramos', grupo: 'Ingredientes' },
  { id: 'alergenos', label: 'Alérgenos: faltan o sobran', grupo: 'Datos' },
  { id: 'etiquetas', label: 'Tipo, familia y etiquetas', grupo: 'Datos' },
  { id: 'raciones_kcal', label: 'Raciones y kcal', grupo: 'Datos' },
  { id: 'foto', label: 'Foto', grupo: 'Foto' },
  { id: 'otro', label: 'Otro', grupo: 'Datos' },
] as const

export type AspectoCorreccion = (typeof ASPECTOS_CORRECCION)[number]['id']

// «ingredientes» era el aspecto único antes de separarlo en enlaces / alimento_falta / gramos: se sigue aceptando para las notas ya guardadas.
export const ASPECTOS_IDS: string[] = [...ASPECTOS_CORRECCION.map(a => a.id), 'ingredientes']

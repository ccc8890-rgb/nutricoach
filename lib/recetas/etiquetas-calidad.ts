// Textos en castellano claro para los códigos del control de calidad (bloqueos y avisos) de la bandeja de revisión.
export const ETIQUETAS_CALIDAD: Record<string, { corto: string; ayuda: string }> = {
  sin_ingredientes: { corto: 'Sin ingredientes', ayuda: 'La receta no tiene ningún ingrediente.' },
  ingredientes_sin_alimento: { corto: 'Ingrediente sin enlazar', ayuda: 'Hay un ingrediente sin alimento enlazado: sin él no hay macros ni precio.' },
  cantidades_invalidas: { corto: 'Cantidad a 0', ayuda: 'Algún ingrediente tiene la cantidad vacía o a 0.' },
  porciones_invalidas: { corto: 'Raciones sin definir', ayuda: 'Indica cuántas raciones salen.' },
  sin_macros: { corto: 'Sin macros', ayuda: 'No se han podido calcular las calorías: revisa los ingredientes enlazados.' },
  match_semantico_sospechoso: { corto: 'Enlace dudoso', ayuda: 'Un ingrediente está enlazado a un alimento que no parece el mismo.' },
  cantidades_sospechosas: { corto: 'Cantidad rara', ayuda: 'Una cantidad es demasiado grande para lo que es (sal, especia, aceite, salsa).' },
  alimento_cero_kcal: { corto: 'Alimento a 0 kcal', ayuda: 'Un ingrediente pesado cuenta 0 kcal: el alimento enlazado no tiene macros.' },
  cantidad_muy_pequena: { corto: 'Cantidad mínima', ayuda: 'Un ingrediente principal pesa menos de 5 g.' },
  potenciador_excesivo: { corto: 'Demasiado potenciador', ayuda: 'Glutamato, sriracha o salsa de soja por encima de lo razonable para las raciones.' },
  cantidad_absurda: { corto: 'Cantidad absurda', ayuda: 'Un ingrediente pasa de 2 kg.' },
  receta_semantica_incoherente: { corto: 'Receta incoherente', ayuda: 'Los ingredientes no encajan con el plato.' },
  instrucciones_vacias: { corto: 'Sin pasos', ayuda: 'Faltan las instrucciones de preparación.' },
  macros_fuera_rango: { corto: 'Kcal fuera de rango', ayuda: 'Las kcal por ración no cuadran con el tipo de plato: mira raciones y cantidades.' },
  cantidades_por_defecto: { corto: 'Cantidades por defecto', ayuda: 'Casi todo pesa 100 g: son cantidades sin estimar.' },
  pocos_ingredientes: { corto: 'Pocos ingredientes', ayuda: 'Tiene menos de 3 ingredientes.' },
  sin_descripcion: { corto: 'Sin descripción', ayuda: 'Falta una descripción breve.' },
  sin_imagen: { corto: 'Sin foto', ayuda: 'No tiene foto.' },
  sin_origen: { corto: 'Sin enlace de origen', ayuda: 'No hay enlace al vídeo o web original.' },
  sin_intolerancias: { corto: 'Sin etiquetas de alérgenos', ayuda: 'Faltan las etiquetas de intolerancias (se rellenan solas en la pasada automática).' },
  ingredientes_duplicados: { corto: 'Ingrediente repetido', ayuda: 'Un ingrediente aparece dos veces.' },
}

export function etiquetaCalidad(codigo: string): { corto: string; ayuda: string } {
  const base = codigo.split(':')[0]
  return ETIQUETAS_CALIDAD[base] ?? { corto: base.replaceAll('_', ' '), ayuda: codigo }
}

export type GrupoSuplemento = 'rendimiento' | 'nutricion_deportiva' | 'salud'
export type Evidencia = 'A' | 'B' | 'C'
export type Recomendacion = { id: string; nombre: string; grupo: GrupoSuplemento; dosis: string; timing: string; evidencia: Evidencia; fuentes: string[]; precauciones: string[]; estado: 'propuesta' }
export type ContextoSuplementos = { peso_kg: number; sexo?: 'hombre' | 'mujer' | 'otro'; edad?: number; objetivo?: string; disciplina?: string; duracion_min?: number; intensidad?: 'baja' | 'media' | 'alta'; tipo_sesion?: 'fuerza' | 'cardio' | 'hibrido'; fase_competicion?: string; cafeina_habitual_mg?: number; analitica?: { vitamina_d_ngml?: number; ferritina_ngml?: number }; condiciones?: string[]; hora_inicio?: string }
export type ResultadoSuplementos = { sesion: Recomendacion[]; diaria: Recomendacion[]; carrera: Recomendacion[]; avisos: string[] }
export const NOTA_ANTIDOPAJE = 'Elige productos con certificacion antidopaje (Informed Sport / NSF Certified for Sport): hay riesgo de contaminacion.'
const IOC = 'IOC 2018 (Maughan et al., Br J Sports Med 52:439-455)'
const fmt = (n: number) => Number(n.toFixed(1)).toLocaleString('es-ES', { maximumFractionDigits: 1 })
const crear = (id: string, nombre: string, grupo: GrupoSuplemento, dosis: string, timing: string, evidencia: Evidencia, fuente: string, precauciones: string[]): Recomendacion => ({ id, nombre, grupo, dosis, timing, evidencia, fuentes: [IOC, fuente], precauciones: [...precauciones, NOTA_ANTIDOPAJE], estado: 'propuesta' })

// Duración típica de cada prueba para un aficionado (minutos); orientativa, para dimensionar hidratos y sodio
const DURACION_PRUEBA_MIN: Record<string, number> = {
  running_5k: 30, running_10k: 60, running_hm: 120, running_maraton: 240, trail_corto: 150, trail_largo: 300, ultra: 480,
  ciclismo_fondo: 240, triatlon_sprint: 75, triatlon_olimpico: 150, triatlon_70_3: 330, ironman: 660, hyrox: 90, crossfit: 45,
}

export function recomendarSuplementos(ctx: ContextoSuplementos): ResultadoSuplementos {
  const resultado: ResultadoSuplementos = { sesion: [], diaria: [], carrera: [], avisos: [] }
  const condiciones = (ctx.condiciones ?? []).join(' ').toLowerCase()
  if (condiciones.includes('embarazo')) {
    resultado.avisos.push('Consulta medica antes de cualquier suplemento')
    return resultado
  }
  const renal = condiciones.includes('renal')
  const hipertension = condiciones.includes('hipertension') || condiciones.includes('hipertensión')
  if (renal) resultado.avisos.push('Enfermedad renal: consulta al medico antes de valorar creatina')
  if (hipertension) resultado.avisos.push('Hipertension: evita cafeina y bicarbonato y consulta al medico')
  if ((ctx.cafeina_habitual_mg ?? 0) > 400) resultado.avisos.push('La ingesta habitual de cafeina supera 400 mg/dia; revisala con un profesional')
  if (!ctx.analitica) resultado.avisos.push('Pide analitica (25(OH)D y ferritina) antes de valorar vitamina D o hierro')
  const peso = Number.isFinite(ctx.peso_kg) && ctx.peso_kg > 0 ? ctx.peso_kg : 0
  const disciplina = (ctx.disciplina ?? '').toLowerCase()
  const hyrox = disciplina === 'hyrox' || disciplina === 'crossfit'
  const duracion = ctx.duracion_min ?? 0
  const competicion = ctx.fase_competicion === 'race_day' || ctx.fase_competicion === 'carrera_inminente'
  const cafeina = () => crear('cafeina', 'Cafeina', 'rendimiento', `${fmt(3 * peso)}-${fmt(6 * peso)} mg`, '45-60 min antes', 'A', 'ISSN 2021 (Guest et al., J Int Soc Sports Nutr 18:1)', ['Puede afectar al sueno si se toma tarde', 'Precaucion en ansiedad e hipertension', 'Prueba la dosis en entreno', 'Maximo 400 mg/dia'])
  // En la prueba manda la duración típica de la disciplina (orientativa, atleta aficionado), no la del entreno de hoy
  const duracionPrueba = DURACION_PRUEBA_MIN[disciplina] ?? duracion
  const carbohidratos = (d = duracion) => crear('carbohidratos_intra', 'Carbohidratos durante el esfuerzo', 'nutricion_deportiva', d < 45 ? 'Nada o solo enjuague' : d <= 75 ? 'Hasta 30 g/h' : d <= 150 ? '30-60 g/h' : '60-90 g/h con maltodextrina (glucosa):fructosa 2:1', 'Durante el esfuerzo', 'A', 'Jeukendrup 2014 (Sports Med 44 S1); Jeukendrup 2011 (J Sports Sci 29 S1, maratón/triatlón/ciclismo); Thomas 2016 (ACSM/AND/DC)', ['Opciones: maltodextrina, geles y bebidas isotonicas', 'El hidrogel tipo Maurten no tiene ventaja concluyente frente a geles convencionales a igual cantidad de carbohidratos', 'Entrena el intestino y prueba todo antes de la prueba'])
  const sodio = () => crear('electrolitos_sodio', 'Sodio', 'nutricion_deportiva', '300-600 mg de sodio por hora', 'Durante el esfuerzo', 'B', 'Thomas 2016 (ACSM/AND/DC); Sawka 2007 (ACSM); Hew-Butler 2015', ['Bebe segun sed y tasa de sudoracion; evita una perdida superior al 2% del peso', 'No sobrehidrates: riesgo de hiponatremia'])
  const recuperacion = () => crear('recuperacion', 'Recuperacion', 'nutricion_deportiva', `${fmt(peso)}-${fmt(1.2 * peso)} g de carbohidratos + ${fmt(0.3 * peso)} g de proteina`, 'Primera hora tras esfuerzo largo o si hay dos sesiones el mismo dia', 'A', 'Thomas 2016 (ACSM/AND/DC)', [])
  if (!renal && (ctx.objetivo === 'rendimiento' || ctx.objetivo === 'ganar_musculo' || hyrox || ctx.tipo_sesion === 'fuerza' || ctx.tipo_sesion === 'hibrido')) resultado.diaria.push(crear('creatina', 'Creatina', 'rendimiento', '3-5 g/dia', 'Continua, sin fase de carga', 'A', 'ISSN 2017 (Kreider et al.)', ['Puede aumentar 1-2 kg de agua; valora su uso en running puro si el peso es critico', 'Consulta al medico si tienes enfermedad renal']))
  if (hyrox || ctx.intensidad === 'alta') resultado.diaria.push(crear('beta_alanina', 'Beta-alanina', 'rendimiento', '4-6 g/dia repartidos en tomas de ~1,6 g', 'Durante al menos 2-4 semanas', 'B', 'ISSN 2015 (Trexler et al.)', ['Efecto modesto en esfuerzos de 1-4 min', 'Puede producir parestesia benigna']))
  if (ctx.analitica?.vitamina_d_ngml !== undefined && ctx.analitica.vitamina_d_ngml < 30) resultado.diaria.push(crear('vitamina_d', 'Vitamina D', 'salud', 'Dosis fijada por medico o coach segun analitica', 'Segun pauta individual', 'A', 'Deficit confirmado por analitica de 25(OH)D', ['No suplementar sin valorar la analitica']))
  if (ctx.analitica?.ferritina_ngml !== undefined && ctx.analitica.ferritina_ngml < 30) resultado.diaria.push(crear('hierro', 'Hierro', 'salud', 'Dosis bajo supervision profesional segun analitica', 'Segun pauta individual', 'A', 'Deficit confirmado por analitica de ferritina', ['Nunca tomar de forma preventiva sin analitica', 'El deficit es mas frecuente en mujeres y atletas de resistencia']))
  if (!hipertension && (ctx.intensidad === 'alta' || ctx.fase_competicion === 'race_day')) resultado.sesion.push(cafeina())
  if (duracion >= 45) resultado.sesion.push(carbohidratos())
  if (duracion > 120) resultado.sesion.push(sodio())
  if (duracion >= 90 || ctx.fase_competicion === 'race_day') resultado.sesion.push(recuperacion())
  if (competicion) {
    if (!hipertension) resultado.carrera.push(cafeina())
    if (duracionPrueba >= 45) resultado.carrera.push(carbohidratos(duracionPrueba))
    if (duracionPrueba > 120) resultado.carrera.push(sodio())
    resultado.carrera.push(recuperacion())
    if (!hipertension) resultado.carrera.push(crear('bicarbonato', 'Bicarbonato (opcional)', 'rendimiento', `${fmt(0.2 * peso)}-${fmt(0.3 * peso)} g`, '60-180 min antes', 'B', 'Grgic 2021', ['Alto riesgo de molestias gastrointestinales; prueba antes en entreno']))
    resultado.carrera.push(crear('nitrato_remolacha', 'Nitrato de remolacha (opcional)', 'rendimiento', '~6-8 mmol de nitrato (aprox. 500 mL de zumo de remolacha)', '2-3 h antes', 'B', 'Jones 2018', ['Efecto menor en atletas muy entrenados', 'Prueba antes en entreno']))
  }
  // Notas por disciplina: dónde la evidencia es directa y dónde se extrapola
  if (hyrox) resultado.avisos.push('Evidencia específica de Hyrox limitada: las pautas se extrapolan de CrossFit (revisión de alcance 2025) y de esfuerzos intermitentes de alta intensidad')
  if (disciplina.startsWith('triatlon') || disciplina === 'ironman') resultado.avisos.push('Triatlón: la bici suele ser el mejor tramo para ingerir hidratos y líquidos; en la carrera a pie el estómago tolera menos (Jeukendrup 2011)')
  if (['ultra', 'trail_largo', 'ironman'].includes(disciplina)) resultado.avisos.push('Prueba muy larga: planifica la ingesta con antelación y prueba todo en entrenos largos (Nutrition in Ultra-Endurance 2019; Jeukendrup 2017)')
  if (ctx.hora_inicio && ctx.hora_inicio >= '16:00' && (resultado.sesion.some(r => r.id === 'cafeina') || resultado.carrera.some(r => r.id === 'cafeina'))) resultado.avisos.push('Cafeina por la tarde: puede afectar al sueno')
  return resultado
}

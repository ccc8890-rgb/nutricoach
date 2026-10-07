import { perfilPrueba } from './competicion'
export type GrupoSuplemento = 'rendimiento' | 'nutricion_deportiva' | 'salud'
export type Evidencia = 'A' | 'B' | 'C'
export type Recomendacion = { id: string; nombre: string; grupo: GrupoSuplemento; dosis: string; timing: string; evidencia: Evidencia; fuentes: string[]; precauciones: string[]; estado: 'propuesta' }
export type ContextoSuplementos = { peso_kg: number; sexo?: 'hombre' | 'mujer' | 'otro'; edad?: number; objetivo?: string; disciplina?: string; duracion_min?: number; duracion_prueba_min?: number; intensidad_sesion?: 'baja' | 'media' | 'alta'; intensidad?: 'baja' | 'media' | 'alta'; tipo_sesion?: 'fuerza' | 'cardio' | 'hibrido'; fase_competicion?: string; cafeina_habitual_mg?: number; analitica?: { vitamina_d_ngml?: number; ferritina_ngml?: number }; condiciones?: string[]; hora_inicio?: string }
export type ResultadoSuplementos = { sesion: Recomendacion[]; diaria: Recomendacion[]; carrera: Recomendacion[]; avisos: string[] }
export const NOTA_ANTIDOPAJE = 'Elige productos con certificacion antidopaje (Informed Sport / NSF Certified for Sport): hay riesgo de contaminacion.'
const IOC = 'IOC 2018 (Maughan et al., Br J Sports Med 52:439-455)'
const fmt = (n: number) => Number(n.toFixed(1)).toLocaleString('es-ES', { maximumFractionDigits: 1 })

type FichaSuplemento = Pick<Recomendacion, 'id' | 'nombre' | 'grupo' | 'evidencia' | 'fuentes' | 'precauciones'>

const CATALOGO_SUPLEMENTOS: Record<string, FichaSuplemento> = {
  cafeina: { id: 'cafeina', nombre: 'Cafeina', grupo: 'rendimiento', evidencia: 'A', fuentes: [IOC, 'ISSN 2021 (Guest et al., J Int Soc Sports Nutr 18:1)'], precauciones: ['Puede afectar al sueno si se toma tarde', 'Precaucion en ansiedad e hipertension', 'Prueba la dosis en entreno', 'Maximo 400 mg/dia', NOTA_ANTIDOPAJE] },
  carbohidratos_intra: { id: 'carbohidratos_intra', nombre: 'Carbohidratos durante el esfuerzo', grupo: 'nutricion_deportiva', evidencia: 'A', fuentes: [IOC, 'Jeukendrup 2014 (Sports Med 44 S1); Jeukendrup 2011 (J Sports Sci 29 S1, maratón/triatlón/ciclismo); Thomas 2016 (ACSM/AND/DC)'], precauciones: ['Opciones: maltodextrina, geles, drink mix tipo Maurten y bebidas isotonicas', 'El hidrogel tipo Maurten no tiene ventaja concluyente frente a geles convencionales a igual cantidad de carbohidratos', 'Entrena el intestino y prueba todo antes de la prueba', NOTA_ANTIDOPAJE] },
  bebida_hidratos: { id: 'bebida_hidratos', nombre: 'Bebida de hidratos (drink mix tipo Maurten, isotónico en polvo o maltodextrina)', grupo: 'nutricion_deportiva', evidencia: 'A', fuentes: [IOC, 'Burke 2011 (J Sports Sci 29 S1)', 'Metaanálisis 2026 de carga de hidratos (doi 10.1111/sms.70379)'], precauciones: ['Estos hidratos cuentan dentro del total del día: no se suman a la dieta, la sustituyen en parte', 'Los gramos por sobre cambian según el producto: usa la etiqueta (un sobre de drink mix de 320 aporta unos 80 g de hidratos)', 'Prueba la bebida y la dosis en entrenos largos antes de la prueba (tolerancia digestiva)', 'El hidrogel tipo Maurten no tiene ventaja concluyente frente a otras bebidas de hidratos a igual cantidad', NOTA_ANTIDOPAJE] },
  hidratacion_previa: { id: 'hidratacion_previa', nombre: 'Hidratación previa a la prueba', grupo: 'nutricion_deportiva', evidencia: 'B', fuentes: ['Sawka 2007 (ACSM position stand, Med Sci Sports Exerc 39:377)'], precauciones: ['Bebe despacio y no te pases: sobrehidratar aumenta el riesgo de hiponatremia', 'Una orina de color pajizo claro es una buena guía', 'Una bebida con sodio o un snack salado ayuda a retener el líquido y estimula la sed', NOTA_ANTIDOPAJE] },
  electrolitos_sodio: { id: 'electrolitos_sodio', nombre: 'Sodio', grupo: 'nutricion_deportiva', evidencia: 'B', fuentes: [IOC, 'Thomas 2016 (ACSM/AND/DC); Sawka 2007 (ACSM); Hew-Butler 2015'], precauciones: ['Bebe segun sed y tasa de sudoracion; evita una perdida superior al 2% del peso', 'No sobrehidrates: riesgo de hiponatremia', NOTA_ANTIDOPAJE] },
  recuperacion: { id: 'recuperacion', nombre: 'Recuperacion', grupo: 'nutricion_deportiva', evidencia: 'A', fuentes: [IOC, 'Thomas 2016 (ACSM/AND/DC)'], precauciones: [NOTA_ANTIDOPAJE] },
  creatina: { id: 'creatina', nombre: 'Creatina', grupo: 'rendimiento', evidencia: 'A', fuentes: [IOC, 'ISSN 2017 (Kreider et al.)'], precauciones: ['Puede aumentar 1-2 kg de agua; valora su uso en running puro si el peso es critico', 'Consulta al medico si tienes enfermedad renal', NOTA_ANTIDOPAJE] },
  beta_alanina: { id: 'beta_alanina', nombre: 'Beta-alanina', grupo: 'rendimiento', evidencia: 'B', fuentes: [IOC, 'ISSN 2015 (Trexler et al.)'], precauciones: ['Efecto modesto en esfuerzos de 1-4 min', 'Puede producir parestesia benigna', NOTA_ANTIDOPAJE] },
  vitamina_d: { id: 'vitamina_d', nombre: 'Vitamina D', grupo: 'salud', evidencia: 'A', fuentes: [IOC, 'Deficit confirmado por analitica de 25(OH)D'], precauciones: ['No suplementar sin valorar la analitica', NOTA_ANTIDOPAJE] },
  hierro: { id: 'hierro', nombre: 'Hierro', grupo: 'salud', evidencia: 'A', fuentes: [IOC, 'Deficit confirmado por analitica de ferritina'], precauciones: ['Nunca tomar de forma preventiva sin analitica', 'El deficit es mas frecuente en mujeres y atletas de resistencia', NOTA_ANTIDOPAJE] },
  bicarbonato: { id: 'bicarbonato', nombre: 'Bicarbonato (opcional)', grupo: 'rendimiento', evidencia: 'B', fuentes: [IOC, 'Grgic 2021'], precauciones: ['Alto riesgo de molestias gastrointestinales; prueba antes en entreno', NOTA_ANTIDOPAJE] },
  nitrato_remolacha: { id: 'nitrato_remolacha', nombre: 'Nitrato de remolacha (opcional)', grupo: 'rendimiento', evidencia: 'B', fuentes: [IOC, 'Jones 2018'], precauciones: ['Efecto menor en atletas muy entrenados', 'Prueba antes en entreno', NOTA_ANTIDOPAJE] },
}

export function getFichaSuplemento(id: string): Omit<FichaSuplemento, 'grupo'> | null {
  const ficha = CATALOGO_SUPLEMENTOS[id]
  if (!ficha) return null
  return {
    id: ficha.id,
    nombre: ficha.nombre,
    evidencia: ficha.evidencia,
    fuentes: ficha.fuentes,
    precauciones: ficha.precauciones,
  }
}

const crear = (id: string, dosis: string, timing: string): Recomendacion => ({ ...CATALOGO_SUPLEMENTOS[id], dosis, timing, estado: 'propuesta' })

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
  const cafeina = () => crear('cafeina', `${fmt(3 * peso)}-${fmt(6 * peso)} mg`, '45-60 min antes')
  // En la prueba manda la duración típica de la disciplina (orientativa, atleta aficionado), no la del entreno de hoy
  const duracionPrueba = ctx.duracion_prueba_min ?? DURACION_PRUEBA_MIN[disciplina] ?? duracion
  const carbohidratos = (d = duracion) => crear('carbohidratos_intra', d < 45 ? 'Nada o solo enjuague' : d <= 75 ? 'Hasta 30 g/h' : d <= 150 ? '30-60 g/h' : '60-90 g/h con maltodextrina (glucosa):fructosa 2:1', 'Durante el esfuerzo')
  const sodio = () => crear('electrolitos_sodio', '300-600 mg de sodio por hora', 'Durante el esfuerzo (pastillas o cápsulas de sales, sobres de electrolitos, bebida con sodio o geles con sodio)')
  const recuperacion = () => crear('recuperacion', `${fmt(peso)}-${fmt(1.2 * peso)} g de carbohidratos + ${fmt(0.3 * peso)} g de proteina`, 'Primera hora tras esfuerzo largo o si hay dos sesiones el mismo dia')
  if (!renal && (ctx.objetivo === 'rendimiento' || ctx.objetivo === 'ganar_musculo' || hyrox || ctx.tipo_sesion === 'fuerza' || ctx.tipo_sesion === 'hibrido')) resultado.diaria.push(crear('creatina', '3-5 g/dia', 'Continua, sin fase de carga'))
  if (hyrox || ctx.intensidad === 'alta') resultado.diaria.push(crear('beta_alanina', '4-6 g/dia repartidos en tomas de ~1,6 g', 'Durante al menos 2-4 semanas'))
  if (ctx.analitica?.vitamina_d_ngml !== undefined && ctx.analitica.vitamina_d_ngml < 30) resultado.diaria.push(crear('vitamina_d', 'Dosis fijada por medico o coach segun analitica', 'Segun pauta individual'))
  if (ctx.analitica?.ferritina_ngml !== undefined && ctx.analitica.ferritina_ngml < 30) resultado.diaria.push(crear('hierro', 'Dosis bajo supervision profesional segun analitica', 'Segun pauta individual'))
  if (!hipertension && (ctx.intensidad === 'alta' || ctx.intensidad_sesion === 'alta' || ctx.fase_competicion === 'race_day')) resultado.sesion.push(cafeina())
  if (duracion >= 45) resultado.sesion.push(carbohidratos())
  if (duracion > 120) resultado.sesion.push(sodio())
  if (duracion >= 90 || ctx.fase_competicion === 'race_day') resultado.sesion.push(recuperacion())
  // Días de carga de hidratos: parte de los hidratos puede ir en bebida (más cómoda). Objetivo g/kg según la duración de la prueba
  const perfil = perfilPrueba(disciplina, ctx.duracion_prueba_min)
  const choDiaCarga = perfil === 'muy_larga' ? 10 : perfil === 'larga' || perfil === 'media' ? 8 : 0
  if (ctx.fase_competicion === 'carrera_inminente' && choDiaCarga > 0 && peso > 0) {
    const total = choDiaCarga * peso
    const liquidos = total * 0.3
    resultado.carrera.push(crear('bebida_hidratos', `Unos ${Math.round(liquidos)} g de hidratos al día en bebida (25-40 % de los ${Math.round(total)} g del día; unos ${Math.max(1, Math.round(liquidos / 80))} sobres de 80 g), en 2-4 tomas`, 'Los días de carga (36-48 h antes), entre comidas o con ellas'))
  }
  if (ctx.fase_competicion === 'race_day' && peso > 0) {
    resultado.carrera.push(crear('hidratacion_previa', `${Math.round(5 * peso)}-${Math.round(7 * peso)} mL de líquido (5-7 mL/kg)`, 'Despacio y al menos 4 h antes de la salida; si la orina sale oscura, 3-5 mL/kg unas 2 h antes. Con bebida con sodio o un snack salado'))
  }
  if (competicion) {
    if (!hipertension) resultado.carrera.push(cafeina())
    if (duracionPrueba >= 45) resultado.carrera.push(carbohidratos(duracionPrueba))
    if (duracionPrueba > 120) resultado.carrera.push(sodio())
    resultado.carrera.push(recuperacion())
    if (!hipertension) resultado.carrera.push(crear('bicarbonato', `${fmt(0.2 * peso)}-${fmt(0.3 * peso)} g`, '60-180 min antes'))
    resultado.carrera.push(crear('nitrato_remolacha', '~6-8 mmol de nitrato (aprox. 500 mL de zumo de remolacha)', '2-3 h antes'))
  }
  // Notas por disciplina: dónde la evidencia es directa y dónde se extrapola
  if (hyrox) resultado.avisos.push('Evidencia específica de Hyrox limitada: las pautas se extrapolan de CrossFit (revisión de alcance 2025) y de esfuerzos intermitentes de alta intensidad')
  if (disciplina.startsWith('triatlon') || disciplina === 'ironman') resultado.avisos.push('Triatlón: la bici suele ser el mejor tramo para ingerir hidratos y líquidos; en la carrera a pie el estómago tolera menos (Jeukendrup 2011)')
  if (['ultra', 'trail_largo', 'ironman'].includes(disciplina)) resultado.avisos.push('Prueba muy larga: planifica la ingesta con antelación y prueba todo en entrenos largos (Nutrition in Ultra-Endurance 2019; Jeukendrup 2017)')
  if (ctx.hora_inicio && ctx.hora_inicio >= '16:00' && (resultado.sesion.some(r => r.id === 'cafeina') || resultado.carrera.some(r => r.id === 'cafeina'))) resultado.avisos.push('Cafeina por la tarde: puede afectar al sueno')
  return resultado
}
